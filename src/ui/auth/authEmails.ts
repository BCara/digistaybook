import { getFirebaseServices } from "../../lib/firebase";

export async function requestAuthEmail(kind: "resetPassword" | "verifyEmail", email?: string) {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Email is unavailable. Please try again shortly.");
  const { httpsCallable } = await import("firebase/functions");
  try {
    await httpsCallable(services.functions, kind === "resetPassword" ? "sendPasswordReset" : "sendAccountVerification")({ email, requestId: crypto.randomUUID() });
  } catch (error) {
    const code = (error as { code?: string }).code;
    throw Object.assign(new Error("We couldn’t request the email. Please try again shortly."), {
      code: code === "functions/resource-exhausted" ? "auth/too-many-requests"
        : code === "functions/invalid-argument" ? "auth/invalid-email" : "auth/network-request-failed"
    });
  }
}
