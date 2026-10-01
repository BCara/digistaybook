import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scanMemoryPhoto } from "./visionScreening";
import { screenContent } from "./screening";

vi.mock("firebase-admin/app", () => ({ applicationDefault: () => ({ getAccessToken: async () => ({ access_token: "test-token" }) }) }));
const annotation = { adult: "VERY_UNLIKELY", spoof: "UNLIKELY", medical: "UNLIKELY", violence: "VERY_UNLIKELY", racy: "POSSIBLE" };
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv("GCLOUD_PROJECT", "demo-digistaybook");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("EU SafeSearch transport", () => {
  it("sends only photo bytes for synchronous SafeSearch to the EU endpoint", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ responses: [{ safeSearchAnnotation: annotation }] })));
    const image = Buffer.from("synthetic-photo-bytes");
    expect(await scanMemoryPhoto(image)).toEqual(annotation);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://eu-vision.googleapis.com/v1/projects/demo-digistaybook/locations/eu/images:annotate");
    expect(request.redirect).toBe("error");
    expect(JSON.parse(request.body)).toEqual({ requests: [{ image: { content: image.toString("base64") }, features: [{ type: "SAFE_SEARCH_DETECTION" }] }] });
  });

  it("fails without retrying another region on provider errors", async () => {
    fetchMock.mockResolvedValue(new Response("provider details", { status: 503 }));
    await expect(scanMemoryPhoto(Buffer.from("photo"))).rejects.toThrow("SafeSearch HTTP 503");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { responses: [] },
    { responses: [{}] },
    { responses: [{ error: { code: 3 }, safeSearchAnnotation: annotation }] },
    { responses: [{ safeSearchAnnotation: { ...annotation, adult: "UNKNOWN" } }] },
    { responses: [{ safeSearchAnnotation: { adult: "UNLIKELY" } }] }
  ])("fails on missing, unknown or errored annotations", async body => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body)));
    await expect(scanMemoryPhoto(Buffer.from("photo"))).rejects.toThrow();
  });

  it("keeps publication closed while category mappings are pending", async () => {
    expect(await screenContent({ message: "Lovely stay", photos: [] })).toEqual({ outcome: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
