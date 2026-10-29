#!/usr/bin/env node
/* ===========================================================================
   Build the Stripe side of DigiStayBook in one account, and point the
   `digistaybook-cbert` deployment at it.

   ST-01 was done by hand in the sandbox on 8 Sep 2026. Doing it by hand a
   second time, in live mode, is how a live Price ends up with `tax_behavior`
   set (immutable) or a currency option missing. This repeats the sandbox
   build exactly, from the published rate table the functions already enforce
   (`functions/lib/billingPolicy.js`), so the live catalogue cannot disagree
   with the price `stripeActivation.quote()` will accept.

   What it does, each step skipped if already done:
     1. Account default tax behaviour → Automatic (`inferred_by_currency`).
     2. One Product "DigiStayBook" (metadata dsb_catalogue=v1).
     3. Two recurring Prices, AUD base + USD currency_options, no tax_behavior,
        lookup keys dsb_monthly / dsb_annual.
     4. A 100% coupon restricted to that Product and a promotion code for the
        live verification run (TP-PROP-07), capped at 3 redemptions.
     5. The webhook endpoint for `stripeWebhook`, listening to exactly
        `handledEvents`. Its signing secret goes straight into Secret Manager
        as a new STRIPE_WEBHOOK_SECRET version and is never printed.
     6. With --write-env, the two price ids into functions/.env.digistaybook-cbert.

   Nothing switches until functions are redeployed: a deployed function keeps
   the secret version and params it was deployed with.

   The key is read from STRIPE_SETUP_KEY and never from an argument, so it
   stays out of shell history. It needs write on Products, Prices, Coupons,
   Promotion Codes, Webhook Endpoints and Tax Settings — a temporary key, to be
   deleted afterwards. It is NOT the key the functions run on.

     npm --prefix functions run build
     node tools/stripe-go-live.mjs --dry-run
     node tools/stripe-go-live.mjs --write-env
   ========================================================================= */

import fs from "node:fs";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Stripe = require("../functions/node_modules/stripe");

const PROJECT = "digistaybook-cbert";
const WEBHOOK_URL = "https://australia-southeast1-digistaybook-cbert.cloudfunctions.net/stripeWebhook";
const ENV_FILE = fileURLToPath(new URL("../functions/.env.digistaybook-cbert", import.meta.url));
const AVG_CA = "C:\\ProgramData\\AVG\\Antivirus\\wscert.pem";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const writeEnv = args.has("--write-env");
const allowTest = args.has("--test");

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

const key = process.env.STRIPE_SETUP_KEY ?? "";
if (!/^(sk|rk)_(live|test)_/.test(key)) fail("Set STRIPE_SETUP_KEY to the account's secret or setup key first.");
const live = /^(sk|rk)_live_/.test(key);
if (!live && !allowTest) fail("STRIPE_SETUP_KEY is a test key. Pass --test to rehearse against test mode.");
if (!live && writeEnv) fail("--write-env only writes live price ids. Drop it when rehearsing with --test.");

let policy;
try {
  policy = require("../functions/lib/billingPolicy.js");
} catch {
  fail("functions/lib is missing. Run `npm --prefix functions run build` first.");
}
const { publishedRates } = policy;
const { handledEvents } = require("../functions/lib/stripeBilling.js");

const stripe = new Stripe(key, { typescript: false });
const mode = live ? "LIVE" : "test";
const step = (n, text) => console.log(`\n[${n}] ${text}`);
const done = (text) => console.log(`    ✓ ${text}`);
const todo = (text) => console.log(`    → ${dryRun ? "would " : ""}${text}`);

// A step the key may not read is reported, not dumped: a dry run with a
// narrower key still checks every step it can, and a real run stops there.
async function guarded(run) {
  try {
    await run();
  } catch (err) {
    const why = err?.type === "StripePermissionError" ? `this key lacks a permission (${err.raw?.message?.match(/\('([a-z_]+)'\)/)?.[1] ?? err.message})` : err?.message ?? String(err);
    if (dryRun) console.log(`    ? ${why}`);
    else fail(why);
  }
}

const account = await stripe.accounts.retrieve().catch(() => null);
console.log(`Stripe ${mode} mode — ${account?.settings?.dashboard?.display_name ?? "account"} (${account?.id ?? "id not readable with this key"})`);
if (live && account && !account.charges_enabled) {
  console.log("    ! This account cannot take charges yet. Finish activation in the Dashboard before Hosts are sent to checkout.");
}
if (dryRun) console.log("Dry run: nothing will be created or written.");

let product;
const priceIds = {};

