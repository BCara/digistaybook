import { createHmac } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { error, info } from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";

const resendKey = defineSecret("RESEND_API_KEY");
const hashKey = defineSecret("REPORT_HASH_KEY");
const emulator = process.env.FUNCTIONS_EMULATOR === "true";
const options = { maxInstances: 3, enforceAppCheck: !emulator, secrets: emulator ? [] : [resendKey, hashKey] };
const ACK = { ok: true };
export type AuthEmailKind = "resetPassword" | "verifyEmail";

// Like DigiGuestbook: Firebase issues the code, our own domain hosts the page,
// and Resend delivers the branded email. Never fall back to Firebase's mailer.
export function brandedActionLink(firebaseLink: string, kind: AuthEmailKind) {
  const source = new URL(firebaseLink);
  const code = source.searchParams.get("oobCode");
  if (!code || source.searchParams.get("mode") !== kind) throw new Error("Invalid email action link");
  const link = new URL(kind === "resetPassword" ? "/reset-password" : "/verify-email", "https://digistaybook.com");
  link.searchParams.set("oobCode", code);
  return link.href;
}

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export function authEmailContent(kind: AuthEmailKind, link: string) {
  const reset = kind === "resetPassword";
  const heading = reset ? "Reset your password" : "Verify your email";
  const intro = reset ? "We received a request to reset your DigiStayBook password. Choose a new password using the button below."
    : "Confirm your email address to finish verifying your DigiStayBook account.";
  const note = reset ? "If you didn’t request this, you can ignore this email. Your password will stay the same."
    : "If you didn’t request this, you can ignore this email.";
  return {
    subject: reset ? "Reset your DigiStayBook password" : "Verify your DigiStayBook email",
    text: `DigiStayBook\n\n${heading}\n\n${intro}\n\n${heading}: ${link}\n\nThis link works once. If it has expired, request a new link.\n\n${note}\n\nYour DigiStayBook team\nhttps://digistaybook.com`,
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#F7F2E8;color:#14181B;font-family:Arial,sans-serif"><div style="max-width:520px;margin:32px auto;padding:32px;background:#fff;border-radius:12px"><p style="font-size:20px;font-weight:bold">DigiStayBook</p><h1 style="font-size:26px">${heading}</h1><p style="line-height:1.6">${intro}</p><p style="margin:28px 0"><a href="${escape(link)}" style="display:inline-block;padding:14px 22px;border-radius:6px;background:#B4472A;color:#fff;text-decoration:none;font-weight:bold">${heading}</a></p><p style="font-size:14px;line-height:1.6">This link works once. If it has expired, request a new link.</p><p style="font-size:14px;line-height:1.6">${note}</p><p>Your DigiStayBook team</p><a href="https://digistaybook.com" style="color:#B4472A">digistaybook.com</a></div></body></html>`
  };
}

function digest(value: string) {
  return createHmac("sha256", emulator ? "demo-auth-email-key" : hashKey.value()).update(value).digest("hex");
}

// Reserve the request and all limits atomically. Retrying a request cannot send
// twice; IP and recipient limits apply even when an account does not exist.
async function reserve(request: CallableRequest, kind: AuthEmailKind, email: string) {
  const requestId = request.data?.requestId;
  if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{16,80}$/.test(requestId)) throw new HttpsError("invalid-argument", "Reload the page and try again.");
  const db = getFirestore(), now = Date.now(), window = Math.floor(now / 3_600_000);
  const emailHash = digest(email), ipHash = digest(request.rawRequest.ip ?? "unknown");
  const ref = db.doc(`authEmailRequests/${digest(`${kind}:${email}:${requestId}`)}`);
  const limits = [[`ip_${ipHash}_${window}`, 5], [`email_${emailHash}_${window}`, 3], [`global_${window}`, 100]] as const;
  const allowed = await db.runTransaction(async tx => {
    const previous = await tx.get(ref);
    if (previous.exists) return false;
    const refs = limits.map(([id]) => db.doc(`authEmailLimits/${id}`));
    const snapshots = await Promise.all(refs.map(rate => tx.get(rate)));
    if (snapshots.some((s, i) => (s.get("count") ?? 0) >= limits[i][1])) return false;
    const expiresAt = Timestamp.fromMillis(now + 2 * 3_600_000);
    snapshots.forEach((s, i) => tx.set(refs[i], { count: (s.get("count") ?? 0) + 1, expiresAt }));
    tx.create(ref, { kind, status: "reserved", createdAt: Timestamp.fromMillis(now), expiresAt });
    return true;
  });
  return { allowed, ref };
}

async function deliver(kind: AuthEmailKind, email: string, request: CallableRequest) {
  const claim = await reserve(request, kind, email);
  if (!claim.allowed) {
    if (kind === "verifyEmail") throw new HttpsError("resource-exhausted", "A verification email was requested recently. Check your inbox or try again later.");
    return ACK;
  }
  try {
    const user = await getAuth().getUserByEmail(email);
    if (kind === "verifyEmail" && user.uid !== request.auth?.uid) throw new Error("account-changed");
    if (user.disabled || (kind === "verifyEmail" && user.emailVerified)) {
      await claim.ref.update({ status: "skipped" });
      return ACK;
    }
    const firebaseLink = kind === "resetPassword" ? await getAuth().generatePasswordResetLink(email)
      : await getAuth().generateEmailVerificationLink(email);
    const link = brandedActionLink(firebaseLink, kind);
    // The emulator records only the local link and never contacts a mail provider.
    if (emulator) {
      const local = new URL(link); local.host = "127.0.0.1:5173"; local.protocol = "http:";
      await claim.ref.update({ status: "emulated", link: local.href });
      return ACK;
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${resendKey.value()}`, "Content-Type": "application/json", "Idempotency-Key": `auth-${claim.ref.id}` },
      body: JSON.stringify({ from: "DigiStayBook <noreply@digistaybook.com>", to: [email], ...authEmailContent(kind, link) })
    });
    if (!response.ok) throw new Error(`mail-provider-${response.status}`);
    const result = await response.json() as { id?: string };
    if (!result.id) throw new Error("mail-provider-missing-id");
    await claim.ref.update({ status: "accepted", providerId: result.id });
    info("Authentication email accepted", { kind, requestId: claim.ref.id, providerId: result.id });
  } catch (cause) {
    const code = (cause as { code?: string }).code;
    if (code === "auth/user-not-found") await claim.ref.update({ status: "skipped" });
    else {
      // No recipient, action URL, password or provider response body in logs.
      await claim.ref.update({ status: "failed" });
      error("Authentication email failed", { kind, requestId: claim.ref.id });
      if (kind === "verifyEmail") throw new HttpsError("unavailable", "We couldn’t send your verification email. Please try again shortly.");
      // Reset responses must not reveal whether the address has an account,
      // including when delivery fails. The ledger exposes failures to operators.
    }
  }
  return ACK;
}

export const sendPasswordReset = onCall(options, async request => {
  const email = typeof request.data?.email === "string" ? request.data.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError("invalid-argument", "Enter a valid email address.");
  return deliver("resetPassword", email, request);
});

export const sendAccountVerification = onCall(options, async request => {
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === "anonymous") throw new HttpsError("unauthenticated", "Sign in to verify your email address.");
  // Only the signed-in account's current email can receive this request.
  const user = await getAuth().getUser(request.auth.uid);
  if (!user.email || user.disabled) throw new HttpsError("failed-precondition", "This account cannot receive verification emails.");
  return deliver("verifyEmail", user.email.toLowerCase(), request);
});
