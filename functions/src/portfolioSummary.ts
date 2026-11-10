import { createHash, timingSafeEqual } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Timestamp } from "firebase-admin/firestore";
import { error } from "firebase-functions/logger";
import { defineSecret, defineString } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { OUTSTANDING } from "./reporting.js";

/* ===========================================================================
   portfolioSummary — the owner's numbers, for the morning portfolio email.

   GET /api/admin/portfolio-summary?date=YYYY-MM-DD, bearer PORTFOLIO_REPORT_KEY.
   The interface is SUMMARY-CONTRACT.md (schema 1) in the owner's dashboard
   folder; change it there first. A Sydney calendar day, midnight to midnight.

   What leaves: counts, property names, and the name and email of host
   accounts. Never guest messages, guest names, photos or anything a guest
   typed: guest contributions are read with a field mask that cannot return
   them.

   Owner and test accounts are left out of every number and list (see
   `isTestEmail` for the rule) and counted in `testExcluded`.
   ========================================================================= */

export const portfolioReportKey = defineSecret("PORTFOLIO_REPORT_KEY");
/** Extra addresses or "@domain" entries to treat as test accounts, comma separated. */
export const portfolioTestEmails = defineString("PORTFOLIO_TEST_EMAILS", { default: "" });
const emulator = process.env.FUNCTIONS_EMULATOR === "true";

export const TIMEZONE = "Australia/Sydney";
const DAY_MS = 86_400_000;
const LIVE_SUBSCRIPTION = ["active", "past_due", "trialing"];
const CANCEL_ACTIONS = ["cancel", "cancel_on_delete"];

/* ------------------------------ Sydney days ------------------------------ */

const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

/** Sydney wall-clock minus UTC at an instant, in ms. */
function sydneyOffset(ms: number) {
  const parts = Object.fromEntries(dateParts.formatToParts(new Date(ms)).map(part => [part.type, part.value]));
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return wall - Math.floor(ms / 1000) * 1000;
}

