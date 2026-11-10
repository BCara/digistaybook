import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("firebase-functions/logger", () => ({ error: vi.fn(), info: vi.fn() }));
vi.mock("firebase-functions/params", () => ({ defineSecret: (name: string) => ({ value: () => `test-${name}` }), }));
import { buildSummary, handleSummaryRequest, isTestEmail, keyMatches, sydneyMidnight, windowsFor, type Snapshot, type SummaryDeps } from "./portfolioSummary";

const HOUR = 3_600_000;
// 9 Nov 2026 in Sydney is daylight time, UTC+11: it starts at 13:00 UTC on the 8th.
const FROM = Date.UTC(2026, 10, 8, 13), TO = FROM + 24 * HOUR;
const empty = (): Snapshot => ({ accounts: [], properties: [], contributions: [], contributionTotals: {}, ledger: [], cancellations: [], awaitingHost: [], safetyQueue: [] });
const property = (id: string, ownerUid: string, extra: Partial<Snapshot["properties"][number]> = {}) =>
  ({ id, ownerUid, name: `Property ${id}`, slug: `slug-${id}`, createdAt: FROM + HOUR, deleted: false, billingStatus: null, livemode: false, trialEndsAt: null, ...extra });

describe("Sydney reporting window", () => {
  it("runs midnight to midnight Sydney time, matching the contract's example", () => {
    expect(sydneyMidnight("2026-11-09")).toBe(1794142800000);
    expect(windowsFor("2026-11-09").day).toEqual({ from: FROM, to: TO });
  });
  it("is 23 hours when the clocks go forward and 25 when they go back", () => {
    const spring = windowsFor("2026-10-04").day, autumn = windowsFor("2026-04-05").day;
    expect(spring.to - spring.from).toBe(23 * HOUR);
    expect(autumn.to - autumn.from).toBe(25 * HOUR);
    expect(spring.from).toBe(Date.UTC(2026, 9, 3, 14)); // still standard time, UTC+10
  });
  it("puts last7 as the seven days ending on the date and prev7 before it", () => {
    const { last7, prev7 } = windowsFor("2026-11-09");
    expect(last7).toEqual({ from: sydneyMidnight("2026-11-03"), to: TO });
    expect(prev7).toEqual({ from: sydneyMidnight("2026-10-27"), to: sydneyMidnight("2026-11-03") });
  });
  it("counts something at exactly midnight in the day it starts, not the one before", () => {
    const snapshot = empty();
    snapshot.accounts = [
      { uid: "a", name: "At start", email: "a@gmail.com", createdAt: FROM },
      { uid: "b", name: "Last ms", email: "b@gmail.com", createdAt: TO - 1 },
      { uid: "c", name: "Next day", email: "c@gmail.com", createdAt: TO },
      { uid: "d", name: "Day before", email: "d@gmail.com", createdAt: FROM - 1 }
    ];
    const summary = buildSummary(snapshot, "2026-11-09", TO + HOUR);
    expect(summary.signUps.map(item => item.name)).toEqual(["At start", "Last ms"]);
    expect(summary.day.signUps).toBe(2);
    expect(summary.last7.signUps).toBe(3);
    expect(summary).toMatchObject({ from: FROM, to: TO, timezone: "Australia/Sydney", schema: 1, app: "DigiStayBook" });
  });
});

describe("owner and test accounts", () => {
  it.each(["codebertcreations@gmail.com", "Code.Bert.Creations+demo@googlemail.com", "host@example.com", "a@qa.test",
    "someone@digistaybook.com", "real.person+test2@outlook.com", "real+qa@yahoo.com"])("leaves out %s", email => {
    expect(isTestEmail(email)).toBe(true);
  });
  it.each(["sam@gmail.com", "testy@outlook.com", "host@examples.com", "sam+holiday@gmail.com", ""])("keeps %s", email => {
    expect(isTestEmail(email)).toBe(false);
  });
  it("takes extra addresses and domains from configuration", () => {
    expect(isTestEmail("friend@gmail.com", ["friend@gmail.com"])).toBe(true);
    expect(isTestEmail("anyone@agency.com.au", ["@agency.com.au"])).toBe(true);
  });
  it("removes their properties and contributions from every number and list, and counts them", () => {
    const snapshot = empty();
    snapshot.accounts = [{ uid: "real", name: "Sam Lee", email: "sam@gmail.com", createdAt: FROM + HOUR },
      { uid: "owner", name: "Owner", email: "clb.bertram@gmail.com", createdAt: FROM + HOUR }];
    snapshot.properties = [property("p1", "real"), property("p2", "owner"), property("demo", "real", { slug: "demo-cottage" })];
    snapshot.contributions = [{ propertyId: "p1", createdAt: FROM + 2 * HOUR, status: "pending" }, { propertyId: "p2", createdAt: FROM + 2 * HOUR, status: "published" },
      { propertyId: "demo", createdAt: FROM + 2 * HOUR, status: "feedback" }, { propertyId: "p1", createdAt: FROM + 2 * HOUR, status: "uploading" }];
    snapshot.contributionTotals = { p1: 4, p2: 10, demo: 7 };
    snapshot.safetyQueue = [{ propertyId: "p2" }, { propertyId: "p1" }, { propertyId: null }];
    const summary = buildSummary(snapshot, "2026-11-09", TO);
    expect(summary.signUps).toEqual([{ name: "Sam Lee", email: "sam@gmail.com", createdAt: FROM + HOUR }]);
    expect(summary.newEvents.map(item => item.name)).toEqual(["Property p1"]);
    expect(summary.day).toMatchObject({ signUps: 1, newEvents: 1, uploads: 1 });
    expect(summary.totals).toEqual({ accounts: 1, events: 1, uploads: 4, upgrades: 0 });
    expect(summary.testExcluded).toEqual({ accounts: 1, events: 2 });
    expect(summary.extra.awaitingModeration.safetyTeam).toBe(2);
  });
});

