/**
 * What leaves the device when a Host chooses a photograph.
 *
 * A phone takes a 4000px, 3–8MB picture; no wall ever draws one wider than
 * about 1200px, so uploading the original spends thirty seconds of a Host's
 * time sending bytes that are thrown away on arrival. The file is redrawn at
 * the size it will actually be seen at before it is sent, which is nearly all
 * of the wait.
 *
 * A browser that cannot do this — no `createImageBitmap`, no canvas, an image
 * it will not decode — uploads the original untouched. A slow upload is worse
 * than a fast one; a refused upload is worse than both.
 */

/** The longest edge any wall draws, with room to spare for a retina screen. */
export const photoLongEdgeMax = 1600;

/**
 * Below this a file is left exactly as it is. Re-encoding a small photograph
 * costs a decode, a draw and a generation of quality loss to save a few
 * kilobytes that were never the reason anyone was waiting.
 */
const KEEP_BYTES = 600 * 1024;

/** Good enough that the difference is invisible on a wall, at a third the bytes. */
const QUALITY = 0.82;

export type PreparedPhoto = {
  /** The bytes to upload: the original file, or a smaller re-encoding of it. */
  blob: Blob;
  contentType: string;
  /**
   * Intrinsic size of what is being uploaded, so a wall can reserve the space
   * and not reflow around a photograph arriving on a slow connection. Zero
   * when the browser would not decode the file — the wall then falls back to
   * its own aspect ratio rather than blocking the Host on a measurement.
   */
  width: number;
  height: number;
};

/**
 * The same picture, no longer than `longEdge` on either side.
 *
 * Rounded rather than floored so a 1601px edge does not come back 1599px, and
 * never returned as zero: a canvas of zero width throws.
 */
export function fitWithin(
  width: number,
  height: number,
  longEdge: number
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= longEdge || longest === 0) return { width, height };
  const scale = longEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

/** Storage accepts these three; anything else is refused before it is chosen. */
function encodesTo(canvas: HTMLCanvasElement): "image/webp" | "image/jpeg" {
  // Safari only learned to write WebP in 14, and `toDataURL` is the cheap way
  // to ask: a browser that cannot write the type asked for answers in PNG,
  // which is the one format that would make the file bigger.
  return canvas.toDataURL("image/webp").startsWith("data:image/webp")
    ? "image/webp"
    : "image/jpeg";
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/**
 * Decode, shrink and re-encode — or hand back the original if any of that is
 * unavailable or would not help.
 */
export async function preparePhoto(
  file: File,
  longEdge: number = photoLongEdgeMax
): Promise<PreparedPhoto> {
  const original: PreparedPhoto = {
    blob: file,
    contentType: file.type,
    width: 0,
    height: 0
  };
  if (typeof createImageBitmap !== "function") return original;

  let bitmap: ImageBitmap;
  try {
    // `from-image` bakes in the EXIF rotation a phone records rather than
    // applies. An `<img>` honours that tag on its own; a canvas does not, so
    // without this every photograph taken sideways would upload sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return original;
  }

  const size = fitWithin(bitmap.width, bitmap.height, longEdge);
  const measured = { ...original, width: bitmap.width, height: bitmap.height };
  const unchanged = size.width === bitmap.width && size.height === bitmap.height;
  if (unchanged && file.size <= KEEP_BYTES) {
    bitmap.close?.();
    return measured;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) return measured;

    const contentType = encodesTo(canvas);
    // JPEG has no transparency, and an unpainted canvas is transparent black:
    // a PNG with a clear background would arrive as a black one without this.
    if (contentType === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size.width, size.height);
    }
    context.drawImage(bitmap, 0, 0, size.width, size.height);

    const blob = await toBlob(canvas, contentType);
    // A re-encoding that came back larger than what was chosen is not worth
    // the quality it cost; the original goes instead.
    if (!blob || blob.size >= file.size) return measured;
    return { blob, contentType, width: size.width, height: size.height };
  } catch {
    return measured;
  } finally {
    bitmap.close?.();
  }
}