/* 1 ------------------------------------------------------------------------ */
await guarded(async () => {
  step(1, "Account default tax behaviour");
  // Before any Price exists: a Price created without `tax_behavior` reads the
  // default, and the Prices below must never set it themselves (it is immutable).
  const tax = await stripe.tax.settings.retrieve();
  if (tax.defaults?.tax_behavior === "inferred_by_currency") done("already Automatic (inferred_by_currency)");
  else {
    todo(`set to inferred_by_currency (is ${tax.defaults?.tax_behavior ?? "unset"})`);
    if (!dryRun) {
      await stripe.tax.settings.update({ defaults: { tax_behavior: "inferred_by_currency" } }).catch((err) =>
        fail(`Could not set the default tax behaviour (${err.message}). Set Dashboard → Tax → Settings → Default tax behaviour → Automatic, then rerun.`)
      );
      done("set");
    }
  }
});

/* 2 ------------------------------------------------------------------------ */
await guarded(async () => {
  step(2, "Product");
  product = (await stripe.products.search({ query: "metadata['dsb_catalogue']:'v1' AND active:'true'" })).data[0];
  // The sandbox Product was made by hand and carries no metadata; recognise it
  // by the Prices already pointing at it rather than create a second Product.
  if (!product) {
    const priced = (await stripe.prices.list({ lookup_keys: ["dsb_monthly"], expand: ["data.product"] })).data[0];
    if (priced?.product?.active) product = priced.product;
  }
  if (product) done(`${product.id} "${product.name}"`);
  else {
    todo('create "DigiStayBook"');
    if (!dryRun) {
      product = await stripe.products.create({ name: "DigiStayBook", metadata: { dsb_catalogue: "v1" } });
      done(product.id);
    }
  }
});

/* 3 ------------------------------------------------------------------------ */
await guarded(async () => {
  step(3, "Prices");
  const plans = { monthly: { interval: "month", lookup: "dsb_monthly" }, annual: { interval: "year", lookup: "dsb_annual" } };
  const existing = (await stripe.prices.list({ lookup_keys: Object.values(plans).map((p) => p.lookup), expand: ["data.currency_options"] })).data;
  for (const [plan, { interval, lookup }] of Object.entries(plans)) {
    const aud = publishedRates.aud[plan];
    const usd = publishedRates.usd[plan];
    const price = existing.find((p) => p.lookup_key === lookup);
    if (price) {
      const wrong = [
        price.currency !== "aud" && `currency ${price.currency}`,
        price.unit_amount !== aud && `AUD ${price.unit_amount}`,
        price.currency_options?.usd?.unit_amount !== usd && `USD ${price.currency_options?.usd?.unit_amount ?? "missing"}`,
        price.recurring?.interval !== interval && `interval ${price.recurring?.interval}`,
        (price.tax_behavior ?? "unspecified") !== "unspecified" && `tax_behavior ${price.tax_behavior}`,
        product && price.product !== product.id && `product ${price.product}`
      ].filter(Boolean);
      if (wrong.length) fail(`${lookup} (${price.id}) exists but does not match the published rate (${wrong.join(", ")}). Fix it in the Dashboard; this will not overwrite a Price.`);
      done(`${plan}: ${price.id} (AUD ${aud} / USD ${usd})`);
      priceIds[plan] = price.id;
      continue;
    }
    todo(`create ${plan}: AUD ${aud} + USD ${usd} every ${interval}, lookup ${lookup}`);
    if (!dryRun) {
      const created = await stripe.prices.create({
        product: product.id,
        currency: "aud",
        unit_amount: aud,
        currency_options: { usd: { unit_amount: usd } },
        recurring: { interval },
        lookup_key: lookup
      });
      done(created.id);
      priceIds[plan] = created.id;
    }
  }
});