/** The Sydney calendar date (YYYY-MM-DD) an instant falls on. */
export function sydneyDate(ms: number) {
  const parts = Object.fromEntries(dateParts.formatToParts(new Date(ms)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Midnight at the start of a Sydney date, as epoch ms. Sydney never changes clocks at midnight. */
export function sydneyMidnight(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - sydneyOffset(guess);
  return guess - sydneyOffset(first);
}

/** The date `days` calendar days after `date` (negative for before). */
export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return addDays(value, 0) === value;
}

export type Window = { from: number; to: number };
/** The reported day, the 7 days ending on it, and the 7 before those. */
export function windowsFor(date: string) {
  const day = { from: sydneyMidnight(date), to: sydneyMidnight(addDays(date, 1)) };
  const last7 = { from: sydneyMidnight(addDays(date, -6)), to: day.to };
  const prev7 = { from: sydneyMidnight(addDays(date, -13)), to: last7.from };
  return { day, last7, prev7 };
}
const inside = (ms: number | null, window: Window) => ms !== null && ms >= window.from && ms < window.to;

/* ----------------------------- Test accounts ----------------------------- */

/**
 * The owner's own addresses: the four operations reviewer accounts already
 * named in tools/setup-reviewer-accounts.mjs. They run the product; their
 * properties are demonstrations and checks, not customers.
 */
export const OWNER_EMAILS = ["codebertcreations@gmail.com", "clb.bertram@gmail.com", "caralbertram@gmail.com", "jjbdunleavy@gmail.com"];
const RESERVED_DOMAINS = ["example.com", "example.org", "example.net", "digistaybook.com"];
const RESERVED_SUFFIXES = [".test", ".example", ".invalid", ".localhost"];

/** Gmail ignores dots and anything after "+", and googlemail.com is the same mailbox. */
export function normaliseEmail(email: string) {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  const mailbox = domain === "googlemail.com" ? "gmail.com" : domain;
  const base = local.split("+")[0];
  return `${mailbox === "gmail.com" ? base.replace(/\./g, "") : base}@${mailbox}`;
}

/**
 * The exclusion rule. An account is an owner or test account when its email:
 *  1. is one of OWNER_EMAILS, or any Gmail alias of one (dots, +tags);
 *  2. is listed in the PORTFOLIO_TEST_EMAILS param (an address, or "@domain");
 *  3. is at a reserved test domain (example.com/.org/.net, *.test, *.example,
 *     *.invalid, *.localhost) or at digistaybook.com itself;
 *  4. carries a "+test" or "+qa" tag (for example host+test1@gmail.com).
 * A property is excluded when its owner is, or when its address starts with
 * "demo-" (the public demonstration walls). Everything is then left out of
 * every number and list, and counted in `testExcluded`.
 */
export function isTestEmail(email: string | null | undefined, extra: string[] = []) {
  if (!email) return false;
  const raw = email.trim().toLowerCase(), normal = normaliseEmail(raw);
  const domain = raw.split("@")[1] ?? "", tag = raw.split("@")[0].split("+")[1] ?? "";
  const listed = [...OWNER_EMAILS, ...extra.filter(entry => !entry.startsWith("@"))].map(normaliseEmail);
  if (listed.includes(normal)) return true;
  if (extra.some(entry => entry.startsWith("@") && domain === entry.slice(1))) return true;
  if (RESERVED_DOMAINS.includes(domain) || RESERVED_SUFFIXES.some(suffix => domain.endsWith(suffix))) return true;
  return /^(test|qa)/.test(tag);
}
export const extraTestEmails = (value: string) => value.split(",").map(entry => entry.trim().toLowerCase()).filter(Boolean);

/* ------------------------------ The summary ------------------------------ */

export type Account = { uid: string; name: string; email: string; createdAt: number | null };
export type Property = { id: string; ownerUid: string; name: string; slug: string; createdAt: number | null; deleted: boolean;
  billingStatus: string | null; livemode: boolean; trialEndsAt: number | null };
/** A guest contribution, without its content: which property, when, and how far it got. */
export type Contribution = { propertyId: string; createdAt: number | null; status: string };
export type LedgerRow = { type: string; lifecycle: string | null; propertyId: string | null; livemode: boolean; processedAt: number | null };
export type Cancellation = { propertyId: string; at: number | null };
export type QueueItem = { propertyId: string | null };
export type Snapshot = {
  accounts: Account[]; properties: Property[];
  /** Contributions created in the 14 days the report covers. */
  contributions: Contribution[];
  /** Every finished contribution, per property. */
  contributionTotals: Record<string, number>;
  ledger: LedgerRow[]; cancellations: Cancellation[];
  awaitingHost: QueueItem[]; safetyQueue: QueueItem[];
};

type Counts = { signUps: number; newEvents: number; uploads: number; upgrades: number; visits: null; errors: null; revenue: null };

export const NOTES = [
  "Revenue is not available: DigiStayBook does not store payment amounts, Stripe holds them.",
  "Visits are not available: DigiStayBook does not record page visits.",
  "Errors are not available: DigiStayBook does not count errors, they are only in Cloud Logging.",
  "Upgrades are subscriptions started at checkout in live Stripe mode, including those that begin with the free trial."
];

export function buildSummary(snapshot: Snapshot, date: string, now: number, extra: string[] = []) {
  const windows = windowsFor(date);
  const testUids = new Set(snapshot.accounts.filter(account => isTestEmail(account.email, extra)).map(account => account.uid));
  const accounts = snapshot.accounts.filter(account => !testUids.has(account.uid));
  const accountOf = new Map(snapshot.accounts.map(account => [account.uid, account]));
  const testProperty = (property: Property) => testUids.has(property.ownerUid) || property.slug.startsWith("demo-");
  const realProperties = snapshot.properties.filter(property => !testProperty(property));
  const real = new Map(realProperties.map(property => [property.id, property]));
  const known = new Set(snapshot.properties.map(property => property.id));
  // A contribution or queue item whose property is gone is kept: it is not known to be a test.
  const counts = (propertyId: string | null) => !propertyId || real.has(propertyId) || !known.has(propertyId);
  const contributions = snapshot.contributions.filter(item => item.status !== "uploading" && counts(item.propertyId));
  const checkouts = snapshot.ledger.filter(row => row.type === "checkout.session.completed" && row.livemode
    && (row.lifecycle === "trialing" || row.lifecycle === "active") && row.propertyId && real.has(row.propertyId));
  const liveCancellations = snapshot.cancellations.filter(item => real.get(item.propertyId)?.livemode);

  const countsFor = (window: Window): Counts => ({
    signUps: accounts.filter(account => inside(account.createdAt, window)).length,
    newEvents: realProperties.filter(property => inside(property.createdAt, window)).length,
    uploads: contributions.filter(item => inside(item.createdAt, window)).length,
    upgrades: new Set(checkouts.filter(row => inside(row.processedAt, window)).map(row => row.propertyId)).size,
    visits: null, errors: null, revenue: null
  });
  const host = (uid: string) => accountOf.get(uid);
  const live = realProperties.filter(property => !property.deleted && property.livemode);
  const soon = now + 14 * DAY_MS;

  return {
    schema: 1, app: "DigiStayBook", date, timezone: TIMEZONE, from: windows.day.from, to: windows.day.to,
    labels: { events: "properties" },
    day: countsFor(windows.day), last7: countsFor(windows.last7), prev7: countsFor(windows.prev7),
    totals: {
      accounts: accounts.length,
      events: realProperties.filter(property => !property.deleted).length,
      uploads: realProperties.reduce((sum, property) => sum + (snapshot.contributionTotals[property.id] ?? 0), 0),
      upgrades: live.filter(property => LIVE_SUBSCRIPTION.includes(property.billingStatus ?? "")).length
    },
    signUps: accounts.filter(account => inside(account.createdAt, windows.day)).sort((a, b) => a.createdAt! - b.createdAt!)
      .map(account => ({ name: account.name, email: account.email, createdAt: account.createdAt })),
    newEvents: realProperties.filter(property => inside(property.createdAt, windows.day)).sort((a, b) => a.createdAt! - b.createdAt!)
      .map(property => ({ name: property.name, date: null, host: host(property.ownerUid)?.name ?? "", hostEmail: host(property.ownerUid)?.email ?? "", createdAt: property.createdAt })),
    upcomingEvents: [] as never[],
    testExcluded: { accounts: testUids.size, events: snapshot.properties.length - realProperties.length },
    notes: [...NOTES],
    extra: {
      activeSubscriptions: live.filter(property => property.billingStatus === "active" || property.billingStatus === "past_due").length,
      trialing: live.filter(property => property.billingStatus === "trialing").length,
      trialsEndingSoon: live.filter(property => property.billingStatus === "trialing" && property.trialEndsAt !== null
        && property.trialEndsAt >= now && property.trialEndsAt < soon).sort((a, b) => a.trialEndsAt! - b.trialEndsAt!)
        .map(property => ({ name: property.name, host: host(property.ownerUid)?.name ?? "", hostEmail: host(property.ownerUid)?.email ?? "", trialEndsAt: property.trialEndsAt })),
      cancellations: { day: new Set(liveCancellations.filter(item => inside(item.at, windows.day)).map(item => item.propertyId)).size,
        last7: new Set(liveCancellations.filter(item => inside(item.at, windows.last7)).map(item => item.propertyId)).size },
      awaitingModeration: {
        host: snapshot.awaitingHost.filter(item => counts(item.propertyId)).length,
        safetyTeam: snapshot.safetyQueue.filter(item => counts(item.propertyId)).length
      },
      sandboxSubscriptions: realProperties.filter(property => !property.deleted && !property.livemode && LIVE_SUBSCRIPTION.includes(property.billingStatus ?? "")).length
    }
  };
}
export type PortfolioSummary = ReturnType<typeof buildSummary>;

/* ------------------------------ Reading data ----------------------------- */

const millis = (value: unknown) => (value as Timestamp | undefined)?.toMillis?.() ?? null;
const text = (value: unknown, max = 120) => typeof value === "string" ? value.trim().slice(0, max) : "";
const SAFETY_QUEUES = ["trustSafetyCases", "contentReports", "privacyRequests"] as const;

export async function loadSnapshot(date: string): Promise<Snapshot> {
  const db = getFirestore(), windows = windowsFor(date);
  const from = windows.prev7.from, to = windows.day.to;
  const [users, properties, contributions, ledger, awaitingHost, ...queues] = await Promise.all([
    db.collection("users").select("displayName", "email", "createdAt").get(),
    db.collection("properties").select("ownerUid", "name", "slug", "createdAt", "lifecycle", "billing.status", "billing.livemode", "billing.trialEndsAt", "billing.stripeSubscriptionId").get(),
    // The field mask is the privacy boundary: no message, name or photo is read.
    db.collection("guestSubmissions").where("createdAt", ">=", new Date(from)).where("createdAt", "<", new Date(to)).select("propertyId", "status", "createdAt").get(),
    db.collection("stripeEvents").where("processedAt", ">=", new Date(from)).where("processedAt", "<", new Date(to)).select("type", "lifecycle", "propertyId", "livemode", "processedAt").get(),
    db.collection("guestSubmissions").where("status", "==", "pending").select("propertyId").get(),
    ...SAFETY_QUEUES.map(queue => db.collection(queue).where("status", "in", OUTSTANDING[queue]).select("propertyId").get())
  ]);

  const accounts: Account[] = users.docs.map(doc => ({ uid: doc.id, name: text(doc.get("displayName")), email: text(doc.get("email"), 254), createdAt: millis(doc.get("createdAt")) }));
  const props: Property[] = properties.docs.map(doc => ({ id: doc.id, ownerUid: String(doc.get("ownerUid") ?? ""), name: text(doc.get("name"), 60),
    slug: String(doc.get("slug") ?? ""), createdAt: millis(doc.get("createdAt")), deleted: doc.get("lifecycle") === "deleted",
    billingStatus: typeof doc.get("billing.status") === "string" ? doc.get("billing.status") : null,
    livemode: doc.get("billing.livemode") === true, trialEndsAt: millis(doc.get("billing.trialEndsAt")) }));

  // The profile document is written by the browser at sign-up and can be
  // missing. Those owners are looked up in Auth so they are still classified.
  const known = new Set(accounts.map(account => account.uid));
  const missing = [...new Set(props.map(property => property.ownerUid).filter(uid => uid && !known.has(uid)))];
  for (let index = 0; index < missing.length; index += 100) {
    try {
      const found = await getAuth().getUsers(missing.slice(index, index + 100).map(uid => ({ uid })));
      for (const user of found.users) accounts.push({ uid: user.uid, name: text(user.displayName), email: text(user.email, 254), createdAt: Date.parse(user.metadata.creationTime) || null });
    } catch { /* Unclassified owners count as real; better than hiding a customer. */ }
  }

  const subscribed = props.filter(property => property.billingStatus !== null);
  const [cancellations, totals] = await Promise.all([
    Promise.all(subscribed.map(async property => (await db.collection(`properties/${property.id}/billingActions`)
      .where("at", ">=", new Date(from)).where("at", "<", new Date(to)).select("action", "at").get())
      .docs.filter(doc => CANCEL_ACTIONS.includes(doc.get("action"))).map(doc => ({ propertyId: property.id, at: millis(doc.get("at")) })))),
    Promise.all(props.map(async property => [property.id, (await db.collection("guestSubmissions").where("propertyId", "==", property.id)
      .where("status", "!=", "uploading").count().get()).data().count] as const))
  ]);

  return {
    accounts, properties: props,
    contributions: contributions.docs.map(doc => ({ propertyId: String(doc.get("propertyId") ?? ""), status: String(doc.get("status") ?? ""), createdAt: millis(doc.get("createdAt")) })),
    contributionTotals: Object.fromEntries(totals),
    ledger: ledger.docs.map(doc => ({ type: String(doc.get("type") ?? ""), lifecycle: doc.get("lifecycle") ?? null, propertyId: doc.get("propertyId") ?? null,
      livemode: doc.get("livemode") === true, processedAt: millis(doc.get("processedAt")) })),
    cancellations: cancellations.flat(),
    awaitingHost: awaitingHost.docs.map(doc => ({ propertyId: doc.get("propertyId") ?? null })),
    safetyQueue: queues.flatMap(queue => queue.docs.map(doc => ({ propertyId: doc.get("propertyId") ?? null })))
  };
}

/* -------------------------------- The route ------------------------------ */

/** Constant-time: both sides are hashed to equal length before comparing. */
export function keyMatches(header: unknown, expected: string) {
  if (!expected || typeof header !== "string") return false;
  const match = /^Bearer (\S+)$/.exec(header.trim());
  const given = createHash("sha256").update(match?.[1] ?? "").digest();
  const wanted = createHash("sha256").update(expected).digest();
  return timingSafeEqual(given, wanted) && !!match;
}

type Request = { method: string; headers: Record<string, string | string[] | undefined>; query: Record<string, unknown> };
type Response = { status(code: number): Response; set(name: string, value: string): Response; json(body: unknown): void; end(): void };
export type SummaryDeps = { key: () => string; load: (date: string) => Promise<Snapshot>; now: () => number; extra: () => string[] };

export async function handleSummaryRequest(request: Request, response: Response, deps: SummaryDeps) {
  response.set("Cache-Control", "no-store").set("X-Robots-Tag", "noindex");
  let expected = "";
  try { expected = deps.key() ?? ""; } catch { expected = ""; }
  if (!expected) { response.status(404).end(); return; }
  if (!keyMatches(request.headers.authorization, expected)) { response.status(401).end(); return; }
  if (request.method !== "GET") { response.status(405).end(); return; }
  const now = deps.now();
  const date = request.query.date === undefined ? addDays(sydneyDate(now), -1) : request.query.date;
  if (!validDate(date)) { response.status(400).json({ error: "date must be YYYY-MM-DD" }); return; }
  try {
    response.status(200).json(buildSummary(await deps.load(date), date, now, deps.extra()));
  } catch (cause) {
    // The reason only: never the body.
    error("portfolio summary failed", { date, reason: cause instanceof Error ? cause.message : "unknown" });
    response.status(500).end();
  }
}

export const portfolioSummary = onRequest({ region: "australia-southeast1", maxInstances: 2, timeoutSeconds: 60, secrets: emulator ? [] : [portfolioReportKey] },
  (request, response) => handleSummaryRequest(request as unknown as Request, response as unknown as Response, {
    key: () => emulator ? process.env.PORTFOLIO_REPORT_KEY ?? "" : portfolioReportKey.value(),
    load: loadSnapshot, now: Date.now, extra: () => extraTestEmails(portfolioTestEmails.value())
  }));
