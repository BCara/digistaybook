import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { defaultWallTheme, readWallTheme, wallTheme, wallThemes, wallColours, readWallColour } from "./wallTheme";

/* A theme is a name here and a block of design tokens in the stylesheet, and
   nothing in TypeScript can see the second half. That split is deliberate — it
   is what lets the swatch in the picker be painted by the declaration that
   paints the wall — but it means a theme can be offered to a Host with nothing
   behind it, and what they would get is the default's paper under someone
   else's name. So the stylesheet is read here as text and the two halves are
   held against each other. */
const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

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
    expect(wallThemes).toHaveLength(3);
    expect(wallColours).toHaveLength(3);
  });

  it("reads a stored theme, and reads anything else as the default", () => {
    expect(readWallTheme("studio")).toBe("studio");
    expect(readWallTheme("archive")).toBe("archive");
    // An older name, a newer one, a corrupted field: paper, not an unstyled wall.
    expect(readWallTheme("midnight")).toBe(defaultWallTheme);
    expect(readWallTheme(undefined)).toBe(defaultWallTheme);
    expect(readWallTheme(7)).toBe(defaultWallTheme);
  });

  it("maps older themes to the new collection and keeps their colour", () => {
    expect(readWallTheme("harbour")).toBe("studio");
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
});
