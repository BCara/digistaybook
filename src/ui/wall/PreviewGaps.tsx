/**
 * What is missing from a wall its owner is previewing.
 *
 * The wall answers "what will a guest read?". It cannot answer "why is there
 * so little of it?", and a draft property is mostly nothing: a name, two empty
 * paragraphs and an empty grid. Naming the gaps is the difference between a
 * page that looks broken and a page that is waiting.
 *
 * Only the fields a guest would actually read are counted. The public wall
 * carries no house guidance, so it is never asked for any, and a wall with
 * everything filled in renders nothing at all rather than a tick-list
 * congratulating a Host for finishing.
 */

export type WallGapSource = {
  welcome: string;
  cover?: { url: string; alt: string } | null;
  houseInformation?: { heading: string; welcome: string; tip: string; facts: { term: string }[] } | null;
};

/**
 * The two walls open with different words, so they are missing different
 * words. `welcome` is the line a stranger reads on the shared wall and is
 * never on the in-stay wall; what greets a guest there is the arrival note.
 * Asking a Host to write a welcome to fix a blank in-stay wall would send
 * them to the wrong field.
 */
export function wallGaps(property: WallGapSource, view: "stay" | "public") {
  const house = property.houseInformation;
  const note = Boolean(house && (house.heading.trim() || house.welcome.trim() || house.tip.trim()));
  const gaps: { key: string; label: string }[] = [];
  if (!property.cover) gaps.push({ key: "cover", label: "Add a cover photo" });
  if (view === "stay") {
    if (!note) gaps.push({ key: "note", label: "Write an arrival note" });
    if (!house?.facts.length) gaps.push({ key: "facts", label: "Add the essentials" });
  } else if (!property.welcome.trim()) {
    gaps.push({ key: "welcome", label: "Write a welcome" });
  }
  return gaps;
}

export function PreviewGaps({ property, view, propertyId }: { property: WallGapSource; view: "stay" | "public"; propertyId: string }) {
  const gaps = wallGaps(property, view);
  if (!gaps.length) return null;
  const base = `/host/property/${encodeURIComponent(propertyId)}`;
  return (
    <section className="wall-gaps" aria-labelledby="wall-gaps-title">
      <p className="wall-gaps-title" id="wall-gaps-title">
        {gaps.length === 1 ? "One thing left before this reads like a wall" : `${gaps.length} things left before this reads like a wall`}
      </p>
      <ul className="wall-gaps-list">
        {gaps.map(gap => (
          <li key={gap.key}><a href={base}>{gap.label}</a></li>
        ))}
      </ul>
    </section>
  );
}
