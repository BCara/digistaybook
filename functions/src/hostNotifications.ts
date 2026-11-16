import { createHash, randomBytes } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { error, info } from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

/* ===========================================================================
   hostNotifications — telling a Host that their walls have news.

   Guest activity is written to `notificationOutbox` inside the transaction
   that caused it (a memory published or held, a memory hidden by a report,
   private feedback delivered). This worker drains that outbox into one digest
   email per Host, at most once per the Host's chosen interval, and only for
   the kinds of news the Host asked for.

   The email carries counts and property names only: no guest names, messages
   or photos leave the system by email. The Host reads those in the inbox.

   A property name is whatever the Host typed, so a digest is only ever sent
   to an address somebody has proved they read: the account's sign-in email,
   or another address once its owner has opened the confirmation link sent to
   it. Until then a custom address is a request, and the digest goes to the
   sign-in email.
   ========================================================================= */

const resendKey = defineSecret("RESEND_API_KEY");
const emulator = process.env.FUNCTIONS_EMULATOR === "true";
const region = "australia-southeast1";

/** What a Host can ask to hear about. Each outbox kind belongs to one. */
export type NoticeTopic = "needsYou" | "newMemories" | "feedback";
export const TOPIC_OF: Record<string, NoticeTopic> = {
  memory_held_for_host_review: "needsYou",
  post_hidden: "needsYou",
  memory_with_safety_team: "needsYou",
  memory_published: "newMemories",
  private_feedback: "feedback"
};

export type NotificationSettings = {
  needsYou: boolean;
  newMemories: boolean;
  feedback: boolean;
  frequency: "hourly" | "daily";
  /** Empty means the account's sign-in email. */
  email: string;
  /** Whether the owner of `email` has confirmed it. Nothing is sent there until they have. */
  emailConfirmed: boolean;
};
export const defaultNotificationSettings: NotificationSettings = {
  needsYou: true, newMemories: true, feedback: true, frequency: "hourly", email: "", emailConfirmed: false
};
const INTERVAL_MS = { hourly: 3_600_000, daily: 86_400_000 } as const;
/** News older than this is not worth an email: the Host has seen the inbox since, or will. */
const STALE_MS = 7 * 86_400_000;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function readNotificationSettings(data: unknown): NotificationSettings {
  const value = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  const flag = (key: "needsYou" | "newMemories" | "feedback") =>
    typeof value[key] === "boolean" ? value[key] as boolean : defaultNotificationSettings[key];
  const email = typeof value.email === "string" && emailPattern.test(value.email) ? value.email : "";
  return { needsYou: flag("needsYou"), newMemories: flag("newMemories"), feedback: flag("feedback"),
    frequency: value.frequency === "daily" ? "daily" : "hourly", email,
    // Confirmation is of one address. A setting saved before confirmation
    // existed carries none, so it reads as unconfirmed and falls back.
    emailConfirmed: email !== "" && value.confirmedEmail === email };
}

/** Where a digest goes: the custom address once confirmed, the sign-in email until then. */
export function digestAddress(settings: NotificationSettings, signInEmail: string): string {
  return settings.email && settings.emailConfirmed ? settings.email : signInEmail;
}

function hostUid(request: CallableRequest): string {
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError("permission-denied", "Sign in with your host account.");
  }
  return request.auth.uid;
}
const callable = { region, maxInstances: 5, enforceAppCheck: !emulator };
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export const getHostNotificationSettings = onCall(callable, async request => {
  const uid = hostUid(request);
  const host = await getFirestore().doc(`hosts/${uid}`).get();
  return readNotificationSettings(host.get("notifications"));
});

/* ---------------------------------------------------------------------------
   Confirming a custom address.                                                */

export const NOTIFICATION_EMAIL_CONFIRMATIONS = "notificationEmailConfirmations";
/** A confirmation email goes to an address nobody has vouched for, so a Host gets few of them. */
export const MAX_CONFIRMATION_EMAILS_PER_DAY = 3;
const CONFIRMATION_TTL_MS = 48 * 3_600_000;
const confirmationTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const SITE = "https://digistaybook.com";
const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * The confirmation email. It is the one message sent to an address before its
 * owner has agreed to anything, so it carries nothing a Host wrote: no
 * property name, no Host name, no sign-in address.
 */
