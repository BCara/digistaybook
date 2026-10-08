/** Layout and colour are independent; every wall and preview uses the same CSS tokens. */
export type WallThemeId = "linen" | "studio" | "archive";
export type WallColourId = "sand" | "sage" | "ocean";
export type WallTheme = { id: WallThemeId; name: string; note: string };
export const wallThemes: readonly WallTheme[] = [
  { id: "linen", name: "Linen", note: "Soft paper, elegant serif headings and gently rounded cards." },
  { id: "studio", name: "Studio", note: "Clean typography, airy spacing and smooth, rounded cards." },
  { id: "archive", name: "Archive", note: "Editorial headings, fine borders and neatly squared cards." }
];
export const wallColours: readonly { id: WallColourId; name: string }[] = [
  { id: "sand", name: "Sand" }, { id: "sage", name: "Sage" }, { id: "ocean", name: "Ocean" }
];
export const defaultWallTheme: WallThemeId = "linen";
export const defaultWallColour: WallColourId = "sand";
/** Older botanical/coastal walls keep a familiar colour in the new collection. */
export function readWallTheme(value: unknown): WallThemeId {
  if (value === "harbour") return "studio";
  if (value === "sage") return "linen";
  return wallThemes.some(theme => theme.id === value) ? value as WallThemeId : defaultWallTheme;
}
export function readWallColour(value: unknown, legacyTheme?: unknown): WallColourId {
  if (wallColours.some(colour => colour.id === value)) return value as WallColourId;
  if (legacyTheme === "harbour") return "ocean";
  if (legacyTheme === "sage") return "sage";
  return defaultWallColour;
}
export const wallTheme = (id: WallThemeId): WallTheme =>
  wallThemes.find(theme => theme.id === id) ?? wallThemes[0]!;
