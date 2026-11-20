import { describe, expect, it } from "vitest";
import { guestStayDraft, guestStayInput, localGuestStayDraft } from "./guestStayDraft";

const today = new Date().toISOString().slice(0, 10);

describe("quick add a stay", () => {
  it("cuts a model's answer down to what the form accepts", () => {
    expect(guestStayDraft({ names: "  Sarah  &  Tom ", arrives: "2026-11-20", leaves: "2026-11-23", note: "Happy anniversary!", extra: "ignored" }))
      .toEqual({ names: "Sarah & Tom", arrives: "2026-11-20", leaves: "2026-11-23", note: "Happy anniversary!" });
    expect(guestStayDraft({ names: 7, arrives: "next Friday", leaves: "2026-02-30", note: null }))
      .toEqual({ names: "", arrives: "", leaves: "", note: "" });
    expect(guestStayDraft("not an object")).toEqual({ names: "", arrives: "", leaves: "", note: "" });
    expect(guestStayDraft({ names: "x".repeat(200) }).names).toHaveLength(60);
  });

  it("blanks a departure that is not after the arrival", () => {
    expect(guestStayDraft({ names: "Mia", arrives: "2026-11-20", leaves: "2026-11-20", note: "" }).leaves).toBe("");
  });

  it("refuses input it should not read", () => {
    expect(() => guestStayInput({ propertyId: "p1", text: " ", today })).toThrow(/2,000/);
    expect(() => guestStayInput({ propertyId: "p1", text: "x".repeat(2001), today })).toThrow(/2,000/);
    expect(() => guestStayInput({ propertyId: "../p1", text: "Sarah", today })).toThrow(/property/);
    expect(() => guestStayInput({ propertyId: "p1", text: "Sarah", today: "2020-01-01" })).toThrow(/date/);
    expect(guestStayInput({ propertyId: "p1", text: " Sarah ", today })).toEqual({ propertyId: "p1", text: "Sarah", today });
  });

  it("has a local stand-in that needs no key", () => {
    expect(localGuestStayDraft("Sarah & Tom, 2026-11-20 to 2026-11-23"))
      .toEqual({ names: "Sarah & Tom", arrives: "2026-11-20", leaves: "2026-11-23", note: "" });
  });
});
