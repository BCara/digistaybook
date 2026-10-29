import { useState } from "react";
import { HostNotes } from "../wall/HostNotes";
import { WallHeader } from "../wall/WallHeader";
import { MemoryWall } from "../wall/MemoryWall";
import { WallContributionPrompt, WallFooter } from "../wall/MemoryNote";
import { GuestContribution, type ContributionMode } from "../guest/GuestContribution";
import { LiveWallPage } from "./LiveWallPage";
import { DEMO_SLUG, demoPosts, demoProperty, houseEssentials, hostWallNotes, hostWelcome, wallPhotos } from "../wall/demoWall";
import { memoriesHeading } from "../wall/memoryHeading";
import { readWallColour, readWallTheme } from "../../domain/wallTheme";

/**
 * The in-stay wall: what the QR display opens.
 *
 * This is the only wall that carries house guidance, and the only one that
 * accepts a contribution, because reaching it means holding the guestbook
 * link — the slug with the token printed into the placard beside it. The slug
 * on its own is the public page: it is in the Host's listing and embedded on
 * their own site, and the Wi-Fi password cannot hang on that.
 */
export function StayWallPage({ propertySlug = "property", stayToken = null }: { propertySlug?: string; stayToken?: string | null }) {
  const property = demoProperty;
  const [contributing, setContributing] = useState(false);
  const [mode, setMode] = useState<ContributionMode>("memory");
  // The demo can be printed on any theme (`?theme=journal&colour=sage`), so
  // the four can be compared on the same words and photographs.
  const search = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const theme = readWallTheme(search?.get("theme"));
  const colour = readWallColour(search?.get("colour"));
  if (propertySlug !== DEMO_SLUG) return <LiveWallPage key={propertySlug} slug={propertySlug} view="stay" stayToken={stayToken} />;

  function open(next: ContributionMode) {
    setMode(next);
    setContributing(true);
    requestAnimationFrame(() => document.getElementById("wall-contribution")?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  }

  return (
    <div className="page wall-page" data-wall-view="stay" data-wall-theme={theme} data-wall-colour={colour}>
      <p className="demo-ribbon">
        <span className="demo-ribbon-tag">Demo</span>
        The guest wall: what guests open when they scan the QR display.
        <a href={`/wall/${DEMO_SLUG}`}>See the public page &rarr;</a>
      </p>

      {/* The served wall's own header, notes, form and footer, fed from the
          demo's data, so the demo is what a real guest would see and not a
          lookalike. */}
      <WallHeader
        view="stay"
        property={{
          name: property.name,
          location: property.location,
          welcome: property.welcome,
          hosts: property.hosts,
          cover: { url: property.cover.src, alt: property.cover.alt },
          hostPhoto: property.hostPhoto ? { url: property.hostPhoto.src, alt: property.hostPhoto.alt } : null,
          houseInformation: { heading: hostWelcome.heading, welcome: hostWelcome.body.join("\n"), tip: hostWelcome.tip, facts: houseEssentials }
        }}
        hostNotes={<HostNotes
          id="wall-host-notes"
          notes={hostWallNotes.map((note) => ({
            id: note.id,
            message: note.message,
            style: note.style,
            photo: note.photo ? wallPhotos[note.photo] : undefined
          }))}
          author={property.hosts}
        />}
      />

      <div className="wall-memories">
        <MemoryWall posts={demoPosts} heading={memoriesHeading(demoPosts.length)} />
        <div className="wall-contribution-action">
          {contributing
            ? <button className="btn btn-primary" aria-expanded aria-controls="wall-contribution" onClick={() => setContributing(false)}>Back to wall</button>
            : <WallContributionPrompt onMemory={() => open("memory")} onFeedback={() => open("feedback")} />}
          <div id="wall-contribution" hidden={!contributing}>
            {contributing && <GuestContribution demo slug={DEMO_SLUG} mode={mode} onModeChange={setMode} onChanged={() => {}} />}
          </div>
        </div>
      </div>

      <WallFooter />
    </div>
  );
}
