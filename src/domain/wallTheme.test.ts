import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { defaultWallTheme, readWallTheme, wallTheme, wallThemes, wallColourIds, wallColourName, readWallColour } from "./wallTheme";

/* A theme is a name here and a block of design tokens in the stylesheet, and
   nothing in TypeScript can see the second half. That split is deliberate — it
   is what lets the swatch in the picker be painted by the declaration that
   paints the wall — but it means a theme can be offered to a Host with nothing
   behind it, and what they would get is the default's paper under someone
   else's name. So the stylesheet is read here as text and the two halves are
   held against each other. */
const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
const structure = readFileSync(resolve(process.cwd(), "src/ui/wall/wallThemes.css"), "utf8");

describe("wall themes", () => {
  it("offers every theme the stylesheet can actually paint, and no other", () => {
    const declared = new Set(
      [...styles.matchAll(/\[data-wall-theme="([a-z]+)"\]/g)].map((match) => match[1])
    );
    const offered = new Set(wallThemes.map((theme) => theme.id));

    expect([...offered].sort()).toEqual([...declared].sort());
  });

  it("gives each theme its own layout independent of colour", () => {
    for (const theme of wallThemes) {
      const block = styles.slice(styles.indexOf(`[data-wall-theme="${theme.id}"] {`));
      const tokens = block.slice(0, block.indexOf("\n}"));

      // The stock it is printed on, and the ink on it: no theme is complete
      // without them, whatever else it does or does not change.
      expect(tokens).toContain("--wall-sheet-radius:");
      expect(tokens).toContain("--wall-note-radius:");
      // And something a colour picker could not have given it. A theme that
      // only re-hues the wall is the same wall again under a new name.
      expect(
        /--(?:font-display|wall-(?:tilt|texture|note-(?:radius|border|back-1|pad)|sheet-radius|sheet-border|frame|fix-content|heading-\w+|eyebrow-\w+|prose-\w+|mark-radius|device)):/.test(
          tokens
        )
      ).toBe(true);
    }
  });

  it("names each theme once, and names the default among them", () => {
    const ids = wallThemes.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(defaultWallTheme);
    expect(wallThemes[0].id).toBe(defaultWallTheme);
    expect(wallThemes).toHaveLength(4);
    expect(wallColourIds).toHaveLength(3);
  });

  it("reads a stored theme, and reads anything else as the default", () => {
    for (const theme of wallThemes) expect(readWallTheme(theme.id)).toBe(theme.id);
    // An older name, a newer one, a corrupted field: paper, not an unstyled wall.
    expect(readWallTheme("midnight")).toBe(defaultWallTheme);
    expect(readWallTheme(undefined)).toBe(defaultWallTheme);
    expect(readWallTheme(7)).toBe(defaultWallTheme);
  });

  it("maps older themes to the new collection and keeps their colour", () => {
    // Studio and Archive were the last collection; nothing stored is rewritten.
    expect(readWallTheme("studio")).toBe("linen");
    expect(readWallTheme("archive")).toBe("editorial");
    expect(readWallColour("ocean", "archive")).toBe("ocean");
    expect(readWallTheme("harbour")).toBe("linen");
    expect(readWallColour(undefined, "harbour")).toBe("ocean");
    expect(readWallTheme("sage")).toBe("linen");
    expect(readWallColour(undefined, "sage")).toBe("sage");
    expect(readWallColour("ocean", "sage")).toBe("ocean");
    expect(readWallColour("invalid")).toBe("sand");
  });

  it("says what each theme is as paper, in a line a Host can read", () => {
    for (const theme of wallThemes) {
      expect(wallTheme(theme.id)).toEqual(theme);
      expect(theme.name.trim()).not.toBe("");
      expect(theme.note.trim()).not.toBe("");
      // The note is the one place a theme is described, so it describes the
      // stock rather than repeating the name back.
      expect(theme.note.length).toBeGreaterThan(40);
    }
  });

  it("gives every theme three named colourways, each painted by the stylesheet", () => {
    for (const theme of wallThemes) {
      expect(theme.colourways.map((option) => option.id)).toEqual([...wallColourIds]);
      expect(new Set(theme.colourways.map((option) => option.name)).size).toBe(3);
      // The first colourway is the theme's own block; the other two are named.
      expect(styles).toContain(`[data-wall-theme="${theme.id}"][data-wall-colour="sage"] {`);
      expect(styles).toContain(`[data-wall-theme="${theme.id}"][data-wall-colour="ocean"] {`);
    }
    expect(wallColourName("editorial", "sage")).toBe("Bordeaux");
    expect(wallColourName("seaside", "sand")).toBe("Cobalt Peach");
    expect(wallColourName("journal", "ocean")).toBe("Plum");
  });

  it("gives each theme structure of its own, not only a palette", () => {
    for (const theme of wallThemes) {
      const rules = structure.split(`[data-wall-theme="${theme.id}"][data-wall-theme]`).length - 1;
      expect(rules).toBeGreaterThan(10);
    }
  });
});