export function notificationConfirmationContent(token: string, site = SITE) {
  const link = `${site}/confirm-notification-email?token=${token}`;
  const intro = "A DigiStayBook host asked for their guest activity emails to be sent to this address.";
  const ignore = "If you were not expecting this, ignore it: nothing more will be sent to you unless the link is used. It stops working after 48 hours.";
  return {
    subject: "Confirm this address for DigiStayBook emails",
    text: `DigiStayBook\n\n${intro}\n\nConfirm this address: ${link}\n\n${ignore}\n\nYour DigiStayBook team`,
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#F7F2E8;color:#14181B;font-family:Arial,sans-serif"><div style="max-width:520px;margin:32px auto;padding:32px;background:#fff;border-radius:12px"><p style="font-size:20px;font-weight:bold">DigiStayBook</p><p style="line-height:1.6">${escape(intro)}</p><p style="margin:28px 0"><a href="${link}" style="display:inline-block;padding:14px 22px;border-radius:6px;background:#B4472A;color:#fff;text-decoration:none;font-weight:bold">Confirm this address</a></p><p style="font-size:14px;line-height:1.6">${escape(ignore)}</p><p>Your DigiStayBook team</p></div></body></html>`
  };
}

async function sendConfirmationEmail(to: string, token: string) {
  if (emulator) return;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${resendKey.value()}`, "Content-Type": "application/json", "Idempotency-Key": `notify-confirm-${tokenId(token).slice(0, 32)}` },
    body: JSON.stringify({ from: "DigiStayBook <noreply@digistaybook.com>", to: [to], ...notificationConfirmationContent(token) })
  });
  if (!response.ok) throw new Error(`mail-provider-${response.status}`);
}

/**
 * Mint a confirmation for one Host and one address, and send it there.
 *
 * Only the hash of the token is stored, so the collection is not a list of
 * working links. A new request retires the Host's earlier ones: one address
 * is ever waiting to be confirmed.
 *
 * Exported for trusted emulator verification, which needs the token the email
 * would have carried; this is not a client endpoint.
 */
export async function issueNotificationEmailConfirmation(uid: string, email: string, now = Date.now(), send = sendConfirmationEmail): Promise<string> {
  const db = getFirestore(), hostRef = db.doc(`hosts/${uid}`);
  await db.runTransaction(async tx => {
    const host = await tx.get(hostRef);
    const recent = (Array.isArray(host.get("notificationEmailRequests")) ? host.get("notificationEmailRequests") as unknown[] : [])
      .filter((at): at is number => typeof at === "number" && now - at < 86_400_000);
    if (recent.length >= MAX_CONFIRMATION_EMAILS_PER_DAY) {
      throw new HttpsError("resource-exhausted", "We have already sent several confirmation emails today. Check that inbox, or try again tomorrow.", { reason: "confirmation-limit" });
    }
    tx.set(hostRef, { notificationEmailRequests: [...recent, now] }, { merge: true });
  });
  const token = randomBytes(32).toString("base64url");
  const earlier = await db.collection(NOTIFICATION_EMAIL_CONFIRMATIONS).where("uid", "==", uid).get();
  const batch = db.batch();
  for (const doc of earlier.docs) batch.delete(doc.ref);
  batch.set(db.collection(NOTIFICATION_EMAIL_CONFIRMATIONS).doc(tokenId(token)), {
    uid, email, createdAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now + CONFIRMATION_TTL_MS) });
  await batch.commit();
  try { await send(email, token); } catch (cause) {
    // No address in the log.
    error("Notification address confirmation failed to send", { reason: cause instanceof Error ? cause.message : "unknown" });
    throw new HttpsError("unavailable", "We could not send the confirmation email. Try again in a moment.");
  }
  return token;
}

export const saveHostNotificationSettings = onCall({ ...callable, secrets: emulator ? [] : [resendKey] }, async request => {
  const uid = hostUid(request), data = request.data ?? {};
  for (const key of ["needsYou", "newMemories", "feedback"]) {
    if (typeof data[key] !== "boolean") throw new HttpsError("invalid-argument", "Check your email settings.");
  }
  if (data.frequency !== "hourly" && data.frequency !== "daily") throw new HttpsError("invalid-argument", "Choose how often to hear from us.");
  let email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (email && (email.length > 254 || !emailPattern.test(email))) throw new HttpsError("invalid-argument", "Enter a valid email address, or leave it blank to use your sign-in email.");
  // The sign-in address typed out is still the sign-in address.
  const signIn = typeof request.auth!.token.email === "string" ? request.auth!.token.email.toLowerCase() : "";
  if (email === signIn) email = "";

  const hostRef = getFirestore().doc(`hosts/${uid}`);
  const previous = ((await hostRef.get()).get("notifications") ?? {}) as Record<string, unknown>;
  // A confirmation is of one address: changing the address drops it.
  const confirmedEmail = email && previous.confirmedEmail === email ? email : "";
  let confirmationSent = false;
  if (email && !confirmedEmail && (previous.email !== email || data.resendConfirmation === true)) {
    await issueNotificationEmailConfirmation(uid, email);
    confirmationSent = true;
  }
  const stored = { needsYou: data.needsYou as boolean, newMemories: data.newMemories as boolean, feedback: data.feedback as boolean,
    frequency: data.frequency as "hourly" | "daily", email };
  await hostRef.set({ notifications: { ...stored, confirmedEmail, updatedAt: Timestamp.now() } }, { merge: true });
  const settings: NotificationSettings = { ...stored, emailConfirmed: Boolean(confirmedEmail) };
  return { ...settings, confirmationSent };
});

/**
 * The link in the confirmation email, used.
 *
 * Whoever holds the link owns the address, and may not be the Host — "someone
 * else looks after your guests" is what the field is for — so this asks for no
 * sign-in. It confirms only the address the Host is still asking for: a link
 * for an address they have since changed away from confirms nothing.
 */
export const confirmHostNotificationEmail = onCall(callable, async request => {
  const token = request.data?.token;
  const invalid = () => new HttpsError("failed-precondition", "This confirmation link is no longer valid. Ask the host to send a new one from their account settings.", { reason: "invalid-link" });
  if (typeof token !== "string" || !confirmationTokenPattern.test(token)) throw invalid();
  const db = getFirestore(), ref = db.collection(NOTIFICATION_EMAIL_CONFIRMATIONS).doc(tokenId(token));
  const live = await db.runTransaction(async tx => {
    const confirmation = await tx.get(ref);
    if (!confirmation.exists) return false;
    const hostRef = db.doc(`hosts/${confirmation.get("uid")}`), host = await tx.get(hostRef);
    const email = confirmation.get("email");
    const current = (confirmation.get("expiresAt")?.toMillis?.() ?? 0) > Date.now() && host.get("notifications.email") === email;
    tx.delete(ref);
    if (current) tx.update(hostRef, { "notifications.confirmedEmail": email, "notifications.confirmedAt": Timestamp.now() });
    return current;
  });
  if (!live) throw invalid();
  return { status: "confirmed" };
});

/* ---------------------------------------------------------------------------
   The digest.                                                                 */

export type DigestLine = { property: string; topic: NoticeTopic; count: number };

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
function describe(line: DigestLine): string {
  if (line.topic === "newMemories") return `${plural(line.count, "new memory", "new memories")} on the wall`;
  if (line.topic === "feedback") return plural(line.count, "private feedback message", "private feedback messages");
  return `${plural(line.count, "memory needs", "memories need")} a look`;
}


export function hostDigestContent(lines: DigestLine[], site = "https://digistaybook.com") {
  const order: NoticeTopic[] = ["needsYou", "feedback", "newMemories"];
  const sorted = [...lines].sort((a, b) => order.indexOf(a.topic) - order.indexOf(b.topic) || a.property.localeCompare(b.property));
  const needsYou = sorted.some(line => line.topic === "needsYou");
  const subject = needsYou ? "Something on your DigiStayBook wall needs a look" : "News from your DigiStayBook guests";
  const rows = sorted.map(line => `${line.property}: ${describe(line)}`);
  const inbox = `${site}/host/inbox`, settings = `${site}/host/account#account-notifications`;
  const intro = needsYou
    ? "Some memories are waiting for you, or have been hidden or held while they are checked. Nothing goes on your wall until it is cleared."
    : "Guests have been busy since we last wrote.";
  return {
    subject,
    text: `DigiStayBook\n\n${intro}\n\n${rows.map(row => `- ${row}`).join("\n")}\n\nOpen your inbox: ${inbox}\n\nChoose which emails you get, how often, and where they go: ${settings}\n\nYour DigiStayBook team`,
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#F7F2E8;color:#14181B;font-family:Arial,sans-serif"><div style="max-width:520px;margin:32px auto;padding:32px;background:#fff;border-radius:12px"><p style="font-size:20px;font-weight:bold">DigiStayBook</p><p style="line-height:1.6">${escape(intro)}</p><ul style="line-height:1.8;padding-left:20px">${rows.map(row => `<li>${escape(row)}</li>`).join("")}</ul><p style="margin:28px 0"><a href="${inbox}" style="display:inline-block;padding:14px 22px;border-radius:6px;background:#B4472A;color:#fff;text-decoration:none;font-weight:bold">Open your inbox</a></p><p style="font-size:14px;line-height:1.6">Guest messages and photos stay in your inbox; this email only counts them.</p><p style="font-size:14px;line-height:1.6"><a href="${settings}" style="color:#B4472A">Choose which emails you get, how often, and where they go</a></p><p>Your DigiStayBook team</p></div></body></html>`
  };
}

