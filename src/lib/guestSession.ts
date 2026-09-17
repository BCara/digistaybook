import { firebaseConfig, firebaseConfigured } from "./firebaseConfig";
import { attachAppCheck, FUNCTIONS_REGION } from "./firebase";

const sessions = new Map<string, Promise<import("firebase/functions").Functions>>();
// A separate named Firebase app per property keeps guest UIDs separate from
// the host account and from every other property's anonymous session.
export function guestFunctions(slug: string) {
  if (!sessions.has(slug)) sessions.set(slug, createSession(slug).catch(error => { sessions.delete(slug); throw error; }));
  return sessions.get(slug)!;
}
async function createSession(slug: string) {
  if (!firebaseConfigured) throw new Error("This guestbook is unavailable.");
  const [{ initializeApp, getApps }, authModule, functionsModule] = await Promise.all([
    import("firebase/app"), import("firebase/auth"), import("firebase/functions")
  ]);
  const name = `guest-${slug}`;
  const existing = getApps().find(app => app.name === name);
  const app = existing ?? initializeApp(firebaseConfig, name);
  if (!existing) await attachAppCheck(app);
  const auth = authModule.getAuth(app);
  const functions = functionsModule.getFunctions(app, FUNCTIONS_REGION);
  if (!existing && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
    authModule.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    functionsModule.connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  await authModule.setPersistence(auth, authModule.browserLocalPersistence);
  await auth.authStateReady();
  // Never replace a restored registered account, even if one unexpectedly
  // occupies this guest-only app. The main host Auth is never used here.
  if (auth.currentUser && !auth.currentUser.isAnonymous) throw new Error("Your signed-in account has been preserved. This guest session is unavailable.");
  if (!auth.currentUser) await authModule.signInAnonymously(auth);
  if (!auth.currentUser?.isAnonymous) throw new Error("This guest session is unavailable.");
  return functions;
}
export async function guestCall<T>(slug: string, name: string, data: unknown): Promise<T> {
  const functions = await guestFunctions(slug);
  const { httpsCallable } = await import("firebase/functions");
  return (await httpsCallable<unknown, T>(functions, name, { timeout: 120000 })(data)).data;
}
export function guestPhotoUrl(id: string, index: number) {
  const base = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true"
    ? `http://127.0.0.1:5001/${firebaseConfig.projectId}/${FUNCTIONS_REGION}`
    : `https://${FUNCTIONS_REGION}-${firebaseConfig.projectId}.cloudfunctions.net`;
  return `${base}/guestMemoryPhoto?id=${encodeURIComponent(id)}&index=${index}`;
}
