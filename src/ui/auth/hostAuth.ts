import { getFirebaseServices } from "../../lib/firebase";
import { forgetProperties } from "../host/propertyCache";
import { mfaChallenge, type MfaChallenge } from "./reviewerMfa";

/**
 * A sign-in attempt ends in exactly one of three ways. `cancelled` is kept
 * distinct from `error` because dismissing the Google popup is a deliberate
 * user action, not a failure worth showing as an alert.
 */
export type SignInOutcome =
  | { status: "success" }
  | { status: "cancelled" }
  | { status: "mfa"; challenge: MfaChallenge }
  | { status: "error"; message: string };

export type AuthContextKind = "sign-in" | "sign-up";

const UNCONFIGURED =
  "No Firebase environment is configured, so host sign-in is closed. This build has no development bypass.";

/**
 * Wrong-identifier and wrong-secret codes deliberately collapse into one
 * message: distinguishing them would confirm whether an email has an account.
 */
const CREDENTIAL_CODES = new Set([
  "auth/invalid-credential",
  "auth/invalid-login-credentials",
  "auth/user-not-found",
  "auth/wrong-password"
]);

const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "That email address is not formatted correctly.",
  "auth/missing-password": "Enter your password to continue.",
  "auth/user-disabled": "This host account has been disabled. Contact support to restore access.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes before trying again, or reset your password.",
  "auth/network-request-failed": "We could not reach the authentication service. Check your connection and try again.",
  "auth/operation-not-allowed": "This sign-in method is not enabled for this environment.",
  "auth/unauthorized-domain": "This domain is not authorised for sign-in in this Firebase project.",
  "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow popups for this site and try again.",
  // Account creation has to name this one. Withholding it would leave a Host
  // stuck on a form that can never succeed, and Firebase reveals it regardless.
  "auth/email-already-in-use": "An account already exists for that email address. Sign in instead, or reset your password.",
  "auth/weak-password": "Choose a longer password of at least 8 characters."
};

const CANCELLED_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled"
]);

function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

/**
 * Maps a Firebase error to copy safe to show a signed-out visitor. `context`
 * only changes the wording of the last-resort fallback.
 */
export function describeAuthError(error: unknown, context: AuthContextKind = "sign-in"): SignInOutcome {
  const code = errorCode(error);
  if (CANCELLED_CODES.has(code)) return { status: "cancelled" };
  if (CREDENTIAL_CODES.has(code)) {
    return { status: "error", message: "That email address and password do not match a host account." };
  }
  const message = MESSAGES[code];
  const fallback =
    context === "sign-up"
      ? "We could not create your account. Please try again, and contact support if the problem continues."
      : "Sign-in failed. Please try again, and contact support if the problem continues.";
  return { status: "error", message: message ?? fallback };
}

export async function signInWithEmail(email: string, password: string): Promise<SignInOutcome> {
  const services = await getFirebaseServices();
  if (!services) return { status: "error", message: UNCONFIGURED };
  try {
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    await signInWithEmailAndPassword(services.auth, email.trim(), password);
    return { status: "success" };
  } catch (error) {
    const challenge = mfaChallenge(services.auth, error);
    if (challenge) return { status: "mfa", challenge };
    return describeAuthError(error);
  }
}

export async function signInWithGoogle(): Promise<SignInOutcome> {
  const services = await getFirebaseServices();
  if (!services) return { status: "error", message: UNCONFIGURED };
  try {
    const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
    const credential = await signInWithPopup(services.auth, new GoogleAuthProvider());
    // Google sign-in doubles as sign-up, so a first-time Host gets a profile too.
    await ensureHostProfile(credential.user);
    return { status: "success" };
  } catch (error) {
    const challenge = mfaChallenge(services.auth, error);
    if (challenge) return { status: "mfa", challenge };
    return describeAuthError(error);
  }
}

/** Minimum we enforce ourselves; Firebase's own floor is lower. */
export const passwordMinimumLength = 8;

export type CredentialProblem = { field: "email" | "password" | "confirm"; message: string };

/**
 * Local validation for the account-creation form, kept pure so the rules are
 * testable without Firebase. It is a courtesy check only; Firebase remains the
 * authority on whether an account can be created.
 */
export function validateNewHostCredentials(input: {
  email: string;
  password: string;
  confirmPassword: string;
}): CredentialProblem[] {
  const problems: CredentialProblem[] = [];
  const email = input.email.trim();

  // Deliberately permissive: the authoritative check is the verification email,
  // not a regular expression that rejects valid but unusual addresses.
  if (!email || !email.includes("@") || email.startsWith("@") || email.endsWith("@")) {
    problems.push({ field: "email", message: "Enter the email address you want to sign in with." });
  }
  if (input.password.length < passwordMinimumLength) {
    problems.push({
      field: "password",
      message: `Choose a password of at least ${passwordMinimumLength} characters.`
    });
  }
  if (input.confirmPassword !== input.password) {
    problems.push({ field: "confirm", message: "Both passwords need to match." });
  }
  return problems;
}

/**
 * Creates the Host's profile document if it does not exist yet.
 *
 * Firestore rules bound this to the caller's own uid and to four fields, so
 * there is nothing here a Host could write on another's behalf. A failure is
 * swallowed on purpose: the account itself already exists and the dashboard
 * does not read this document, so refusing the sign-up over a profile write
 * would strand a Host with an account they cannot reach.
 */
async function ensureHostProfile(user: { uid: string; email: string | null; displayName: string | null }, displayName?: string) {
  const services = await getFirebaseServices();
  if (!services) return;
  try {
    const { doc, getDoc, serverTimestamp, setDoc } = await import("firebase/firestore");
    const reference = doc(services.firestore, "users", user.uid);
    if ((await getDoc(reference)).exists()) return;
    await setDoc(reference, {
      displayName: (displayName ?? user.displayName ?? "").trim(),
      email: user.email ?? "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch {
    // Non-fatal, as described above.
  }
}

/**
 * Creates a Host account and its profile document, leaving the Host signed in.
 * An anonymous Guest session is never upgraded into one of these: Guest
 * self-service and Host access are separate identities by design.
 */
export async function createHostAccount(
  email: string,
  password: string,
  displayName?: string
): Promise<SignInOutcome> {
  const services = await getFirebaseServices();
  if (!services) return { status: "error", message: UNCONFIGURED };
  try {
    const { createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
    const credential = await createUserWithEmailAndPassword(services.auth, email.trim(), password);
    const name = displayName?.trim();
    if (name) await updateProfile(credential.user, { displayName: name });
    await ensureHostProfile(credential.user, name);
    return { status: "success" };
  } catch (error) {
    return describeAuthError(error, "sign-up");
  }
}

export async function sendHostPasswordReset(email: string): Promise<SignInOutcome> {
  const services = await getFirebaseServices();
  if (!services) return { status: "error", message: UNCONFIGURED };
  try {
    const { sendPasswordResetEmail } = await import("firebase/auth");
    await sendPasswordResetEmail(services.auth, email.trim());
    return { status: "success" };
  } catch (error) {
    return describeAuthError(error);
  }
}

export async function signOutHost(): Promise<void> {
  // Whatever was read of this account's properties goes with the session: the
  // next Host on this browser must not open on the last one's property.
  forgetProperties();
  const services = await getFirebaseServices();
  if (!services) return;
  const { signOut } = await import("firebase/auth");
  await signOut(services.auth);
}
