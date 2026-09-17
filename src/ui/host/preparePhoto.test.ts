import { describe, expect, it, vi } from "vitest";
import { fitWithin, photoLongEdgeMax, preparePhoto } from "./preparePhoto";

function file(bytes: number, type = "image/jpeg"): File {
  return new File([new Uint8Array(bytes)], "cottage.jpg", { type });
}

describe("fitWithin", () => {
  it("leaves a picture that is already small enough alone", () => {
    expect(fitWithin(1200, 800, 1600)).toEqual({ width: 1200, height: 800 });
  });

  it("puts the longest edge on the limit, whichever edge that is", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("never returns an edge of zero, which no canvas can be drawn at", () => {
    expect(fitWithin(4000, 3, 1600)).toEqual({ width: 1600, height: 1 });
  });
});

describe("preparePhoto", () => {
  it("uploads the original when the browser cannot decode images here", async () => {
    // jsdom implements no `createImageBitmap`, which is the case this stands
    // in for: a slow upload is better than a refused one.
    const chosen = file(9);
    const prepared = await preparePhoto(chosen);
    expect(prepared.blob).toBe(chosen);
    expect(prepared.contentType).toBe("image/jpeg");
    expect(prepared).toMatchObject({ width: 0, height: 0 });
  });

  it("leaves a small photograph exactly as it was chosen", async () => {
    const bitmap = { width: 900, height: 600, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    try {
      const chosen = file(120 * 1024);
      const prepared = await preparePhoto(chosen);
      // Re-encoding it would cost a generation of quality to save nothing.
      expect(prepared.blob).toBe(chosen);
      // It was decoded, so the wall can still reserve the right shape.
      expect(prepared).toMatchObject({ width: 900, height: 600 });
      expect(bitmap.close).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the original when the canvas cannot be drawn on", async () => {
    const bitmap = { width: 4000, height: 3000, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const context = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    try {
      const chosen = file(4 * 1024 * 1024);
      const prepared = await preparePhoto(chosen);
      expect(prepared.blob).toBe(chosen);
      // The measurement survives even when the shrink does not.
      expect(prepared).toMatchObject({ width: 4000, height: 3000 });
    } finally {
      context.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("sends a smaller re-encoding of a photograph off a phone", async () => {
    const bitmap = { width: 4032, height: 3024, close: vi.fn() };
    const smaller = new Blob([new Uint8Array(180 * 1024)], { type: "image/webp" });
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const canvas = HTMLCanvasElement.prototype;
    const context = vi.spyOn(canvas, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: ""
    } as unknown as CanvasRenderingContext2D);
    const url = vi.spyOn(canvas, "toDataURL").mockReturnValue("data:image/webp;base64,");
    const blob = vi
      .spyOn(canvas, "toBlob")
      .mockImplementation((callback) => callback(smaller));
    try {
      const prepared = await preparePhoto(file(6 * 1024 * 1024));
      expect(prepared.blob).toBe(smaller);
      expect(prepared.contentType).toBe("image/webp");
      // The long edge lands on the limit and the shape is kept.
      expect(prepared.width).toBe(photoLongEdgeMax);
      expect(prepared.height).toBe(1200);
    } finally {
      blob.mockRestore();
      url.mockRestore();
      context.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
