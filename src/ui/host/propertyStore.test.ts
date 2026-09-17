import { emptyProfile } from "../../domain/propertyProfile";
import { createProperty, describeStoreError, savePropertyProfile } from "./propertyStore";

const updateDoc = vi.fn().mockResolvedValue(undefined);
const callProperty = vi.fn();
vi.mock("../../lib/firebase", () => ({ getFirebaseServices: async () => ({ firestore: {}, functions: {}, auth: { currentUser: { uid: "host-a" } } }) }));
vi.mock("firebase/functions", () => ({ httpsCallable: () => callProperty }));
vi.mock("firebase/firestore", () => ({
  doc: (...parts: unknown[]) => parts,
  serverTimestamp: () => "server-time",
  updateDoc: (...args: unknown[]) => updateDoc(...args)
}));

it("writes theme and wall visibility without overwriting independently saved photos", async () => {
  const profile = { ...emptyProfile(), theme: "studio" as const, displayWallOff: true };
  const result = await savePropertyProfile("p1", profile);
  expect(result.status).toBe("ok");
  const fields = updateDoc.mock.calls.at(-1)![1];
  expect(fields["profile.theme"]).toBe("studio");
  expect(fields["profile.displayWallOff"]).toBe(true);
  expect(fields).not.toHaveProperty("profile.cover");
  expect(fields).not.toHaveProperty("profile");
});

it.each([
  ["functions/already-exists", /address is already taken/],
  ["functions/unauthenticated", /verify your session/],
  ["functions/invalid-argument", /property name and details/],
  ["functions/unavailable", /check your connection/],
  ["functions/not-found", /Property creation is temporarily unavailable/],
  ["functions/deadline-exceeded", /check before trying again/],
  ["functions/internal", /reach or complete property creation/]
])("reports an actionable creation failure for %s", async (code, expected) => {
  callProperty.mockRejectedValueOnce({ code, message: "Private backend details" });
  const result = await createProperty("host-a", { name: "Test cottage", slug: "test-cottage" });
  expect(result.status).toBe("error");
  if (result.status === "error") {
    expect(result.message).toMatch(expected);
    expect(result.message).not.toContain("Private backend details");
  }
});

it("keeps unknown backend details out of the displayed error", () => {
  expect(describeStoreError({ code: "unknown", message: "Private backend details" })).toEqual({
    status: "error",
    message: "We couldn’t complete that request. Please try again. If this continues, contact support."
  });
});
