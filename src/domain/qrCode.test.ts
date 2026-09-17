import { qrCanvasSize, qrMatrix, qrPath, qrQuietZone, stayWallUrl } from "./qrCode";

const finder = (modules: boolean[][], top: number, left: number) =>
  Array.from({ length: 7 }, (_, r) => modules[top + r].slice(left, left + 7).map(on => (on ? 1 : 0)).join(""));

// The three corner squares a scanner looks for before it reads anything else.
const finderPattern = ["1111111", "1000001", "1011101", "1011101", "1011101", "1000001", "1111111"];

describe("QR matrices", () => {
  const matrix = qrMatrix("https://digistaybook.example/stay/seabreeze-cottage");

  it("is square, and a real QR version size", () => {
    expect(matrix.modules).toHaveLength(matrix.size);
    for (const row of matrix.modules) expect(row).toHaveLength(matrix.size);
    // Every version is 21 modules plus a multiple of four.
    expect(matrix.size).toBeGreaterThanOrEqual(21);
    expect((matrix.size - 21) % 4).toBe(0);
  });

  it("carries the three finder patterns a scanner locks on to", () => {
    const last = matrix.size - 7;
    expect(finder(matrix.modules, 0, 0)).toEqual(finderPattern);
    expect(finder(matrix.modules, 0, last)).toEqual(finderPattern);
    expect(finder(matrix.modules, last, 0)).toEqual(finderPattern);
  });

  // A placard printed today and one printed next year must be the same card,
  // so nothing about the encoding may be left to chance.
  it("encodes the same address to the same square every time", () => {
    const again = qrMatrix("https://digistaybook.example/stay/seabreeze-cottage");
    expect(again).toEqual(matrix);
  });

  it("grows rather than fails as an address gets longer", () => {
    const long = qrMatrix(`https://digistaybook.example/stay/${"a".repeat(300)}`);
    expect(long.size).toBeGreaterThan(matrix.size);
  });
});

describe("the drawing", () => {
  it("leaves the four modules of quiet zone the specification requires", () => {
    const matrix = qrMatrix("https://example.test/stay/cottage");
    expect(qrQuietZone).toBe(4);
    expect(qrCanvasSize(matrix)).toBe(matrix.size + 8);
    // The top-left finder is inked, so the first run starts exactly one quiet
    // zone in on both axes.
    expect(qrPath(matrix).startsWith("M4 4h7")).toBe(true);
  });

  it("draws a run of inked modules as one rectangle rather than several", () => {
    const matrix = { size: 3, modules: [[true, true, false], [false, false, false], [true, false, true]] };
    expect(qrPath(matrix)).toBe("M4 4h2v1h-2zM4 6h1v1h-1zM6 6h1v1h-1z");
  });

  it("draws nothing for an empty matrix", () => {
    expect(qrPath({ size: 1, modules: [[false]] })).toBe("");
  });
});

describe("the address a placard carries", () => {
  it("points at the in-stay wall, absolutely", () => {
    expect(stayWallUrl("https://digistaybook.example", "seabreeze-cottage"))
      .toBe("https://digistaybook.example/stay/seabreeze-cottage");
  });

  it("does not double the slash when the origin carries one", () => {
    expect(stayWallUrl("https://digistaybook.example/", "cottage"))
      .toBe("https://digistaybook.example/stay/cottage");
  });
});
