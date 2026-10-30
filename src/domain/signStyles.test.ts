import { DEMO_SIGN_LINK, defaultSignStyle, signLink, signStyleFor, signStyles, spokenLink } from "./signStyles";

describe("QR sign styles", () => {
  it("gives every style a unique id that is safe in a link", () => {
    const ids = signStyles.map(style => style.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("opens on the style a link names and falls back to the first for anything else", () => {
    expect(signStyleFor("boho-arch").name).toBe("Boho arch");
    expect(signStyleFor("not-a-style")).toBe(defaultSignStyle);
    expect(signStyleFor(null)).toBe(defaultSignStyle);
  });

  it("only puts web addresses in a code, adding https to a bare domain", () => {
    expect(signLink("yourplace.com/guide")).toBe("https://yourplace.com/guide");
    expect(signLink(" http://example.com ")).toBe("http://example.com/");
    expect(signLink(DEMO_SIGN_LINK)).toBe(DEMO_SIGN_LINK);
    for (const bad of ["", "   ", "javascript:alert(1)", "mailto:host@example.com", "localhost", "not a link"]) expect(signLink(bad)).toBeNull();
  });

  it("prints the address without its scheme or a trailing slash", () => {
    expect(spokenLink("https://digistaybook.com/stay/demo-cottage")).toBe("digistaybook.com/stay/demo-cottage");
    expect(spokenLink("http://example.com/")).toBe("example.com");
  });
});
