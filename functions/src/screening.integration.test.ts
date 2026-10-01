import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ fetch: vi.fn(), download: vi.fn() }));
vi.mock("firebase-admin/app", () => ({
  applicationDefault: () => ({ getAccessToken: async () => ({ access_token: "test-token" }) })
}));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({ bucket: () => ({ file: () => ({ download: state.download }) }) })
}));

import { screenContent } from "./screening";

const clearPhoto = { adult: "VERY_UNLIKELY", spoof: "VERY_UNLIKELY", medical: "UNLIKELY", violence: "UNLIKELY", racy: "UNLIKELY" };
const flaggedPhoto = { ...clearPhoto, adult: "LIKELY" };

beforeEach(() => {
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
});
