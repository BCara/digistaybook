import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ fetch: vi.fn(), download: vi.fn(), info: vi.fn(), warn: vi.fn() }));
vi.mock("firebase-functions/logger", () => ({ info: state.info, warn: state.warn }));
vi.mock("./screeningBudget.js", () => ({ reserveScreeningAttempt: vi.fn() }));
vi.mock("firebase-admin/app", () => ({
  applicationDefault: () => ({ getAccessToken: async () => ({ access_token: "test-token" }) })
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({ file: () => ({ download: state.download }) }) })
}));

import { screenContent } from "./screening";
import { reserveScreeningAttempt } from "./screeningBudget";
import { withScreeningDiagnostics } from "./screeningDiagnostics";

const clearPhoto = { adult: "VERY_UNLIKELY", spoof: "VERY_UNLIKELY", medical: "UNLIKELY", violence: "UNLIKELY", racy: "UNLIKELY" };
const flaggedPhoto = { ...clearPhoto, adult: "LIKELY" };

beforeEach(() => {
  state.info.mockReset(); state.warn.mockReset();
  vi.mocked(reserveScreeningAttempt).mockReset();
  vi.stubEnv("FUNCTIONS_EMULATOR", "false");
  vi.stubEnv("GCLOUD_PROJECT", "demo-digistaybook");
  vi.stubGlobal("fetch", state.fetch);
  state.download.mockResolvedValue([Buffer.from("photo-bytes")]);
  state.fetch.mockImplementation(async (url: string) => {
    if (url.includes("vision.googleapis.com")) return new Response(JSON.stringify({ responses: [{ safeSearchAnnotation: clearPhoto }] }));
    return new Response(JSON.stringify({ moderationCategories: [] }));
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); state.fetch.mockReset(); state.download.mockReset(); });

describe("connected wall memory screening", () => {
  it("contacts neither provider when the daily allowance cannot be reserved", async () => {
    vi.mocked(reserveScreeningAttempt).mockRejectedValue(new Error("Daily allowance reached"));
    await expect(screenContent({ message: "Hello", photos: [{ bucket: "guest-quarantine", path: "photo.webp" }] })).rejects.toThrow("Daily allowance reached");
    expect(state.fetch).not.toHaveBeenCalled();
    expect(state.download).not.toHaveBeenCalled();
  });
  it("cannot clear a memory on missing text moderation categories", async () => {
    state.fetch.mockResolvedValue(new Response(JSON.stringify({})));
    await expect(screenContent({ message: "Hello", photos: [] })).rejects.toThrow("Incomplete text moderation response");
  });
  it("records real category results with the reference but never the test text or photo bytes", async () => {
    await withScreeningDiagnostics("private-guest-id", 1, () => screenContent({ message: "Private test message", photos: [{ bucket: "guest-quarantine", path: "private-photo-path" }] }));
    const events = state.info.mock.calls.map(call => call[1]);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: "screening_text_result", endpointRegion: "au", categories: [] }),
      expect.objectContaining({ event: "screening_photo_result", endpointRegion: "eu", categories: clearPhoto, photoIndex: 0 }),
      expect.objectContaining({ event: "screening_provider_decision", outcome: "clear" })
    ]));
    const text = JSON.stringify(events);
    for (const excluded of ["Private test message", "private-guest-id", "private-photo-path", "photo-bytes", "test-token"]) expect(text).not.toContain(excluded);
  });
  it("checks both the Sydney photo bytes and Australian wall text before clearing", async () => {
    await expect(screenContent({ message: "A lovely stay", photos: [{ bucket: "guest-quarantine", path: "photo.webp" }] }))
      .resolves.toEqual({ outcome: "clear" });
    expect(state.download).toHaveBeenCalledTimes(1);
    expect(state.fetch).toHaveBeenCalledTimes(2);
    expect(state.fetch.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining([
      "https://eu-vision.googleapis.com/v1/projects/demo-digistaybook/locations/eu/images:annotate",
      "https://au-language.googleapis.com/v2/documents:moderateText"
    ]));
  });

  it("holds a flagged provider result for host review", async () => {
    state.fetch.mockImplementation(async (url: string) => url.includes("vision.googleapis.com")
      ? new Response(JSON.stringify({ responses: [{ safeSearchAnnotation: flaggedPhoto }] }))
      : new Response(JSON.stringify({ moderationCategories: [] })));
    await expect(screenContent({ message: "A lovely stay", photos: [{ bucket: "guest-quarantine", path: "photo.webp" }] }))
      .resolves.toEqual({ outcome: "standard" });
  });

  it("holds a provider text category for host review", async () => {
    state.fetch.mockImplementation(async (url: string) => url.includes("vision.googleapis.com")
      ? new Response(JSON.stringify({ responses: [{ safeSearchAnnotation: clearPhoto }] }))
      : new Response(JSON.stringify({ moderationCategories: [{ name: "Toxic", confidence: 0.8 }] })));
    await expect(screenContent({ message: "A message", photos: [{ bucket: "guest-quarantine", path: "photo.webp" }] }))
      .resolves.toEqual({ outcome: "standard" });
  });

  it.each([clearPhoto, flaggedPhoto])("routes a serious text flag to safety review regardless of the photo result", async photo => {
    state.fetch.mockImplementation(async (url: string) => url.includes("vision.googleapis.com")
      ? new Response(JSON.stringify({ responses: [{ safeSearchAnnotation: photo }] }))
      : new Response(JSON.stringify({ moderationCategories: [{ name: "Violent", confidence: 0.9 }, { name: "Profanity", confidence: 0.99 }] })));
    await expect(screenContent({ message: "Synthetic threat fixture", photos: [{ bucket: "guest-quarantine", path: "photo.webp" }] }))
      .resolves.toEqual({ outcome: "critical", categories: ["Violent"] });
  });
});
