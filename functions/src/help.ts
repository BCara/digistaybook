import { createHmac } from "node:crypto";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

const resendKey = defineSecret("RESEND_API_KEY");
const hashKey = defineSecret("REPORT_HASH_KEY");
const recipient = defineString("HELP_SUPPORT_EMAIL", { default: "codebertcreations@gmail.com" });
const emulator = process.env.FUNCTIONS_EMULATOR === "true";
const options = { maxInstances: 3, timeoutSeconds: 60, enforceAppCheck: !emulator };
export type HelpMessage = { role: "user" | "assistant"; text: string };

/** Strictly bound untrusted input before it reaches the database or email. */
export function helpTranscript(raw: unknown, required = true): HelpMessage[] {
  if (!Array.isArray(raw) || raw.length > 12 || (required && !raw.length)) throw new HttpsError("invalid-argument", "Please start a new conversation.");
  let size = 0;
  const messages = raw.map((value: unknown) => {
    const m = value as Partial<HelpMessage> | null;
    if (!m || !["user", "assistant"].includes(m.role ?? "") || typeof m.text !== "string" || !m.text.trim() || m.text.length > 1000)
      throw new HttpsError("invalid-argument", "Please keep each message under 1,000 characters.");
    size += m.text.length;
    return { role: m.role!, text: m.text.trim() };
  });
  if (size > 6000 || (required && (messages[0].role !== "user" || messages.at(-1)!.role !== "user")))
    throw new HttpsError("invalid-argument", "Please start a new conversation.");
  return messages;
}

function idOf(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,80}$/.test(value)) throw new HttpsError("invalid-argument", "Reload help and try again.");
  return value;
}

/** Reserve both limits atomically, including a global cap that cannot be bypassed with new IPs. */
async function reserve(request: CallableRequest, kind: "contact") {
  const now = Date.now(), db = getFirestore();
  const ip = createHmac("sha256", emulator ? "local-help" : hashKey.value()).update(request.rawRequest.ip ?? "unknown").digest("hex");
  const limits = [[`${kind}_${ip}_${Math.floor(now / 3600000)}`, 5],
    [`${kind}_global_${Math.floor(now / 86400000)}`, 100]] as const;
  await db.runTransaction(async tx => {
    const refs = limits.map(([id]) => db.doc(`helpLimits/${id}`));
    const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
    if (snapshots.some((snap, i) => (snap.get("count") ?? 0) >= limits[i][1])) throw new HttpsError("resource-exhausted", "Our helper is busy. Please try again later.");
    snapshots.forEach((snap, i) => tx.set(refs[i], { count: (snap.get("count") ?? 0) + 1, expireAt: Timestamp.fromMillis(now + 2 * 86400000) }));
  });
}

export function helpContactInput(data: Record<string, unknown> | undefined) {
  const email = typeof data?.email === "string" ? data.email.trim() : "";
  const name = typeof data?.name === "string" ? data.name.trim() : "";
  const message = typeof data?.message === "string" ? data.message.trim() : "";
  if (email.length > 200 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || name.length > 100 || !message || message.length > 4000)
    throw new HttpsError("invalid-argument", "Enter a valid email and a message under 4,000 characters.");
  return { email, name, message, transcript: helpTranscript(data?.transcript ?? [], false), requestId: idOf(data?.requestId) };
}

export const helpContact = onCall({ ...options, secrets: emulator ? [] : [resendKey, hashKey] }, async request => {
  const input = helpContactInput(request.data);
  await reserve(request, "contact");
  const ref = getFirestore().doc(`helpContacts/${input.requestId}`);
  const { requestId, ...content } = input;
  const record = await getFirestore().runTransaction(async tx => {
    const previous = await tx.get(ref);
    if (previous.exists) return previous.data()!;
    const saved = { ...content, status: "pending", createdAt: Timestamp.now(), expireAt: Timestamp.fromMillis(Date.now() + 180 * 86400000) };
    tx.create(ref, saved);
    return saved;
  });
  if (record.status === "sent" || record.status === "local_preview") return { ok: true };
  if (emulator) { await ref.update({ status: "local_preview" }); return { ok: true }; }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${resendKey.value()}`, "Content-Type": "application/json", "Idempotency-Key": `help-${requestId}` },
      body: JSON.stringify({ from: "DigiStayBook <noreply@digistaybook.com>", to: [recipient.value()], reply_to: record.email,
        subject: "DigiStayBook support request", text: `Name: ${record.name || "Not supplied"}\nEmail: ${record.email}\n\n${record.message}\n\nChat supplied by visitor:\n${(record.transcript as HelpMessage[]).map(m => `${m.role}: ${m.text}`).join("\n\n")}` })
    });
    if (!response.ok) throw new Error("Email unavailable");
    await ref.update({ status: "sent" });
    return { ok: true };
  } catch {
    throw new HttpsError("unavailable", "Your message is saved, but email delivery failed. Please retry to send it.");
  }
});

/** Enforce retention without depending on manually configured Firestore TTL. */
export const deleteExpiredHelp = onSchedule({ schedule: "every 24 hours", maxInstances: 1 }, async () => {
  const db = getFirestore();
  for (const collection of ["helpContacts", "helpLimits"]) {
    for (let page = 0; page < 10; page++) {
      const expired = await db.collection(collection).where("expireAt", "<=", Timestamp.now()).limit(400).get();
      if (expired.empty) break;
      const batch = db.batch();
      expired.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      if (expired.size < 400) break;
    }
  }
});
