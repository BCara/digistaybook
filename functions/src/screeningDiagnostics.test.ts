import { beforeEach, describe, expect, it, vi } from "vitest";
const logs = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn() }));
vi.mock("firebase-functions/logger", () => logs);
import { screeningReference, withScreeningDiagnostics, screeningDiagnostic, screeningError } from "./screeningDiagnostics";
beforeEach(() => { logs.info.mockReset(); logs.warn.mockReset(); });
describe("screening diagnostics", () => {
  it("isolates concurrent submission references and does not disclose IDs", async () => {
    await Promise.all(["anonymous-uid_one", "anonymous-uid_two"].map(id => withScreeningDiagnostics(id, 1, async () => {
      await Promise.resolve();
      screeningDiagnostic("screening_text_result", { categories: [{ name: "Violent", confidence: 0.9 }] });
    })));
    const references = logs.info.mock.calls.map(call => call[1].screeningReference);
    expect(new Set(references).size).toBe(2);
    expect(references).toContain(screeningReference("anonymous-uid_one", 1));
    expect(JSON.stringify(logs.info.mock.calls)).not.toContain("anonymous-uid");
    expect(screeningReference("anonymous-uid_one", 2)).not.toBe(references[0]);
  });
  it("logs sanitised HTTP codes rather than exception bodies or guest content", () => {
    screeningError("guest-id", 1, new Error("moderateText 403"), "memory_pending_private");
    expect(logs.warn.mock.calls[0][1].reason).toBe("provider_http_403");
    screeningError("guest-id", 1, new Error("secret token and private message"), "memory_pending_private");
    expect(logs.warn.mock.calls[1][1].reason).toBe("provider_or_storage_error");
    expect(JSON.stringify(logs.warn.mock.calls)).not.toContain("secret token");
  });
});
