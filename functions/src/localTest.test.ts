import { afterEach, describe, expect, it, vi } from "vitest";
import { localScenario, localTestEnabled } from "./localTest.js";
import { requireOperations } from "./reporting.js";
afterEach(() => vi.unstubAllEnvs());
describe("local Test boundaries", () => {
  it("requires the explicit flag, emulator and exact demo project", () => {
    vi.stubEnv("FUNCTIONS_EMULATOR", "true"); vi.stubEnv("LOCAL_TEST_SCREENING", "true");
    vi.stubEnv("GCLOUD_PROJECT", "demo-digistaybook"); expect(localTestEnabled()).toBe(true);
    vi.stubEnv("GCLOUD_PROJECT", "digistaybook-cbert"); expect(localTestEnabled()).toBe(false);
    vi.stubEnv("GCLOUD_PROJECT", "demo-digistaybook"); vi.stubEnv("FUNCTIONS_EMULATOR", "false"); expect(localTestEnabled()).toBe(false);
  });
  it("never grants simulated reviewer access outside local Test or to ordinary hosts", () => {
    const request = { auth: { uid: "test-operations", token: { admin: true, localTestOperations: true } } } as any;
    vi.stubEnv("FUNCTIONS_EMULATOR", "true"); vi.stubEnv("LOCAL_TEST_SCREENING", "true"); vi.stubEnv("GCLOUD_PROJECT", "demo-digistaybook");
    expect(requireOperations(request)).toBe("test-operations");
    expect(() => requireOperations({auth:{uid:"host",token:{}}} as any)).toThrow();
    vi.stubEnv("GCLOUD_PROJECT", "digistaybook-cbert"); expect(() => requireOperations(request)).toThrow();
    vi.stubEnv("GCLOUD_PROJECT", "demo-digistaybook"); vi.stubEnv("LOCAL_TEST_SCREENING", "false"); expect(() => requireOperations(request)).toThrow();
  });
  it("makes safety and outage take priority over ordinary review", () => {
    expect(localScenario("A nice stay")).toBe("clear"); expect(localScenario("[review] hello")).toBe("standard");
    expect(localScenario("[review] [safety]")).toBe("critical"); expect(localScenario("[safety] [outage]")).toBe("unavailable");
  });
});
