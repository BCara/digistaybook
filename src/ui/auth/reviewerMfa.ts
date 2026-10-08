import {
  EmailAuthProvider, GoogleAuthProvider, TotpMultiFactorGenerator,
  getMultiFactorResolver, multiFactor, reauthenticateWithCredential,
  reauthenticateWithPopup, reload, sendEmailVerification,
  type Auth, type MultiFactorError, type MultiFactorResolver, type TotpSecret, type User
} from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase";

export type MfaChallenge = { resolver: MultiFactorResolver; factorUid: string; kind: "sign-in" | "reauthenticate" };
export function mfaChallenge(auth: Auth, error: unknown, kind: MfaChallenge["kind"] = "sign-in"): MfaChallenge | null {
  if ((error as { code?: string })?.code !== "auth/multi-factor-auth-required") return null;
  const resolver = getMultiFactorResolver(auth, error as MultiFactorError);
  const factor = resolver.hints.find(hint => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!factor) throw new Error("This account uses an unsupported second factor. Contact the account administrator.");
  return { resolver, factorUid: factor.uid, kind };
}
export async function completeMfa(challenge: MfaChallenge, code: string) {
  if (!/^\d{6}$/.test(code.trim())) throw new Error("Enter the six-digit code from your authenticator app.");
  return challenge.resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(challenge.factorUid, code.trim()));
}
export function mfaError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (["auth/invalid-verification-code", "auth/code-expired", "auth/invalid-totp-code"].includes(code ?? "")) return "That code was not accepted. Enter the current code from your authenticator app.";
  if (code === "auth/requires-recent-login") return "Confirm your sign-in again before setting up the authenticator.";
  if (code === "auth/unverified-email") return "Verify your email address before setting up the authenticator.";
  if (code === "auth/too-many-requests") return "Too many attempts. Wait a few minutes before trying again.";
  if (code === "auth/network-request-failed") return "The authentication service could not be reached. Check your connection and try again.";
  // Provider exception bodies can contain credentials or identifiers.
  return code ? "Authentication could not complete. Try again, or contact the reviewer administrator." : error instanceof Error ? error.message : "Authentication could not complete. Try again.";
}
export async function reviewerAccess(user: User) {
  const result = await user.getIdTokenResult(true);
  const firebase = result.claims.firebase as { sign_in_second_factor?: string } | undefined;
  // This is presentation only; every operations request is authorised by the server.
  return { reviewer: result.claims.admin === true, mfa: !!firebase?.sign_in_second_factor };
}
export async function beginReviewerEnrollment(user: User, password: string): Promise<{ secret?: TotpSecret; challenge?: MfaChallenge }> {
  await reload(user);
  if (!user.emailVerified) throw new Error("Verify your email address first.");
  if (!(await reviewerAccess(user)).reviewer) throw new Error("This account is not authorised for Safety Review.");
  const auth = (await getFirebaseAuth())?.auth;
  if (!auth) throw new Error("Sign-in is unavailable.");
  try {
    if (user.providerData.some(provider => provider.providerId === "google.com")) await reauthenticateWithPopup(user, new GoogleAuthProvider());
    else {
      if (!user.email || !password) throw new Error("Enter your account password to confirm your sign-in.");
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    }
  } catch (error) {
    const challenge = mfaChallenge(auth, error, "reauthenticate");
    if (challenge) return { challenge };
    throw error;
  }
  return { secret: await generateReviewerSecret(user) };
}
export async function generateReviewerSecret(user: User) {
  if (!(await reviewerAccess(user)).reviewer || !user.emailVerified) throw new Error("A verified reviewer account is required.");
  if (multiFactor(user).enrolledFactors.length) throw new Error("An authenticator is already enrolled. Sign out and sign in with its code.");
  return TotpMultiFactorGenerator.generateSecret(await multiFactor(user).getSession());
}
export async function enrollReviewer(user: User, secret: TotpSecret, code: string) {
  if (!/^\d{6}$/.test(code.trim())) throw new Error("Enter the six-digit code from your authenticator app.");
  await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(secret, code.trim()), "Safety Review authenticator");
}
export async function verifyReviewerEmail(user: User) {
  await sendEmailVerification(user);
}
