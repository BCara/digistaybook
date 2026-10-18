import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ lookup: vi.fn(), user: vi.fn(), reset: vi.fn(), verify: vi.fn(), fetch: vi.fn(), records: new Map<string, any>() }));
vi.mock("firebase-functions/logger", () => ({ error: vi.fn(), info: vi.fn() }));
vi.mock("firebase-functions/params", () => ({ defineSecret: (name: string) => ({ value: () => `test-${name}` }) }));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ getUserByEmail: mock.lookup, getUser: mock.user, generatePasswordResetLink: mock.reset, generateEmailVerificationLink: mock.verify }) }));
vi.mock("firebase-admin/firestore", () => {
  const ref = (path: string) => ({ path, id: path.split("/").pop(), update: async (data: any) => mock.records.set(path, { ...mock.records.get(path), ...data }) });
  return { Timestamp: { fromMillis: (millis: number) => millis }, getFirestore: () => ({ doc: ref, runTransaction: async (fn: any) => fn({
    get: async (r: any) => ({ exists: mock.records.has(r.path), get: (key: string) => mock.records.get(r.path)?.[key] }),
    set: (r: any, data: any) => mock.records.set(r.path, data), create: (r: any, data: any) => mock.records.set(r.path, data)
  }) }) };
});
import { authEmailContent, brandedActionLink, sendAccountVerification, sendPasswordReset } from "./authEmails";
const request = (data: any, auth?: any, ip = "127.0.0.1") => ({ data: { requestId: "request-0000000001", ...data }, auth, rawRequest: { ip } }) as any;
const user = { uid: "host-a", email: "host@example.test", emailVerified: false, disabled: false };
beforeEach(() => {
  vi.clearAllMocks(); mock.records.clear(); vi.stubGlobal("fetch", mock.fetch);
  mock.lookup.mockResolvedValue(user); mock.user.mockResolvedValue(user);
  mock.reset.mockResolvedValue("https://project.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=private-code&apiKey=irrelevant");
  mock.verify.mockResolvedValue("https://project.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=private-code&apiKey=irrelevant");
  mock.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "provider-id" }) });
});

it.each(["resetPassword", "verifyEmail"] as const)("uses only our domain and a short button label for %s", kind => {
  const link = brandedActionLink(`https://project.firebaseapp.com/__/auth/action?mode=${kind}&oobCode=secure-code&apiKey=key`, kind);
  expect(link).toBe(`https://digistaybook.com/${kind === "resetPassword" ? "reset-password" : "verify-email"}?oobCode=secure-code`);
  const content = authEmailContent(kind, link);
  expect(content.html).not.toContain("firebaseapp.com"); expect(content.html).not.toContain(">https://digistaybook.com/reset-password?");
  expect(content.html).toContain(kind === "resetPassword" ? ">Reset your password</a>" : ">Verify your email</a>");
  expect(content.text).toContain(link);
});
it("rejects missing codes or mismatched action modes", () => {
  expect(() => brandedActionLink("https://example.test?mode=resetPassword", "resetPassword")).toThrow();
  expect(() => brandedActionLink("https://example.test?mode=verifyEmail&oobCode=code", "resetPassword")).toThrow();
});
it("sends reset through the branded sender exactly once per request without saving codes", async () => {
  const req = request({ email: " HOST@example.test " });
  await expect(sendPasswordReset.run(req)).resolves.toEqual({ ok: true });
  await sendPasswordReset.run(req);
  expect(mock.fetch).toHaveBeenCalledTimes(1); expect(mock.lookup).toHaveBeenCalledWith("host@example.test");
  const payload = JSON.parse(mock.fetch.mock.calls[0][1].body);
  expect(payload.from).toBe("DigiStayBook <noreply@digistaybook.com>");
  expect(payload.to).toEqual(["host@example.test"]); expect(payload.html).toContain("https://digistaybook.com/reset-password?oobCode=private-code");
  expect(JSON.stringify([...mock.records])).not.toContain("private-code"); expect(JSON.stringify([...mock.records])).not.toContain("host@example.test");
});
it("acknowledges unknown addresses and delivery failures identically", async () => {
  mock.lookup.mockRejectedValueOnce({ code: "auth/user-not-found" });
  const unknown = await sendPasswordReset.run(request({ email: "unknown@example.test" }));
  mock.fetch.mockResolvedValueOnce({ ok: false, status: 403 });
  const failed = await sendPasswordReset.run(request({ email: "host@example.test", requestId: "request-0000000002" }));
  expect(failed).toEqual(unknown); expect([...mock.records.values()].some(r => r.status === "failed")).toBe(true);
});
it("limits recipient and IP attempts before contacting the provider", async () => {
  for (let i = 0; i < 8; i++) await sendPasswordReset.run(request({ email: user.email, requestId: `request-00000000${i}` }));
  expect(mock.fetch).toHaveBeenCalledTimes(3);
  for (let i = 0; i < 5; i++) await sendPasswordReset.run(request({ email: `other${i}@example.test`, requestId: `request-other000${i}` }));
  expect(mock.fetch).toHaveBeenCalledTimes(5);
});
it("requires a non-anonymous session and ignores a forged verification recipient", async () => {
  await expect(sendAccountVerification.run(request({ email: "victim@example.test" }))).rejects.toMatchObject({ code: "unauthenticated" });
  await expect(sendAccountVerification.run(request({}, { uid: user.uid, token: { firebase: { sign_in_provider: "anonymous" } } }))).rejects.toMatchObject({ code: "unauthenticated" });
  const auth = { uid: user.uid, token: {} };
  await sendAccountVerification.run(request({ email: "victim@example.test" }, auth));
  expect(mock.user).toHaveBeenCalledWith(user.uid); expect(mock.verify).toHaveBeenCalledWith(user.email);
  expect(JSON.parse(mock.fetch.mock.calls[0][1].body).to).toEqual([user.email]);
});
it("never sends verification for a changed identity or a disabled account", async () => {
  mock.lookup.mockResolvedValueOnce({ ...user, uid: "host-b" });
  await expect(sendAccountVerification.run(request({}, { uid: user.uid, token: {} }))).rejects.toMatchObject({ code: "unavailable" });
  expect(mock.fetch).not.toHaveBeenCalled();
  mock.lookup.mockResolvedValueOnce({ ...user, disabled: true });
  await sendPasswordReset.run(request({ email: user.email, requestId: "request-disabled000" }));
  expect(mock.fetch).not.toHaveBeenCalled();
});
it("rejects malformed requests before reading accounts", async () => {
  await expect(sendPasswordReset.run(request({ email: "invalid" }))).rejects.toMatchObject({ code: "invalid-argument" });
  await expect(sendPasswordReset.run(request({ email: user.email, requestId: "bad" }))).rejects.toMatchObject({ code: "invalid-argument" });
  expect(mock.lookup).not.toHaveBeenCalled();
});
