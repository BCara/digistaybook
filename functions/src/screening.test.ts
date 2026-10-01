import { describe, expect, it } from "vitest";
import { feedbackVerdict } from "./screening";

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
