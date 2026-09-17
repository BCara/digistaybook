type User = { uid: string; isAnonymous: boolean; provider?: string };
type App = { name: string };
type Auth = { app: App; currentUser: User | null; authStateReady: () => Promise<void> };
const sdk = vi.hoisted(() => ({
  apps: [] as App[], auths: new Map<string, Auth>(),
  initializeApp: vi.fn(), signInAnonymously: vi.fn(), setPersistence: vi.fn(), connectAuthEmulator: vi.fn()
}));
vi.mock("./firebaseConfig", () => ({ firebaseConfigured: true, firebaseConfig: { projectId: "demo-digistaybook" } }));
vi.mock("firebase/app", () => ({ getApps: () => sdk.apps, initializeApp: (...args: unknown[]) => sdk.initializeApp(...args) }));
vi.mock("firebase/auth", () => ({
  getAuth: (app: App) => sdk.auths.get(app.name),
  browserLocalPersistence: "local", setPersistence: (...args: unknown[]) => sdk.setPersistence(...args),
  connectAuthEmulator: (...args: unknown[]) => sdk.connectAuthEmulator(...args),
  signInAnonymously: (auth: Auth) => sdk.signInAnonymously(auth)
}));
vi.mock("firebase/functions", () => ({ getFunctions: (app: App) => ({ app }), connectFunctionsEmulator: vi.fn() }));
vi.mock("firebase/firestore", () => ({ getFirestore: (app: App) => ({ app }), connectFirestoreEmulator: vi.fn() }));
vi.mock("firebase/storage", () => ({ getStorage: (app: App) => ({ app }), connectStorageEmulator: vi.fn() }));

function addApp(name: string, user: User | null = null) {
  const app = { name }; sdk.apps.push(app);
  const auth: Auth = { app, currentUser: user, authStateReady: async () => {} };
  sdk.auths.set(name, auth); return auth;
}
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); sdk.apps.length = 0; sdk.auths.clear();
  vi.stubEnv("VITE_USE_FIREBASE_EMULATORS", "true");
  sdk.initializeApp.mockImplementation((_config, name = "[DEFAULT]") => addApp(name).app);
  sdk.signInAnonymously.mockImplementation(async (auth: Auth) => {
    auth.currentUser = { uid: `anon-${auth.app.name}`, isAnonymous: true }; return { user: auth.currentUser };
  });
});
afterEach(() => vi.unstubAllEnvs());

it.each(["password", "google.com"])("preserves a %s account while opening and revisiting guest actions", async provider => {
  const registered = { uid: "registered-host", isAnonymous: false, provider };
  const hostAuth = addApp("[DEFAULT]", registered);
  const { guestFunctions } = await import("./guestSession");
  const { getFirebaseServices } = await import("./firebase");
  const [first, again] = await Promise.all([guestFunctions("cottage"), guestFunctions("cottage")]);
  await guestFunctions("other-property");
  expect(first).toBe(again);
  expect(hostAuth.currentUser).toBe(registered);
  expect(sdk.signInAnonymously).toHaveBeenCalledTimes(2);
  for (const [auth] of sdk.signInAnonymously.mock.calls) expect(auth).not.toBe(hostAuth);
  expect(sdk.setPersistence.mock.calls.every(([auth]) => auth !== hostAuth)).toBe(true);
  const services = await getFirebaseServices();
  expect(services?.auth).toBe(hostAuth);
  expect(services?.auth.currentUser).toBe(registered);
});

it("waits for restoration and never replaces a registered identity in a guest app", async () => {
  const guestAuth = addApp("guest-cottage");
  const registered = { uid: "existing-account", isAnonymous: false };
  guestAuth.authStateReady = async () => { guestAuth.currentUser = registered; };
  const { guestFunctions } = await import("./guestSession");
  await expect(guestFunctions("cottage")).rejects.toThrow("signed-in account has been preserved");
  expect(sdk.signInAnonymously).not.toHaveBeenCalled();
  expect(guestAuth.currentUser).toBe(registered);
});

it("reuses an existing anonymous identity without signing in again", async () => {
  const guestAuth = addApp("guest-cottage", { uid: "existing-guest", isAnonymous: true });
  const { guestFunctions } = await import("./guestSession");
  await guestFunctions("cottage");
  expect(sdk.signInAnonymously).not.toHaveBeenCalled();
  expect(guestAuth.currentUser?.uid).toBe("existing-guest");
});

it("initialises the host app separately when a guest app was opened first", async () => {
  const guestAuth = addApp("guest-cottage", { uid: "guest", isAnonymous: true });
  const { getFirebaseServices } = await import("./firebase");
  const [first, second] = await Promise.all([getFirebaseServices(), getFirebaseServices()]);
  expect(first).toBe(second);
  expect(first?.app.name).toBe("[DEFAULT]");
  expect(first?.auth).not.toBe(guestAuth);
  expect(sdk.initializeApp).toHaveBeenCalledTimes(1);
  expect(sdk.connectAuthEmulator).toHaveBeenCalledTimes(1);
});
