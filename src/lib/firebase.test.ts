export {};

const sdk = vi.hoisted(() => ({
  app: { name: "[DEFAULT]" },
  firestore: {},
  attestation: vi.fn(),
  database: vi.fn(),
  storage: vi.fn(),
  functions: vi.fn(),
  emulator: vi.fn()
}));
vi.mock("./firebaseConfig", () => ({ firebaseConfigured: true, firebaseConfig: {} }));
vi.mock("firebase/app", () => ({ getApps: () => [sdk.app] }));
vi.mock("firebase/auth", () => ({ getAuth: () => ({}), connectAuthEmulator: vi.fn() }));
vi.mock("firebase/firestore", () => ({ getFirestore: sdk.database, connectFirestoreEmulator: sdk.emulator }));
vi.mock("firebase/storage", () => ({ getStorage: sdk.storage, connectStorageEmulator: vi.fn() }));
vi.mock("firebase/functions", () => ({ getFunctions: sdk.functions, connectFunctionsEmulator: vi.fn() }));
vi.mock("firebase/app-check", () => ({ initializeAppCheck: sdk.attestation, ReCaptchaEnterpriseProvider: class {} }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  sdk.database.mockReturnValue(sdk.firestore);
  vi.stubEnv("VITE_USE_FIREBASE_EMULATORS", "false");
  vi.stubEnv("VITE_FIREBASE_APPCHECK_SITE_KEY", "test-site-key");
});
afterEach(() => vi.unstubAllEnvs());

it("starts property reads with attestation before initializing upload and callable services", async () => {
  const { getFirebaseFirestore, getFirebaseServices } = await import("./firebase");
  const [first, second] = await Promise.all([getFirebaseFirestore(), getFirebaseFirestore()]);
  expect(first).toBe(sdk.firestore);
  expect(second).toBe(first);
  expect(sdk.attestation).toHaveBeenCalledTimes(1);
  expect(sdk.storage).not.toHaveBeenCalled();
  expect(sdk.functions).not.toHaveBeenCalled();
  const services = await getFirebaseServices();
  expect(services?.firestore).toBe(first);
  expect(sdk.attestation).toHaveBeenCalledTimes(1);
  expect(sdk.database).toHaveBeenCalledTimes(1);
  expect(sdk.storage).toHaveBeenCalledTimes(1);
  expect(sdk.functions).toHaveBeenCalledTimes(1);
});

it("connects Firestore to the emulator once when reads and writes start together", async () => {
  vi.stubEnv("VITE_USE_FIREBASE_EMULATORS", "true");
  const { getFirebaseFirestore, getFirebaseServices } = await import("./firebase");
  const [database, services] = await Promise.all([getFirebaseFirestore(), getFirebaseServices()]);
  expect(services?.firestore).toBe(database);
  expect(sdk.emulator).toHaveBeenCalledTimes(1);
  expect(sdk.attestation).not.toHaveBeenCalled();
});
