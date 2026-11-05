import { createHostAccount, signOutHost } from "./hostAuth";
import { handOffToSignMaker, takeSignPrefill } from "../signs/signPrefill";

const mocks = vi.hoisted(() => ({
  services: vi.fn(), create: vi.fn(), update: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn(), signOut: vi.fn()
}));
vi.mock("../../lib/firebase", () => ({ getFirebaseServices: mocks.services, getFirebaseAuth: mocks.services }));
vi.mock("firebase/auth", () => ({ createUserWithEmailAndPassword: mocks.create, updateProfile: mocks.update, signOut: mocks.signOut }));
vi.mock("firebase/firestore", () => ({ doc: (...parts: unknown[]) => parts, getDoc: mocks.getDoc, setDoc: mocks.setDoc, serverTimestamp: () => "server-time" }));

beforeEach(() => {
  vi.resetAllMocks();
  window.sessionStorage.clear();
  mocks.services.mockResolvedValue({ auth: {}, firestore: {} });
  mocks.create.mockResolvedValue({ user: { uid: "created-host", email: "qa@example.test", displayName: null } });
  mocks.update.mockResolvedValue(undefined);
  mocks.getDoc.mockResolvedValue({ exists: () => false });
});

it("does not report a created identity as failed when its optional name update fails", async () => {
  mocks.update.mockRejectedValue(new Error("Network lost after account creation"));
  expect(await createHostAccount(" qa@example.test ", "local-test-password", " QA Host ")).toEqual({ status: "success" });
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(mocks.setDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ displayName: "QA Host", email: "qa@example.test" }));
});

it("does not strand an existing identity when its profile document cannot be written", async () => {
  mocks.setDoc.mockRejectedValue(new Error("Firestore unavailable"));
  expect(await createHostAccount("qa@example.test", "local-test-password", "QA Host")).toEqual({ status: "success" });
});

it("still reports a rejected identity creation without attempting profile writes", async () => {
  mocks.create.mockRejectedValue({ code: "auth/email-already-in-use" });
  expect(await createHostAccount("qa@example.test", "local-test-password", "QA Host")).toMatchObject({ status: "error", message: expect.stringMatching(/already exists/) });
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.setDoc).not.toHaveBeenCalled();
});

it("clears the previous host's placard name, private stay link and Wi-Fi on sign-out", async () => {
  window.history.replaceState(null, "", "/qr-sign-maker?from=property");
  handOffToSignMaker({ ownerUid: "host-a", name: "Private cottage", link: "https://example.test/stay/private/secret", wifi: { network: "Private", password: "private-password" }, backHref: "/host/property/private/qr" });
  expect(takeSignPrefill("host-a")?.wifi?.password).toBe("private-password");
  expect(takeSignPrefill("host-b")).toBeNull();
  await signOutHost();
  expect(takeSignPrefill("host-a")).toBeNull();
});
