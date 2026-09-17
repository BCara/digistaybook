import { expect, it } from "vitest";
import { wallUnavailableReason } from "./wallAvailability";

it.each([
  ["draft", "sandbox", false, "Not published yet", "billing"],
  ["suspended", "live", false, "Subscription suspended", "billing"],
  ["dormant", "live", false, "Guest access has ended", "billing"],
  ["cancelled_pending_end", "live", false, "Guest access has ended", "billing"],
  ["active", "sandbox", false, "Property is in setup mode", "billing"],
  ["active", "live", true, "Public wall is switched off", "public"],
  ["deletion_scheduled", "live", false, "Property is being removed", "settings"]
] as const)("explains %s/%s and links to the relevant recovery screen", (lifecycle, mode, publicWallOff, title, section) => {
  expect(wallUnavailableReason({ lifecycle, mode, publicWallOff }, "public")).toMatchObject({ title, section });
});
