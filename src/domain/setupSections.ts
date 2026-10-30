/** Owner-only checklist state. A saved blank section is still a reviewed section. */
export const setupSectionIds = ["property", "welcome", "essentials", "notes", "links", "style"] as const;
export type SetupSection = typeof setupSectionIds[number];

export function readReviewedSections(value: unknown): SetupSection[] {
  return Array.isArray(value) ? setupSectionIds.filter(id => value.includes(id)) : [];
}
