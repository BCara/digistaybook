/**
 * What a wall calls the memories on it, in one line.
 *
 * The wall, the canvas a Host types into and the phone preview beside it all
 * head the same section, and a wall that says "No memories left yet" on one of
 * them and "0 memories left here" on another is telling a Host two things
 * about one wall. A count of nothing is written out rather than printed as a
 * zero: "0 memories left here" reads as a number that failed to arrive.
 *
 * `null` is a count that has not been read yet — the section still has to be
 * headed, so it is headed without a number rather than with a wrong one.
 */
export function memoriesHeading(left: number | null): string {
  if (left === null) return "Memories left here";
  if (left === 0) return "No memories left yet";
  if (left === 1) return "1 memory left here";
  return `${left} memories left here`;
}
