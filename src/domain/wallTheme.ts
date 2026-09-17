/* ===========================================================================
   Wall themes: the paper a property's walls are printed on.

   A wall is a page of guests' handwriting, and every property was printing it
   on the same sheet. A Host choosing a look for their own place is choosing
   between papers, not editing colours: there is one theme per property, it is
   applied to both of its walls, and it is picked from a small named set.

   A theme is not a colour scheme. Two walls that differ only in hue are the
   same wall twice, so a theme carries what a printer would have chosen with
   the stock: the face the headings are set in, whether a memory is a card
   pinned to the page or a paragraph written on it, whether the corners are cut
   square or rounded, whether the sheet is plain, woven or speckled, whether
   the cards come on one stock or three, and what is holding them up — a pin
   through the top, a strip of tape, or nothing at all, because most stock is
   not a board and does not pretend to be one.

   None of that is here. Each theme is a block of design tokens in the
   stylesheet keyed by `data-wall-theme`, so the swatch in the picker is
   painted by the same declaration that paints the wall — one place to change a
   theme, and a swatch that cannot drift from the thing it stands for.
   ========================================================================= */

export type WallThemeId = "linen" | "studio" | "archive" | "harbour" | "sage";

export type WallTheme = {
  id: WallThemeId;
  /** What a Host calls it. */
  name: string;
  /** One line, said as paper rather than as hex. */
  note: string;
};

export const wallThemes: readonly WallTheme[] = [
  {
    id: "linen",
    name: "Linen",
    note: "Warm woven stock with a fine double-line border and softly edged memory cards. The default look for your wall."
  },
  {
    id: "studio",
    name: "Studio",
    note: "A clean architectural moodboard: soft-grey backdrop with crisp white cards pinned securely under a metallic pushpin."
  },
  {
    id: "archive",
    name: "Archive",
    note: "A gallery portfolio: softly dimpled hammered card in a fine charcoal frame, with square memory cards and frosted tape."
  },
  {
    id: "harbour",
    name: "Harbour",
    note: "Faint blue marble with soft flowing veins, clean lettering and rounded cards that lie flat."
  },
  {
    id: "sage",
    name: "Sage",
    note: "A quiet botanical journal with soft leafy corners and blush petals, airy handwritten-style headings and ruled memories."
  }
];

/** What a property is printed on before anyone chooses. */
export const defaultWallTheme: WallThemeId = "linen";

const ids = new Set<string>(wallThemes.map((theme) => theme.id));

/**
 * A stored theme, or the default. A theme this build does not know — an older
 * name, a newer one, a corrupted field — renders as the default rather than as
 * an unstyled wall, which is the same rule the rest of the profile follows.
 */
export const readWallTheme = (value: unknown): WallThemeId =>
  typeof value === "string" && ids.has(value) ? (value as WallThemeId) : defaultWallTheme;

/** The named theme, for a page that needs to say which one is on. */
export const wallTheme = (id: WallThemeId): WallTheme =>
  wallThemes.find((theme) => theme.id === id) ?? wallThemes[0];
