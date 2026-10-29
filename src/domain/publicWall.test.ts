import { publicProperty, publicPost, wallIsOpen } from "../../functions/src/publicWall";

describe("server public wall projection", () => {
  it("shares only the host portrait URL and alt text", () => {
    expect(publicProperty({ profile: { hostPhoto: { url: "https://x.test/host.jpg", alt: "Your hosts", path: "private-storage-path" } } }).hostPhoto)
      .toEqual({ url: "https://x.test/host.jpg", alt: "Your hosts" });
    expect(publicProperty({ profile: { hostPhoto: { url: "javascript:alert(1)" } } }).hostPhoto).toBeNull();
  });
  it("never forwards billing, house secrets, consent or moderation internals", () => {
    expect(publicProperty({ name: "Cottage", billing: { secret: "billing" }, profile: { welcome: "Welcome", facts: [{ detail: "wifi-password" }] } }))
      .toEqual({ name: "Cottage", location: "", welcome: "Welcome", hosts: "", hostPhoto: null, hostNotes: [], theme: "", colour: "", cover: null, guestPrompt: "", houseInformation: null });
    expect(publicPost("p1", { message: "Hello", sessionId: "secret", consent: {}, hold: {}, photo: { url: "private" } }))
      .toEqual({ id: "p1", message: "Hello", displayName: "", createdAt: null, photoCount: 0 });
  });
  it("serves the hosts' own notes on the in-stay wall, old shape or new, and never a note with nothing on it", () => {
    const profile = { hostNotes: [
      { id: "fire", message: "We lay the fire.", style: "pinned", photo: { url: "https://x.test/f.jpg", alt: "A fire", path: "secret" } },
      { id: "blank", message: "   " }
    ] };
    expect(publicProperty({ profile }, "stay").hostNotes).toEqual([
      { id: "fire", message: "We lay the fire.", style: "pinned", photo: { url: "https://x.test/f.jpg", alt: "A fire" } }
    ]);
    // The public wall carries memories only.
    expect(publicProperty({ profile }).hostNotes).toEqual([]);
    // A property saved before there were several is served as one note.
    expect(publicProperty({ profile: { hostNote: "We lay the fire." } }, "stay").hostNotes)
      .toEqual([{ id: "note1", message: "We lay the fire.", style: "bordered", photo: null }]);
  });

  it("serves the hosts' own booking links on the in-stay wall only, and only addresses a phone should open", () => {
    const profile = { stayAgainLinks: [
      { label: "Book your next stay", url: "https://seabreeze.com.au/book" },
      { label: "Sneaky", url: "javascript:alert(1)" },
      { label: "Third", url: "https://third.com.au" }
    ] };
    expect(publicProperty({ profile }, "stay").houseInformation?.links)
      .toEqual([{ label: "Book your next stay", url: "https://seabreeze.com.au/book" }]);
    expect(publicProperty({ profile: { stayAgainLinks: [{ label: "", url: "https://a.com.au" }, { label: "Old", url: "http://a.com.au" }] } }, "stay").houseInformation?.links)
      .toEqual([]);
    expect(publicProperty({ profile }).houseInformation).toBeNull();
  });

  it("requires an open property and a future cancellation deadline", () => {
    expect(wallIsOpen({ mode: "live", lifecycle: "active" })).toBe(true);
    // `wallIsOpen` defaults to the in-stay wall, which a Host switching the
    // public wall off does not close. See the public/stay pair in
    // functions/src/publicWall.test.ts.
    expect(wallIsOpen({ mode: "live", lifecycle: "active", profile: { displayWallOff: true } }, Date.now(), "public")).toBe(false);
    expect(wallIsOpen({ mode: "live", lifecycle: "cancelled_pending_end" })).toBe(false);
    expect(wallIsOpen({ mode: "live", lifecycle: "cancelled_pending_end", serviceEndsAt: { toMillis: () => 101 } }, 100)).toBe(true);
    expect(wallIsOpen({ mode: "live", lifecycle: "cancelled_pending_end", serviceEndsAt: { toMillis: () => 100 } }, 100)).toBe(false);
  });
  it("shares house information on the in-stay wall only, and respects hidden sections", () => {
    const profile = { stayHeading: "Welcome", stayWelcome: "Arrival note", facts: [{ term: "Checkout", detail: "10 am", note: "Leave keys", secret: "excluded" }], guestPrompt: "Your favourite memory?" };
    expect(publicProperty({ profile }, "stay").houseInformation).toEqual({ heading: "Welcome", welcome: "Arrival note", tip: "", facts: [{ term: "Checkout", detail: "10 am", note: "Leave keys" }], links: [] });
    // The shared link is the public wall, and the public wall carries none of it.
    expect(publicProperty({ profile }).houseInformation).toBeNull();
    expect(publicProperty({ profile: { ...profile, stayNoteOff: true, factsOff: true } }, "stay").houseInformation).toEqual({ heading: "", welcome: "", tip: "", facts: [], links: [] });
  });
});
