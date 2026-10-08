export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

export const localTest = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";
if ((localTest && firebaseConfig.projectId !== "demo-digistaybook")
  || (firebaseConfig.projectId?.startsWith("demo-") && !localTest)
  || (import.meta.env.MODE === "emulator" && !localTest)) {
  throw new Error("Test must use demo-digistaybook and all local Firebase emulators.");
}
