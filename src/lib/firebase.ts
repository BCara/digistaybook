import { firebaseConfig, firebaseConfigured } from "./firebaseConfig";

type FirebaseServices = {
  app: import("firebase/app").FirebaseApp;
  auth: import("firebase/auth").Auth;
  firestore: import("firebase/firestore").Firestore;
  storage: import("firebase/storage").FirebaseStorage;
  /** Privileged writes the client is not trusted to make: see FUNCTIONS_REGION. */
  functions: import("firebase/functions").Functions;
};

/**
 * Callables are pinned to the region the functions are deployed in. The SDK
 * otherwise defaults to us-central1 and every call would 404 against a
 * deployment that only exists in Sydney.
 */
export const FUNCTIONS_REGION = "australia-southeast1";

let services: FirebaseServices | null = null;
let initializing: Promise<FirebaseServices> | null = null;
let authStartup: Promise<{ app: import("firebase/app").FirebaseApp; auth: import("firebase/auth").Auth }> | null = null;

/** Session restoration must not wait for database, uploads or attestation. */
export function getFirebaseAuth() {
  if (!firebaseConfigured) return Promise.resolve(null);
  if (!authStartup) authStartup = (async () => {
    const [appModule, authModule] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
    const app = appModule.getApps().find(candidate => candidate.name === "[DEFAULT]") ?? appModule.initializeApp(firebaseConfig);
    const auth = authModule.getAuth(app);
    if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
      authModule.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    }
    return { app, auth };
  })().catch(error => { authStartup = null; throw error; });
  return authStartup;
}

/**
 * App Check attests that a request came from a build of our own client, and
 * every privileged endpoint (reporting, moderation, contribution) requires it.
 *
 * It is deliberately keyed by its own environment variable rather than being
 * derived from the Firebase config: a deployment without a reCAPTCHA site key
 * has no attestation to send, and the server refuses those calls rather than
 * this file pretending otherwise. Enforcement is relaxed only inside the
 * Functions emulator, which cannot mint a token for a demo project.
 */
export async function attachAppCheck(app: import("firebase/app").FirebaseApp): Promise<void> {
  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
  if (!siteKey || import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") return;
  try {
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import("firebase/app-check");
    // A development build is served from localhost, which reCAPTCHA has no
    // domain to attest, so every privileged call comes back 401 Unauthenticated
    // before the endpoint runs. A debug token registered in the Firebase
    // console stands in for the attestation: set the variable to `true` once to
    // have the SDK print a fresh token, register it under App Check -> Apps ->
    // Manage debug tokens, then keep that value in `.env.local` so a restart
    // does not mint another one. Production builds ignore it.
    const debugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;
    if (import.meta.env.DEV && debugToken) {
      (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
        debugToken === "true" ? true : debugToken;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true
    });
  } catch (error) {
    // A failed attestation must not take the whole app down with it: reads
    // still work, and a privileged call fails with the server's own refusal,
    // which is the message a Host can act on. It is reported rather than
    // swallowed, because silently losing attestation looks exactly like a
    // signed-in Host being refused for no reason.
    console.error("App Check did not start; privileged calls will be refused.", error);
  }
}

export async function getFirebaseServices(): Promise<FirebaseServices | null> {
  if (!firebaseConfigured) return null;
  if (services) return services;
  // Guest routes can mount alongside the host auth provider. Share startup so
  // simultaneous readers cannot reconnect emulators or initialise Auth twice.
  if (!initializing) initializing = initializeServices().catch(error => { initializing = null; throw error; });
  return initializing;
}

async function initializeServices(): Promise<FirebaseServices> {
  const [account, firestoreModule, storageModule, functionsModule] =
    await Promise.all([
      getFirebaseAuth(),
      import("firebase/firestore"),
      import("firebase/storage"),
      import("firebase/functions")
    ]);
  // A named guest app may already exist. It must never become the application's
  // host/account Auth instance, and does not imply the default app exists.
  if (!account) throw new Error("Firebase is not configured");
  const { app, auth } = account;
  // Before any service is used, so the first privileged call carries a token.
  await attachAppCheck(app);
  const firestore = firestoreModule.getFirestore(app);
  const storage = storageModule.getStorage(app);
  const functions = functionsModule.getFunctions(app, FUNCTIONS_REGION);
  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
    firestoreModule.connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
    storageModule.connectStorageEmulator(storage, "127.0.0.1", 9199);
    functionsModule.connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  services = { app, auth, firestore, storage, functions };
  return services;
}

/**
 * The one call a guest makes before they have done anything: reading the wall.
 *
 * Every other endpoint the client talks to is privileged — contributing,
 * reporting, anything a Host does — and each of those refuses a request that
 * arrives without an App Check token, so the default app attests before it
 * hands its services out. `getPublicWall` is the exception. It is a read of a
 * wall whose whole purpose is to be opened by a stranger with a phone, and it
 * is the only callable declared without `enforceAppCheck`.
 *
 * Attaching App Check to the app that makes that read costs a guest the whole
 * reCAPTCHA Enterprise round trip — the script, the attestation, the token
 * exchange — before the request is even sent, because the callable SDK waits
 * for a token whenever the app it belongs to has App Check on it. Measured on
 * the deployed site, warm and cached, that was about 1.1s of a 2.2s wait, paid
 * for a token the server then ignores.
 *
 * So the read goes through an app of its own with no attestation and no Auth,
 * in the manner of the per-property guest apps. The default app is untouched:
 * a signed-in Host still reads the wall through it, because the owner preview
 * of a closed wall is resolved from `request.auth.uid` and an unauthenticated
 * app has none to send. If `getPublicWall` ever starts enforcing App Check,
 * this is the thing that has to go.
 */
let wallReader: Promise<import("firebase/functions").Functions> | null = null;

export function wallReaderFunctions() {
  if (!wallReader) wallReader = createWallReader().catch(error => { wallReader = null; throw error; });
  return wallReader;
}

async function createWallReader() {
  if (!firebaseConfigured) throw new Error("This guestbook is unavailable.");
  const [{ initializeApp, getApps }, functionsModule] = await Promise.all([
    import("firebase/app"),
    import("firebase/functions")
  ]);
  const name = "wall-reader";
  const existing = getApps().find(app => app.name === name);
  const app = existing ?? initializeApp(firebaseConfig, name);
  const functions = functionsModule.getFunctions(app, FUNCTIONS_REGION);
  if (!existing && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
    functionsModule.connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  return functions;
}

/**
 * Open the connection to the callable region while the page is still drawing.
 *
 * The wall read cannot be issued until React has mounted and the SDK chunks
 * have parsed, and it is the request the whole page waits on — so the DNS
 * lookup, the TLS handshake and the connection to Sydney are started here,
 * from the entry module, rather than at the moment of the call.
 */
export function preconnectFunctions() {
  if (!firebaseConfigured || typeof document === "undefined") return;
  const href = `https://${FUNCTIONS_REGION}-${firebaseConfig.projectId}.cloudfunctions.net`;
  if (document.head.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = href;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}
