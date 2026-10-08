import { describe, expect, it } from "vitest";
import { feedbackVerdict, memoryImageNeedsReview, memoryNeedsContactReview, memoryTextNeedsReview, memoryTextVerdict } from "./screening";

describe("wall memory provider mappings", () => {
  const safe = { adult: "VERY_UNLIKELY", spoof: "VERY_UNLIKELY", medical: "UNLIKELY", violence: "UNLIKELY", racy: "UNLIKELY" } as const;

  it("holds a likely adult, medical, violent or racy image for host review", () => {
    expect(memoryImageNeedsReview([{ ...safe, adult: "LIKELY" }])).toBe(true);
    expect(memoryImageNeedsReview([{ ...safe, medical: "VERY_LIKELY" }])).toBe(true);
    expect(memoryImageNeedsReview([{ ...safe, racy: "LIKELY" }])).toBe(true);
    expect(memoryImageNeedsReview([{ ...safe, violence: "LIKELY", racy: "UNLIKELY" }])).toBe(true);
  });

  it("keeps low-likelihood images clear and never auto-rejects them", () => {
    expect(memoryImageNeedsReview([{ ...safe, adult: "POSSIBLE", racy: "POSSIBLE" }])).toBe(false);
  });

  it("uses provider text categories as review signals without a profanity list", () => {
    expect(memoryTextNeedsReview([{ name: "Profanity", confidence: 0.8 }])).toBe(true);
    expect(memoryTextNeedsReview([{ name: "Toxic", confidence: 0.79 }])).toBe(false);
  });

  it.each(["Violent", "Sexual", "Derogatory", "Firearms & Weapons"])("routes %s flags to safety review for both routes", name => {
    const categories = [{ name, confidence: 0.8 }, { name: "Profanity", confidence: 0.99 }];
    expect(memoryTextVerdict(categories)).toEqual({ outcome: "critical", categories: [name] });
    expect(feedbackVerdict(categories)).toEqual({ verdict: "critical", categories: [name] });
  });

  it("uses host review for profanity alone and keeps below-threshold safety signals clear", () => {
    expect(memoryTextVerdict([{ name: "Profanity", confidence: 0.99 }])).toEqual({ outcome: "standard" });
    expect(memoryTextVerdict([{ name: "Violent", confidence: 0.79 }])).toEqual({ outcome: "clear" });
    expect(memoryTextVerdict([])).toEqual({ outcome: "clear" });
  });
});

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
