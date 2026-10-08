import Stripe from "stripe";
import { defineSecret, defineString } from "firebase-functions/params";
import { HttpsError } from "firebase-functions/v2/https";
import { localTestEnabled } from "./localTest.js";

/* ===========================================================================
   stripeConfig — where the Stripe credentials live, and where they do not.

   The credential is a restricted key (`rk_`), not a secret key. It needs only:
   Checkout Sessions write, Customers write, Subscriptions write, Billing Portal
   Sessions write, Prices read, Products read, Promotion Codes read, Invoices
   read, Disputes read. A compromised key with that set cannot move money.

   `defineSecret` is backed by Google Secret Manager, which is what the Stripe
   security guidance asks for on Google Cloud — not an environment variable and
   never a committed file. `functions/.env.example` documents the names only.

   Price ids are `defineString`, not secrets: they are not confidential, and
   Firebase keeps params in a per-project `.env.<project>` file, which already
   makes it impossible to point a test deployment at the live catalogue.
   ========================================================================= */

export const stripeRestrictedKey = defineSecret("STRIPE_RESTRICTED_KEY");
export const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

export const stripePriceMonthly = defineString("STRIPE_PRICE_MONTHLY");
export const stripePriceAnnual = defineString("STRIPE_PRICE_ANNUAL");

/** Where a host is sent back to after hosted checkout. */
export const appUrl = defineString("APP_URL");

let client: Stripe | undefined;

/**
 * The Stripe client, built on first use.
 *
 * Lazy because `defineSecret` values are only readable inside a function
 * invocation that declared the secret; constructing this at module load would
 * throw during deployment analysis.
 *
 * No `apiVersion` is passed. Pinning one here would let the runtime version
 * drift from the types the installed SDK ships, and the SDK already pins the
 * version it was built against. Upgrade by upgrading the SDK.
 */
export function stripe(): Stripe {
  if (localTestEnabled()) throw new HttpsError("failed-precondition", "Payments are disabled in local Test. Use the seeded active property for this walkthrough.");
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
  if (!client) client = new Stripe(stripeRestrictedKey.value(), { typescript: true });
  return client;
}

/** Declared on every function that talks to Stripe, so the secrets are mounted. */
export const stripeSecrets = [stripeRestrictedKey, stripeWebhookSecret];
