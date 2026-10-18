/**
 * Layout and colour are independent; every wall and preview uses the same CSS tokens.
 *
 * A colour is stored as one of three slots, and each theme names its own
 * colourway for each slot: Warm Linen's first slot is Terracotta, Editorial's
 * is Olive. The stored ids are the ones walls were already saved with, so a
 * colour survives a change of theme and no saved document needs rewriting.
 */
export type WallThemeId = "linen" | "editorial" | "seaside" | "journal";
export type WallColourId = "sand" | "sage" | "ocean";
export type WallColourway = { id: WallColourId; name: string };
export type WallTheme = { id: WallThemeId; name: string; note: string; colourways: readonly WallColourway[] };

const colourways = (first: string, second: string, third: string): readonly WallColourway[] =>
  [{ id: "sand", name: first }, { id: "sage", name: second }, { id: "ocean", name: third }];

export const wallThemes: readonly WallTheme[] = [
  { id: "linen", name: "Warm Linen", note: "Cover first, an elegant serif, soft panels and warm memory cards.",
    colourways: colourways("Terracotta", "Sage", "Sea Glass") },
  { id: "editorial", name: "Editorial", note: "A strong title, thin rules, numbered guidance and almost no card chrome.",
    colourways: colourways("Olive", "Bordeaux", "Ink Blue") },
  { id: "seaside", name: "Playful", note: "Bold rounded type, an arched cover, outlined blocks and a bright band under the memories.",
    colourways: colourways("Cobalt Peach", "Lagoon", "Berry") },
  { id: "journal", name: "Journal", note: "Typewriter headings, a polaroid cover, taped notes and a ruled guidance sheet.",
    colourways: colourways("Rust", "Forest", "Plum") }
];
export const wallColourIds: readonly WallColourId[] = ["sand", "sage", "ocean"];
export const defaultWallTheme: WallThemeId = "linen";
export const defaultWallColour: WallColourId = "sand";

/**
 * Older stored themes keep a familiar look in the new collection:
 * Archive was the editorial one, and Studio, Harbour and Sage were all soft,
 * rounded paper, which is Warm Linen now. Nothing stored is rewritten; the
 * mapping is applied every time a wall is read.
 */
const legacyThemes: Record<string, WallThemeId> = { studio: "linen", archive: "editorial", harbour: "linen", sage: "linen" };
export function readWallTheme(value: unknown): WallThemeId {
  if (typeof value === "string" && legacyThemes[value]) return legacyThemes[value];
  return wallThemes.some(theme => theme.id === value) ? value as WallThemeId : defaultWallTheme;
}
export function readWallColour(value: unknown, legacyTheme?: unknown): WallColourId {
  if (wallColourIds.includes(value as WallColourId)) return value as WallColourId;
  if (legacyTheme === "harbour") return "ocean";
  if (legacyTheme === "sage") return "sage";
  return defaultWallColour;
}
export const wallTheme = (id: WallThemeId): WallTheme =>
  wallThemes.find(theme => theme.id === id) ?? wallThemes[0]!;
/** What a theme calls a colour slot: "Bordeaux" for Editorial's second. */
export const wallColourName = (theme: WallThemeId, colour: WallColourId): string =>
  wallTheme(theme).colourways.find(option => option.id === colour)?.name ?? colour;
