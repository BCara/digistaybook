import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ records: new Map<string, any>() }));
vi.mock("firebase-functions/logger", () => ({ error: vi.fn(), info: vi.fn() }));
vi.mock("firebase-functions/params", () => ({ defineSecret: (name: string) => ({ value: () => `test-${name}` }), }));
vi.mock("firebase-admin/firestore", () => {
  const ref = (path: string) => ({ path, set: async (data: any) => mock.records.set(path, { ...mock.records.get(path), ...data }) });
  return { FieldValue: { serverTimestamp: () => "now" }, Timestamp: { fromMillis: (millis: number) => ({ toMillis: () => millis }) },
    getFirestore: () => ({ doc: ref, runTransaction: async (fn: any) => fn({
      get: async (r: any) => ({ get: (key: string) => mock.records.get(r.path)?.[key] }),
      set: (r: any, data: any) => mock.records.set(r.path, { ...mock.records.get(r.path), ...data })
    }) }) };
});
import { ownerReportContent, sendOwnerDailyReport, type SendDeps } from "./ownerDailyReport";
import { buildSummary, type Snapshot } from "./portfolioSummary";

const HOUR = 3_600_000, FROM = Date.UTC(2026, 10, 8, 13), TO = FROM + 24 * HOUR;
const empty = (): Snapshot => ({ accounts: [], properties: [], contributions: [], contributionTotals: {}, ledger: [], cancellations: [], awaitingHost: [], safetyQueue: [] });
const deliver = vi.fn(async () => "provider-1");
const load = vi.fn(async () => empty());
const deps = (to = "owner@ops.example"): SendDeps => ({ to: () => to, load, deliver, extra: () => [] });
// 00:30 on 10 Nov in Sydney.
const run = TO + 30 * 60_000;

beforeEach(() => { mock.records.clear(); deliver.mockClear(); load.mockClear(); deliver.mockResolvedValue("provider-1"); });

describe("owner daily report", () => {
  it("sends yesterday's report once, keyed by the Sydney date", async () => {
    await expect(sendOwnerDailyReport(run, deps())).resolves.toEqual({ status: "sent", date: "2026-11-09" });
    expect(load).toHaveBeenCalledWith("2026-11-09");
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver.mock.calls[0][0]).toMatchObject({ to: "owner@ops.example", idempotencyKey: "owner-daily-2026-11-09" });
    expect(mock.records.get("ownerDailyReports/2026-11-09")).toMatchObject({ status: "sent", providerId: "provider-1" });
  });
  it("does not send a second time the same day", async () => {
    await sendOwnerDailyReport(run, deps());
    await expect(sendOwnerDailyReport(run + 3 * HOUR, deps())).resolves.toEqual({ status: "already_sent", date: "2026-11-09" });
    expect(deliver).toHaveBeenCalledTimes(1);
  });
  it("leaves a run that is still sending alone, and takes over one that died", async () => {
    mock.records.set("ownerDailyReports/2026-11-09", { status: "sending", claimedAt: { toMillis: () => run - 60_000 } });
    await expect(sendOwnerDailyReport(run, deps())).resolves.toMatchObject({ status: "already_sent" });
    mock.records.set("ownerDailyReports/2026-11-09", { status: "sending", claimedAt: { toMillis: () => run - 60 * 60_000 }, attempts: 1 });
    await expect(sendOwnerDailyReport(run, deps())).resolves.toMatchObject({ status: "sent" });
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(mock.records.get("ownerDailyReports/2026-11-09").attempts).toBe(2);
  });
  it("records a failure and lets the retry send it", async () => {
    deliver.mockRejectedValueOnce(new Error("mail-provider-500"));
    await expect(sendOwnerDailyReport(run, deps())).rejects.toThrow("mail-provider-500");
    expect(mock.records.get("ownerDailyReports/2026-11-09")).toMatchObject({ status: "failed" });
    await expect(sendOwnerDailyReport(run + 300_000, deps())).resolves.toMatchObject({ status: "sent" });
    expect(deliver).toHaveBeenCalledTimes(2);
  });
  it("sends nothing and records nothing when no address is configured", async () => {
    await expect(sendOwnerDailyReport(run, deps("  "))).resolves.toEqual({ status: "no_address" });
    expect(deliver).not.toHaveBeenCalled(); expect(load).not.toHaveBeenCalled(); expect(mock.records.size).toBe(0);
  });
  it("lists host sign-ups and escapes them in the HTML", () => {
    const snapshot = empty();
    snapshot.accounts = [{ uid: "a", name: "<Sam>", email: "sam@gmail.com", createdAt: FROM + HOUR }];
    const content = ownerReportContent(buildSummary(snapshot, "2026-11-09", run));
    expect(content.subject).toBe("DigiStayBook 2026-11-09: 1 sign-up, 0 new properties");
    expect(content.text).toContain("- <Sam> <sam@gmail.com>");
    expect(content.html).toContain("&lt;Sam&gt;");
    expect(content.text).toContain("Revenue is not available");
  });
});