/* 4 ------------------------------------------------------------------------ */
await guarded(async () => {
  step(4, "Verification promotion code (100%, max 3 uses)");
  const coupons = (await stripe.coupons.list({ limit: 100 })).data.filter((c) => c.metadata?.dsb_purpose === "launch_verification" && c.valid);
  if (coupons.length) {
    const codes = (await stripe.promotionCodes.list({ coupon: coupons[0].id, active: true, limit: 10 })).data;
    done(`coupon ${coupons[0].id}; active code(s): ${codes.map((c) => c.code).join(", ") || "none"}`);
  } else {
    const code = `DSB-VERIFY-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    todo(`create coupon + code ${code}`);
    if (!dryRun) {
      const coupon = await stripe.coupons.create({
        percent_off: 100,
        duration: "forever",
        name: "Launch verification",
        applies_to: { products: [product.id] },
        metadata: { dsb_purpose: "launch_verification" }
      });
      const promo = await stripe.promotionCodes.create({
        promotion: { type: "coupon", coupon: coupon.id },
        code,
        max_redemptions: 3
      });
      done(`code ${promo.code} (${promo.id}). Not a secret, but do not publish it: it makes a property free for good.`);
    }
  }
});

/* 5 ------------------------------------------------------------------------ */
await guarded(async () => {
  step(5, "Webhook endpoint");
  const endpoints = (await stripe.webhookEndpoints.list({ limit: 100 })).data.filter((e) => e.url === WEBHOOK_URL);
  if (endpoints.length) {
    const e = endpoints[0];
    const missing = handledEvents.filter((t) => !e.enabled_events.includes(t) && !e.enabled_events.includes("*"));
    done(`${e.id} already exists (${e.status})${missing.length ? `; missing events: ${missing.join(", ")}` : ""}`);
    console.log("    Its signing secret cannot be read back. If STRIPE_WEBHOOK_SECRET does not hold it, roll the secret in the Dashboard and set it with `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET`.");
  } else {
    todo(`create → ${WEBHOOK_URL}\n      events: ${handledEvents.join(", ")}`);
    if (!dryRun) {
      const e = await stripe.webhookEndpoints.create({
        url: WEBHOOK_URL,
        enabled_events: [...handledEvents],
        description: "DigiStayBook stripeWebhook (australia-southeast1)"
      });
      done(e.id);
      if (live) {
        const stored = spawnSync("gcloud", ["secrets", "versions", "add", "STRIPE_WEBHOOK_SECRET", "--data-file=-", `--project=${PROJECT}`], {
          input: e.secret,
          shell: process.platform === "win32",
          env: { ...process.env, ...(fs.existsSync(AVG_CA) ? { CLOUDSDK_CORE_CUSTOM_CA_CERTS_FILE: AVG_CA } : {}) },
          encoding: "utf8"
        });
        if (stored.status === 0) done("signing secret stored as a new STRIPE_WEBHOOK_SECRET version");
        else console.log(`    ! Could not store the signing secret (${stored.stderr.trim().split("\n").pop()}). Roll it in the Dashboard and set it with \`firebase functions:secrets:set STRIPE_WEBHOOK_SECRET\`.`);
      } else {
        console.log("    (test rehearsal: signing secret not stored)");
      }
    }
  }
});

/* 6 ------------------------------------------------------------------------ */
step(6, "Price ids for functions/.env.digistaybook-cbert");
if (!priceIds.monthly || !priceIds.annual) todo("write once the Prices exist");
else if (!writeEnv) {
  console.log(`    STRIPE_PRICE_MONTHLY=${priceIds.monthly}\n    STRIPE_PRICE_ANNUAL=${priceIds.annual}`);
  console.log("    (pass --write-env to write them)");
} else if (!dryRun) {
  const today = new Date().toISOString().slice(0, 10);
  let env = fs.readFileSync(ENV_FILE, "utf8");
  // Keep the ids being replaced: the preview project (A-15) runs on the sandbox.
  const before = ["MONTHLY", "ANNUAL"].map((k) => env.match(new RegExp(`^STRIPE_PRICE_${k}=(.*)$`, "m"))?.[1]).filter(Boolean);
  if (before.length && !before.includes(priceIds.monthly)) {
    env = env.replace(/^STRIPE_PRICE_MONTHLY=/m, `# Replaced ${today}: ${before.join(" / ")} (monthly / annual).\nSTRIPE_PRICE_MONTHLY=`);
  }
  env = env.replace(/^STRIPE_PRICE_MONTHLY=.*$/m, `STRIPE_PRICE_MONTHLY=${priceIds.monthly}`);
  env = env.replace(/^STRIPE_PRICE_ANNUAL=.*$/m, `STRIPE_PRICE_ANNUAL=${priceIds.annual}`);
  if (!env.includes("# LIVE catalogue")) {
    env = env.replace(/^STRIPE_PRICE_MONTHLY=/m, `# LIVE catalogue (${account?.id ?? "live account"}, product ${product.id}), written ${today} by tools/stripe-go-live.mjs.\nSTRIPE_PRICE_MONTHLY=`);
  }
  fs.writeFileSync(ENV_FILE, env);
  done("written");
}

console.log(`
Still to do by hand (the API cannot):
  • Create the restricted key the functions run on (Developers → API keys → Create restricted key):
      Checkout Sessions write, Customers write, Subscriptions write, Billing Portal Sessions write,
      Prices read, Products read, Promotion Codes read, Coupons read, Invoices read, Disputes read.
    Then, in your own terminal:  firebase functions:secrets:set STRIPE_RESTRICTED_KEY --project ${PROJECT}
  • Settings → Billing → Revenue recovery: Smart Retries and what happens after them (ST-D5).
  • Delete STRIPE_SETUP_KEY if it was a temporary key.
  • Redeploy functions — nothing changes for Hosts until then.
`);