type Pending = { ref: FirebaseFirestore.DocumentReference; kind: string; propertyId: string; createdAt: number };

export async function sendHostDigests(now = Date.now()) {
  const db = getFirestore();
  const snapshot = await db.collection("notificationOutbox").where("status", "==", "pending").limit(500).get();
  const pending: Pending[] = snapshot.docs.map(doc => ({ ref: doc.ref, kind: String(doc.get("kind")), propertyId: String(doc.get("propertyId") ?? ""),
    createdAt: doc.get("createdAt")?.toMillis?.() ?? now }));
  const settle = (items: Pending[], status: string, extra: Record<string, unknown> = {}) =>
    Promise.all(items.map(item => item.ref.update({ status, settledAt: FieldValue.serverTimestamp(), ...extra })));

  // Kinds this worker does not deliver stay pending for whatever does.
  const ours = pending.filter(item => TOPIC_OF[item.kind]);
  const stale = ours.filter(item => now - item.createdAt > STALE_MS);
  await settle(stale, "expired");
  const fresh = ours.filter(item => now - item.createdAt <= STALE_MS);

  const propertyIds = [...new Set(fresh.map(item => item.propertyId).filter(Boolean))];
  const properties = new Map((await Promise.all(propertyIds.map(id => db.doc(`properties/${id}`).get()))).map(doc => [doc.id, doc]));
  const orphaned = fresh.filter(item => {
    const property = properties.get(item.propertyId);
    return !property?.exists || property.get("lifecycle") === "deleted" || typeof property.get("ownerUid") !== "string";
  });
  await settle(orphaned, "suppressed", { reason: "no_property" });

  const byOwner = new Map<string, Pending[]>();
  for (const item of fresh) {
    if (orphaned.includes(item)) continue;
    const owner = properties.get(item.propertyId)!.get("ownerUid") as string;
    byOwner.set(owner, [...(byOwner.get(owner) ?? []), item]);
  }

  let sent = 0;
  for (const [uid, items] of byOwner) {
    const hostRef = db.doc(`hosts/${uid}`), host = await hostRef.get();
    const settings = readNotificationSettings(host.get("notifications"));
    const unwanted = items.filter(item => !settings[TOPIC_OF[item.kind]]);
    await settle(unwanted, "suppressed", { reason: "host_settings" });
    const wanted = items.filter(item => settings[TOPIC_OF[item.kind]]);
    if (!wanted.length) continue;
    // Within the Host's interval the news waits and joins the next digest.
    const last = host.get("notificationsSentAt")?.toMillis?.() ?? 0;
    if (now - last < INTERVAL_MS[settings.frequency]) continue;

    // A custom address that nobody has confirmed is not written to.
    let signIn = "";
    if (!(settings.email && settings.emailConfirmed)) {
      try { signIn = (await getAuth().getUser(uid)).email ?? ""; } catch { signIn = ""; }
    }
    const to = digestAddress(settings, signIn);
    const addressKind = to && to === settings.email ? "confirmed_custom" : "sign_in";
    if (!to) { await settle(wanted, "suppressed", { reason: "no_address" }); continue; }

    const counts = new Map<string, DigestLine>();
    for (const item of wanted) {
      const property = String(properties.get(item.propertyId)!.get("name") ?? "Your property").slice(0, 60);
      const key = `${item.propertyId}:${TOPIC_OF[item.kind]}`;
      const line = counts.get(key) ?? { property, topic: TOPIC_OF[item.kind], count: 0 };
      line.count += 1; counts.set(key, line);
    }
    const content = hostDigestContent([...counts.values()]);
    // The same set of outbox entries always produces the same key, so a run
    // that dies after sending and before settling cannot send the digest twice.
    const digestId = createHash("sha256").update(wanted.map(item => item.ref.id).sort().join(",")).digest("hex").slice(0, 32);
    try {
      let providerId = "emulated";
      if (!emulator) {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST", signal: AbortSignal.timeout(15_000),
          headers: { Authorization: `Bearer ${resendKey.value()}`, "Content-Type": "application/json", "Idempotency-Key": `host-digest-${digestId}` },
          body: JSON.stringify({ from: "DigiStayBook <noreply@digistaybook.com>", to: [to], ...content })
        });
        if (!response.ok) throw new Error(`mail-provider-${response.status}`);
        const result = await response.json() as { id?: string };
        if (!result.id) throw new Error("mail-provider-missing-id");
        providerId = result.id;
      }
      await settle(wanted, emulator ? "emulated" : "sent", { digestId, providerId, addressKind });
      await hostRef.set({ notificationsSentAt: Timestamp.fromMillis(now) }, { merge: true });
      sent += 1;
      info("Host digest accepted", { digestId, items: wanted.length, providerId });
    } catch (cause) {
      // Left pending for the next run. No address or content in the log.
      error("Host digest failed", { digestId, items: wanted.length, reason: cause instanceof Error ? cause.message : "unknown" });
    }
  }
  return { sent };
}

export const sendHostNotifications = onSchedule({ schedule: "every 15 minutes", region, maxInstances: 1, retryCount: 1,
  secrets: emulator ? [] : [resendKey] }, async () => { await sendHostDigests(); });
