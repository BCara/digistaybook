import {
  embedWallUrl,
  embeddedWallSlug,
  isStayToken,
  publicWallUrl,
  stayRoute,
  stayWallPath,
  wallEmbedCode
} from "./wallAddress";

describe("a public wall's addresses", () => {
  it("builds the shared link and the embedded one from the same origin", () => {
    expect(publicWallUrl("https://digistaybook.test", "seabreeze-cottage")).toBe(
      "https://digistaybook.test/wall/seabreeze-cottage"
    );
    expect(embedWallUrl("https://digistaybook.test", "seabreeze-cottage")).toBe(
      "https://digistaybook.test/embed/wall/seabreeze-cottage"
    );
  });

  it("does not double the slash when the origin carries one", () => {
    expect(publicWallUrl("https://digistaybook.test/", "seabreeze-cottage")).toBe(
      "https://digistaybook.test/wall/seabreeze-cottage"
    );
  });

  it("recognises the embedded route and reads the wall out of it", () => {
    expect(embeddedWallSlug("/embed/wall/seabreeze-cottage")).toBe("seabreeze-cottage");
    expect(embeddedWallSlug("/embed/wall/seabreeze-cottage/")).toBe("seabreeze-cottage");
    expect(embeddedWallSlug("/wall/seabreeze-cottage")).toBeNull();
    expect(embeddedWallSlug("/embed/wall/")).toBeNull();
  });
});

describe("the snippet a Host pastes into their own site", () => {
  it("points at the embedded route and names the wall", () => {
    const code = wallEmbedCode("https://digistaybook.test", "seabreeze-cottage", "Seabreeze Cottage");
    expect(code).toContain('src="https://digistaybook.test/embed/wall/seabreeze-cottage"');
    expect(code).toContain('title="Memories left at Seabreeze Cottage"');
    expect(code).toContain('loading="lazy"');
  });

  it("escapes a property name that would otherwise break the tag", () => {
    const code = wallEmbedCode("https://digistaybook.test", "the-barn", 'Tom & "The Barn"');
    expect(code).toContain('title="Memories left at Tom &amp; &quot;The Barn&quot;"');
    expect(code).not.toContain('"The Barn"');
  });
});

/* The in-stay address is the one that answers with the Wi-Fi password, so it
   is not the public address with a different first word: it carries a second
   segment nobody can guess. */
describe("the guestbook link", () => {
  const token = "Kx7tQ2mN4pR8sV1wY3zB5c";

  it("recognises a token the server would have minted", () => {
    expect(isStayToken(token)).toBe(true);
    // Anything but 22 URL-safe characters is not one.
    expect(isStayToken(token.slice(0, 21))).toBe(false);
    expect(isStayToken(`${token}x`)).toBe(false);
    expect(isStayToken("Kx7tQ2mN4pR8sV1wY3zB5+")).toBe(false);
    expect(isStayToken(undefined)).toBe(false);
  });

  it("builds the address the placard carries", () => {
    expect(stayWallPath("seabreeze-cottage", token)).toBe(`/stay/seabreeze-cottage/${token}`);
  });

  it("leaves the token off rather than printing a broken one", () => {
    expect(stayWallPath("seabreeze-cottage", null)).toBe("/stay/seabreeze-cottage");
    expect(stayWallPath("seabreeze-cottage", "not-a-token")).toBe("/stay/seabreeze-cottage");
  });

  it("reads a guestbook link back into its two halves", () => {
    expect(stayRoute(`/stay/seabreeze-cottage/${token}`)).toEqual({ slug: "seabreeze-cottage", token });
    expect(stayRoute(`/stay/seabreeze-cottage/${token}/`)).toEqual({ slug: "seabreeze-cottage", token });
  });

  it("reads an address without a token as the slug alone", () => {
    // Not an error: a forwarded or truncated link is the public wall, which is
    // a real page, rather than a dead end.
    expect(stayRoute("/stay/seabreeze-cottage")).toEqual({ slug: "seabreeze-cottage", token: null });
    expect(stayRoute("/stay/seabreeze-cottage/nonsense")).toEqual({ slug: "seabreeze-cottage", token: null });
  });

  it("is not any other address", () => {
    expect(stayRoute("/wall/seabreeze-cottage")).toBeNull();
    expect(stayRoute("/stay/")).toBeNull();
    expect(stayRoute(`/stay/seabreeze-cottage/${token}/extra`)).toBeNull();
  });
});
