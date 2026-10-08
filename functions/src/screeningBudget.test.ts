import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ documents: new Map<string, any>(), queue: Promise.resolve(), warn: vi.fn() }));
vi.mock("firebase-functions/logger", () => ({ warn: state.warn }));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "timestamp" },
  getFirestore: () => ({
    doc: (path: string) => ({ id: path.split("/").at(-1), path, get: async () => ({ get: (key: string) => state.documents.get(path)?.[key] }) }),
    runTransaction: (callback: any) => {
      const result = state.queue.then(() => callback({
        get: async (ref: any) => ({ data: () => state.documents.get(ref.path) }),
        set: (ref: any, value: any) => state.documents.set(ref.path, { ...state.documents.get(ref.path), ...value })
      }));
      state.queue = result.catch(() => undefined);
      return result;
    }
  })
}));
import { reserveScreeningAttempt, screeningCapacityAvailable, screeningDay, ScreeningBudgetReached } from "./screeningBudget";
beforeEach(() => { state.documents.clear(); state.queue = Promise.resolve(); state.warn.mockReset(); vi.stubEnv("FUNCTIONS_EMULATOR", "false"); });
describe("daily screening allowance", () => {
  it("admits only 100 concurrent attempts and warns exactly at 75", async () => {
    const results = await Promise.allSettled(Array.from({ length: 125 }, () => reserveScreeningAttempt("memory", "Hello", 2)));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(100);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(25);
    expect(state.warn).toHaveBeenCalledTimes(1);
    expect(state.warn.mock.calls[0][1]).toMatchObject({ attempts: 75, remaining: 25 });
    expect(await screeningCapacityAvailable()).toBe(false);
    expect([...state.documents.values()][0]).toMatchObject({ attempts: 100, photoChecksReserved: 200, textUnitsReserved: 100 });
  });
  it("shares capacity between feedback and memory, without provider use after exhaustion", async () => {
    await reserveScreeningAttempt("feedback", "x".repeat(101));
    await reserveScreeningAttempt("memory", "", 10);
    const data = [...state.documents.values()][0];
    expect(data).toMatchObject({ attempts: 2, feedback: 1, memory: 1, textUnitsReserved: 2, photoChecksReserved: 10 });
    data.attempts = 100;
    await expect(reserveScreeningAttempt("feedback", "Hello")).rejects.toBeInstanceOf(ScreeningBudgetReached);
  });
  it("resets on Sydney midnight including daylight saving", () => {
    expect(screeningDay(new Date("2026-10-02T13:59:59Z"))).toBe("2026-10-02");
    expect(screeningDay(new Date("2026-10-02T14:00:00Z"))).toBe("2026-10-03");
    expect(screeningDay(new Date("2026-10-04T13:00:00Z"))).toBe("2026-10-05");
  });
});
