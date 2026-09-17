import qrcode from "qrcode-generator";
import { stayWallPath } from "./wallAddress";

/* ------------------------------- QR codes -------------------------------
   The placard is the product's front door: a guest meets DigiStayBook by
   scanning a square of ink on a card in a kitchen. Encoding that square is
   therefore domain work rather than decoration, and it lives here so the
   screen that shows a Host their placard and the job that one day prints one
   agree on what is in it, down to the module.

   What a code is NOT allowed to do is drift. The in-stay address is fixed at
   creation and immutable to the client (D-012), and error correction is
   pinned below, so the same property encodes to the same square every time —
   a placard printed today and a placard printed next year are the same card.
   ----------------------------------------------------------------------- */

/**
 * Error correction level. `M` recovers about 15% of a damaged code, which is
 * the level a card that will live on a kitchen table, get splashed and get
 * scanned in poor light wants; `L` is smaller but gives a scuffed placard
 * nothing to work with.
 */
const errorCorrection = "M" as const;

/** The quiet zone the QR specification requires: four modules of blank paper
 *  on every side. A code printed flush to an edge is a code that will not
 *  scan. */
export const qrQuietZone = 4;

export type QrMatrix = {
  /** Modules per side, excluding the quiet zone. */
  size: number;
  /** `modules[row][col]` — true where the square is inked. */
  modules: boolean[][];
};

/**
 * Encode a string as a QR matrix. The version is chosen automatically from
 * the length of the data, so a longer wall address simply produces a denser
 * square rather than failing.
 */
export function qrMatrix(data: string): QrMatrix {
  const code = qrcode(0, errorCorrection);
  code.addData(data);
  code.make();

  const size = code.getModuleCount();
  const modules: boolean[][] = [];
  for (let row = 0; row < size; row += 1) {
    const line: boolean[] = [];
    for (let col = 0; col < size; col += 1) line.push(code.isDark(row, col));
    modules.push(line);
  }

  return { size, modules };
}

/**
 * The inked modules as one SVG path, in a coordinate space of one unit per
 * module with the quiet zone already allowed for. One path rather than eight
 * hundred rects: the matrix is drawn on every render of the page, and a
 * thousand DOM nodes to draw one square is a poor trade.
 */
export function qrPath({ size, modules }: QrMatrix): string {
  const parts: string[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!modules[row][col]) continue;
      // Runs of inked modules are drawn as a single wide rectangle, which
      // keeps the path short and closes the hairline gaps that appear between
      // adjacent rectangles when a browser rounds a fractional scale.
      let run = 1;
      while (col + run < size && modules[row][col + run]) run += 1;
      parts.push(`M${col + qrQuietZone} ${row + qrQuietZone}h${run}v1h-${run}z`);
      col += run - 1;
    }
  }
  return parts.join("");
}

/** The side of the drawing including both quiet zones. */
export const qrCanvasSize = (matrix: QrMatrix) => matrix.size + qrQuietZone * 2;

/**
 * The absolute address a placard's code carries: the in-stay wall, which is
 * the only wall a guest holding a phone in the property should land on. The
 * origin is passed in rather than read here so this stays a pure function and
 * so a preview can honestly show the address of the site it is being viewed
 * on.
 *
 * The token is the half of the address that makes the placard worth holding:
 * without it the same slug answers with the public wall, so a code printed
 * before a property had one would scan to a wall with no house on it.
 */
export const stayWallUrl = (origin: string, slug: string, token?: string | null) =>
  `${origin.replace(/\/+$/, "")}${stayWallPath(slug, token)}`;
