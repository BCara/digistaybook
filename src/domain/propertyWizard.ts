/* ===========================================================================
   A property, asked for a few questions at a time.

   Everything a Host writes about a property used to be spread across three
   places: a short create form, a settings page for what the property *is*, and
   the wall canvas for everything a guest reads. A Host adding their first
   property met the short form, was handed an empty wall, and then had to find
   the other two places to finish the thing they had just started.

   So there is one sequence, and it asks for all of it: what the property is,
   then what it says to a guest, then the lines they answer every week. It is
   the same sequence when a property is created and when it is changed later,
   because the questions do not become different questions once the property
   exists — only the answers are already filled in.

   It is stepped rather than one long page because it is now asking for the
   whole property rather than four lines. A single form carrying the name, the
   place, four photographs, the welcome, the arrival note and eight lines of
   house guidance is not a form a Host reads; it is one they scroll past. Three
   steps put a heading on each group and let the first one be short enough to
   finish.

   Only the name is required, and only house guidance is ever rejected. A Host
   fills a property in over days, so every step can be left blank and picked up
   later; what cannot be left half-written is a guidance line, because a
   dangling label is what a guest would be left reading.
   ========================================================================= */

import { validatePropertyName } from "./property";
import {
  emptyProfile,
  normalizeProfile,
  validateProfile,
  type ProfileField,
  type PropertyProfile
} from "./propertyProfile";

/** One step of the sequence, named for what it collects. */
export type WizardStepId = "property" | "welcome" | "essentials";

/**
 * Anything a problem can be attached to: the name, which belongs to the
 * property's identity, and the profile fields, which belong to its content.
 * Photographs are not here — they are chosen, not typed, and a file that is
 * refused says so where it was chosen.
 */
export type WizardField = "name" | ProfileField;

/** `index` is the guidance line a problem belongs to, when it belongs to one. */
export type WizardProblem = { field: WizardField; index?: number; message: string };

/**
 * What the wizard is editing. It is the property itself rather than a shape of
 * its own: the same draft is created from nothing and read from a property
 * that exists, and a separate wizard-only type would have to be converted in
 * both directions for no gain.
 *
 * The chosen files are not here. A `File` is a browser handle rather than a
 * fact about the property, so the wizard holds those and this holds what is
 * decided about them.
 */
export type WizardDraft = { name: string; profile: PropertyProfile };

export const wizardSteps: readonly { id: WizardStepId; title: string }[] = [
  { id: "property", title: "The property" },
  { id: "welcome", title: "A note from your hosts" },
  { id: "essentials", title: "The essentials" }
];

export const stepCount = wizardSteps.length;

/** Which step a field is answered on, so a rejected save can open that step. */
const stepOfField: Record<WizardField, WizardStepId> = {
  name: "property",
  location: "property",
  welcome: "welcome",
  hosts: "welcome",
  hostSince: "welcome",
  stayHeading: "welcome",
  stayWelcome: "welcome",
  stayTip: "welcome",
  facts: "essentials"
};

export const stepOfProblem = (problem: WizardProblem): WizardStepId => stepOfField[problem.field];

/** A new property: nothing named yet and nothing written on it. */
export const emptyWizardDraft = (): WizardDraft => ({ name: "", profile: emptyProfile() });

/** An existing property, opened for changing. */
export const draftOfProperty = (name: string, profile: PropertyProfile): WizardDraft => ({ name, profile });

/**
 * Everything wrong with one step. Steps are checked as they are left rather
 * than all at the end, so a Host is told about the name while they are still
 * looking at it.
 */
export function validateStep(step: WizardStepId, draft: WizardDraft): WizardProblem[] {
  if (step === "property") {
    return validatePropertyName(draft.name).map(({ message }) => ({ field: "name" as const, message }));
  }
  if (step === "essentials") {
    return validateProfile(draft.profile).map((problem) => ({
      field: problem.field,
      index: problem.index,
      message: problem.message
    }));
  }
  return [];
}

/** Everything wrong with the whole draft, in the order the steps ask for it. */
export function validateWizard(draft: WizardDraft): WizardProblem[] {
  return wizardSteps.flatMap((step) => validateStep(step.id, draft));
}

/**
 * The profile to write. Trimmed and capped here so what a create writes is the
 * same shape `savePropertyProfile` would write later, and the blank guidance
 * rows an empty form always carries are dropped rather than stored.
 */
export const wizardProfile = (draft: WizardDraft): PropertyProfile => normalizeProfile(draft.profile);
