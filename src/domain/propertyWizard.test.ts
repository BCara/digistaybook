import { emptyProfile, profileLimits } from "./propertyProfile";
import {
  draftOfProperty,
  emptyWizardDraft,
  stepCount,
  stepOfProblem,
  validateStep,
  validateWizard,
  wizardProfile,
  wizardSteps,
  type WizardDraft
} from "./propertyWizard";

const draft = (overrides: Partial<WizardDraft["profile"]> = {}, name = "Seabreeze Cottage"): WizardDraft => ({
  name,
  profile: { ...emptyProfile(), ...overrides }
});

describe("the shape of the sequence", () => {
  it("asks in three steps, the property before anything written on it", () => {
    expect(wizardSteps.map((step) => step.id)).toEqual(["property", "welcome", "essentials"]);
    expect(stepCount).toBe(3);
  });

  it("starts a new property blank: the example note is shown, never stored", () => {
    expect(emptyWizardDraft()).toEqual({ name: "", profile: emptyProfile() });
  });

  it("opens an existing property on what it already says", () => {
    const profile = { ...emptyProfile(), location: "Porthleven, Cornwall" };
    expect(draftOfProperty("Seabreeze Cottage", profile)).toEqual({ name: "Seabreeze Cottage", profile });
  });
});

describe("what each step rejects", () => {
  it("holds the first step until the property has a name", () => {
    expect(validateStep("property", draft({}, "A"))).toEqual([
      { field: "name", message: expect.stringContaining("at least 2 characters") }
    ]);
    expect(validateStep("property", draft())).toEqual([]);
  });

  it("lets the welcome step through empty, since a host fills a property in over days", () => {
    expect(validateStep("welcome", draft())).toEqual([]);
  });

  it("refuses a guidance line that would render as a dangling label", () => {
    const problems = validateStep("essentials", draft({ facts: [{ term: "Wi-Fi", detail: "", note: "" }] }));
    expect(problems).toEqual([
      { field: "facts", index: 0, message: expect.stringContaining("Wi-Fi") }
    ]);
  });

  it("treats a wholly blank guidance line as an empty form rather than an error", () => {
    expect(validateStep("essentials", draft({ facts: [{ term: "", detail: "", note: "" }] }))).toEqual([]);
  });
});

describe("checking the whole draft", () => {
  it("gathers every step's problems in the order they are asked", () => {
    const problems = validateWizard(draft({ facts: [{ term: "Wi-Fi", detail: "", note: "" }] }, "A"));
    expect(problems.map((problem) => problem.field)).toEqual(["name", "facts"]);
  });

  it("says which step a problem belongs to, so a rejected save opens that step", () => {
    expect(stepOfProblem({ field: "name", message: "" })).toBe("property");
    expect(stepOfProblem({ field: "hosts", message: "" })).toBe("welcome");
    expect(stepOfProblem({ field: "facts", message: "" })).toBe("essentials");
  });
});

describe("the profile it writes", () => {
  it("trims what was typed and drops the blank rows an empty form always carries", () => {
    const profile = wizardProfile(
      draft({
        location: "  Porthleven, Cornwall  ",
        hosts: "  Ana & Tom  ",
        facts: [
          { term: " Wi-Fi ", detail: " SEABREEZE-5G ", note: "" },
          { term: "", detail: "", note: "" }
        ]
      })
    );
    expect(profile.location).toBe("Porthleven, Cornwall");
    expect(profile.hosts).toBe("Ana & Tom");
    expect(profile.facts).toEqual([{ term: "Wi-Fi", detail: "SEABREEZE-5G", note: "" }]);
  });

  it("caps what it writes at the same limits the store does", () => {
    const profile = wizardProfile(draft({ location: "x".repeat(200), hosts: "y".repeat(200) }));
    expect(profile.location).toHaveLength(profileLimits.locationMax);
    expect(profile.hosts).toHaveLength(profileLimits.hostsMax);
  });

  it("writes no photograph: files are uploaded after the property exists", () => {
    const profile = wizardProfile(emptyWizardDraft());
    expect(profile.cover).toBeNull();
    expect(profile.avatar).toBeNull();
    expect(profile.hostPhoto).toBeNull();
    // A note's photograph is on the note, and a new property has no notes yet.
    expect(profile.hostNotes).toEqual([]);
  });
});
