import { firebaseConfig, firebaseConfigured } from "./firebaseConfig";

type FirebaseServices = {
  app: import("firebase/app").FirebaseApp;
  auth: import("firebase/auth").Auth;
  firestore: import("firebase/firestore").Firestore;
  storage: import("firebase/storage").FirebaseStorage;
};

let services: FirebaseServices | null = null;

export async function getFirebaseServices(): Promise<FirebaseServices | null> {
  if (!firebaseConfigured) return null;
  if (services) return services;
  const [{ getApp, getApps, initializeApp }, authModule, firestoreModule, storageModule] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
    import("firebase/firestore"),
    import("firebase/storage")
  ]);
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = authModule.getAuth(app);
  const firestore = firestoreModule.getFirestore(app);
  const storage = storageModule.getStorage(app);
  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
    authModule.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    firestoreModule.connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
    storageModule.connectStorageEmulator(storage, "127.0.0.1", 9199);
  }
  services = { app, auth, firestore, storage };
  return services;
}