describe("numbers the app cannot supply", () => {
  it("reports revenue, visits and errors as null with a reason, and no dated events", () => {
    const summary = buildSummary(empty(), "2026-11-09", TO);
    for (const window of [summary.day, summary.last7, summary.prev7]) expect(window).toMatchObject({ revenue: null, visits: null, errors: null });
    expect(summary.notes.join(" ")).toMatch(/Revenue is not available/);
    expect(summary.upcomingEvents).toEqual([]);
    expect(summary.labels).toEqual({ events: "properties" });
  });
  it("counts only live-mode subscriptions, and lists trials ending within 14 days", () => {
    const snapshot = empty();
    snapshot.accounts = [{ uid: "h", name: "Jo", email: "jo@gmail.com", createdAt: FROM - 30 * 24 * HOUR }];
    snapshot.properties = [
      property("live", "h", { billingStatus: "active", livemode: true }),
      property("sandbox", "h", { billingStatus: "active", livemode: false }),
      property("trial", "h", { billingStatus: "trialing", livemode: true, trialEndsAt: TO + 3 * 24 * HOUR }),
      property("later", "h", { billingStatus: "trialing", livemode: true, trialEndsAt: TO + 20 * 24 * HOUR })
    ];
    snapshot.ledger = [
      { type: "checkout.session.completed", lifecycle: "trialing", propertyId: "trial", livemode: true, processedAt: FROM + HOUR },
      { type: "checkout.session.completed", lifecycle: "active", propertyId: "sandbox", livemode: false, processedAt: FROM + HOUR },
      { type: "invoice.paid", lifecycle: "active", propertyId: "live", livemode: true, processedAt: FROM + HOUR }
    ];
    snapshot.cancellations = [{ propertyId: "live", at: FROM + HOUR }, { propertyId: "sandbox", at: FROM + HOUR }];
    const summary = buildSummary(snapshot, "2026-11-09", TO);
    expect(summary.day.upgrades).toBe(1);
    expect(summary.totals.upgrades).toBe(3);
    expect(summary.extra).toMatchObject({ activeSubscriptions: 1, trialing: 2, sandboxSubscriptions: 1, cancellations: { day: 1, last7: 1 } });
    expect(summary.extra.trialsEndingSoon).toEqual([{ name: "Property trial", host: "Jo", hostEmail: "jo@gmail.com", trialEndsAt: TO + 3 * 24 * HOUR }]);
  });
});

describe("the summary route", () => {
  const response = () => {
    const res: any = { code: 0, body: undefined, headers: {} as Record<string, string>, ended: false };
    res.status = (code: number) => { res.code = code; return res; };
    res.set = (name: string, value: string) => { res.headers[name] = value; return res; };
    res.json = (body: unknown) => { res.body = body; };
    res.end = () => { res.ended = true; };
    return res;
  };
  const load = vi.fn(async () => empty());
  const deps = (key: string): SummaryDeps => ({ key: () => key, load, now: () => TO + 5 * HOUR, extra: () => [] });
  const get = (authorization?: string, query: Record<string, unknown> = {}, method = "GET") => ({ method, headers: { authorization }, query });
  beforeEach(() => load.mockClear());

  it("answers 404 when the key is not configured, even to a caller with a key", async () => {
    const res = response();
    await handleSummaryRequest(get("Bearer anything"), res, deps(""));
    expect(res.code).toBe(404); expect(res.body).toBeUndefined(); expect(load).not.toHaveBeenCalled();
  });
  it("answers 404 when reading the key fails", async () => {
    const res = response();
    await handleSummaryRequest(get("Bearer anything"), res, { ...deps("x"), key: () => { throw new Error("no secret"); } });
    expect(res.code).toBe(404);
  });
  it.each([undefined, "", "Bearer", "Bearer wrong-key", "bearer right-key", "Basic right-key", "Bearer right-key extra"])("refuses %s with 401 and no body", async header => {
    const res = response();
    await handleSummaryRequest(get(header), res, deps("right-key"));
    expect(res.code).toBe(401); expect(res.body).toBeUndefined(); expect(res.ended).toBe(true); expect(load).not.toHaveBeenCalled();
  });
  it("compares keys of different lengths without throwing", () => {
    expect(keyMatches("Bearer short", "a-much-longer-key")).toBe(false);
    expect(keyMatches("Bearer right-key", "right-key")).toBe(true);
  });
  it("defaults to yesterday in Sydney and sends no-store, noindex", async () => {
    const res = response();
    await handleSummaryRequest(get("Bearer right-key"), res, deps("right-key"));
    expect(res.code).toBe(200);
    expect(load).toHaveBeenCalledWith("2026-11-09");
    expect(res.body).toMatchObject({ date: "2026-11-09", from: FROM, to: TO });
    expect(res.headers).toEqual({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
  });
  it("reports the date asked for and rejects one that is not a date", async () => {
    const ok = response(), bad = response();
    await handleSummaryRequest(get("Bearer right-key", { date: "2026-10-04" }), ok, deps("right-key"));
    expect(ok.body).toMatchObject({ date: "2026-10-04" });
    await handleSummaryRequest(get("Bearer right-key", { date: "2026-02-30" }), bad, deps("right-key"));
    expect(bad.code).toBe(400);
  });
  it("refuses other methods once authorised", async () => {
    const res = response();
    await handleSummaryRequest(get("Bearer right-key", {}, "POST"), res, deps("right-key"));
    expect(res.code).toBe(405);
  });
});
