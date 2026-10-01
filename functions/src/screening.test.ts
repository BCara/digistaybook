import { describe, expect, it } from "vitest";
import { feedbackVerdict, memoryNeedsContactReview } from "./screening";

describe("public memory contact review", () => {
  it("holds links, email addresses and phone numbers for host review", () => {
    expect(memoryNeedsContactReview("Photos at https://example.com/album")).toBe(true);
    expect(memoryNeedsContactReview("Find us at example.com")).toBe(true);
    expect(memoryNeedsContactReview("Email guest@example.com")).toBe(true);
    expect(memoryNeedsContactReview("Call 0412 345 678")).toBe(true);
  });

  it("leaves ordinary memory text alone", () => {
    expect(memoryNeedsContactReview("A lovely stay from 2 to 10 October 2026.")).toBe(false);
    expect(memoryNeedsContactReview("Thank you for the warm welcome!")).toBe(false);
    expect(memoryNeedsContactReview("Mrs.Smith was a wonderful host.")).toBe(false);
  });
});

describe("private feedback screening", () => {
  it("delivers rude, negative and profane complaints", () => {
    expect(feedbackVerdict([{ name: "Toxic", confidence: 0.99 }, { name: "Insult", confidence: 0.97 }, { name: "Profanity", confidence: 0.98 }]))
      .toEqual({ verdict: "deliver" });
  });

  it("holds threats, sexual content, hate and weapons at the threshold", () => {
    expect(feedbackVerdict([{ name: "Violent", confidence: 0.8 }, { name: "Firearms & Weapons", confidence: 0.85 }, { name: "Sexual", confidence: 0.2 }]))
      .toEqual({ verdict: "critical", categories: ["Violent", "Firearms & Weapons"] });
    expect(feedbackVerdict([{ name: "Derogatory", confidence: 0.9 }])).toEqual({ verdict: "critical", categories: ["Derogatory"] });
  });

  it("delivers below the threshold and ignores categories it does not hold for", () => {
    expect(feedbackVerdict([{ name: "Violent", confidence: 0.79 }, { name: "Death, Harm & Tragedy", confidence: 0.99 }])).toEqual({ verdict: "deliver" });
    expect(feedbackVerdict([])).toEqual({ verdict: "deliver" });
  });
});
