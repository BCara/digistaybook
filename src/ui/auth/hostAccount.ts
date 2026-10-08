import {
  EmailAuthProvider, reauthenticateWithCredential, reload, sendEmailVerification,
  updatePassword, updateProfile, verifyBeforeUpdateEmail, type User
} from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase";
import { mfaChallenge } from "./reviewerMfa";

async function requireHost(user: User) {
  const auth = (await getFirebaseAuth())?.auth;
  if (!auth?.currentUser || auth.currentUser.isAnonymous || auth.currentUser.uid !== user.uid) {
    throw new Error("Sign in to your host account again before making changes.");
  }
  return auth;
}

export async function saveHostName(user: User, name: string) {
  await requireHost(user);
  if (name.trim().length > 80) throw new Error("Use a name of 80 characters or fewer.");
  // Account settings read Firebase Auth, the same source as the host header.
  await updateProfile(user, { displayName: name.trim() });
}

export async function confirmHostPassword(user: User, password: string) {
  const auth = await requireHost(user);
  if (!user.email || !user.providerData.some(provider => provider.providerId === "password")) {
    throw new Error("Manage your Google sign-in through your Google account.");
  }
  if (!password) throw new Error("Enter your current password to confirm this change.");
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    await requireHost(user);
    return null;
  } catch (error) {
    const challenge = mfaChallenge(auth, error, "reauthenticate");
    if (challenge) return challenge;
    throw error;
  }
}

export async function requestHostEmailChange(user: User, email: string) {
  await requireHost(user);
  await verifyBeforeUpdateEmail(user, email.trim());
}

export async function changeHostPassword(user: User, password: string) {
  await requireHost(user);
  await updatePassword(user, password);
}

export async function refreshHostAccount(user: User) {
  await requireHost(user);
  await reload(user);
}

export async function verifyHostEmail(user: User) {
  await requireHost(user);
  await sendEmailVerification(user);
}

export function accountError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  const messages: Record<string, string> = {
    "auth/invalid-credential": "Your current password was not accepted. Try again or request a reset email.",
    "auth/wrong-password": "Your current password was not accepted. Try again or request a reset email.",
    "auth/requires-recent-login": "Confirm your sign-in again before making this change.",
    "auth/email-already-in-use": "That email address is already in use. Choose another address.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Choose a stronger password of at least 8 characters.",
    "auth/password-does-not-meet-requirements": "This password does not meet the account security requirements. Choose a stronger password.",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes before trying again.",
    "auth/network-request-failed": "Check your connection and try again.",
    "auth/user-token-expired": "Sign in again before making this change."
  };
  if (code) return messages[code] ?? "The account change could not complete. Try again.";
  return error instanceof Error ? error.message : "The account change could not complete. Try again.";
}
