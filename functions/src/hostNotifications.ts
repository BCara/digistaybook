import { createHash } from "node:crypto";
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
};
export const defaultNotificationSettings: NotificationSettings = {
  needsYou: true, newMemories: true, feedback: true, frequency: "hourly", email: ""
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
    frequency: value.frequency === "daily" ? "daily" : "hourly", email };
}

function hostUid(request: CallableRequest): string {
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError("permission-denied", "Sign in with your host account.");
  }
  return request.auth.uid;
}
const callable = { region, maxInstances: 5, enforceAppCheck: !emulator };

export const getHostNotificationSettings = onCall(callable, async request => {
  const uid = hostUid(request);
  const host = await getFirestore().doc(`hosts/${uid}`).get();
  return readNotificationSettings(host.get("notifications"));
});

export const saveHostNotificationSettings = onCall(callable, async request => {
  const uid = hostUid(request), data = request.data ?? {};
  for (const key of ["needsYou", "newMemories", "feedback"]) {
    if (typeof data[key] !== "boolean") throw new HttpsError("invalid-argument", "Check your email settings.");
  }
  if (data.frequency !== "hourly" && data.frequency !== "daily") throw new HttpsError("invalid-argument", "Choose how often to hear from us.");
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (email && (email.length > 254 || !emailPattern.test(email))) throw new HttpsError("invalid-argument", "Enter a valid email address, or leave it blank to use your sign-in email.");
  const settings: NotificationSettings = { needsYou: data.needsYou, newMemories: data.newMemories, feedback: data.feedback, frequency: data.frequency, email };
  await getFirestore().doc(`hosts/${uid}`).set({ notifications: { ...settings, updatedAt: Timestamp.now() } }, { merge: true });
  return settings;
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

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

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

    let to = settings.email;
    if (!to) {
      try { to = (await getAuth().getUser(uid)).email ?? ""; } catch { to = ""; }
    }
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
      await settle(wanted, emulator ? "emulated" : "sent", { digestId, providerId });
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
