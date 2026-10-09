import { useId, useState } from "react";
import {
  setupProgress,
  setupSteps,
  writtenHostNotes,
  type PropertyProfile
} from "../../domain/propertyProfile";
import { memoriesHeading } from "../wall/memoryHeading";
import { WallHeader } from "../wall/WallHeader";
import { HostNotes } from "../wall/HostNotes";
import type { WallCounts } from "./propertyStore";
import { PreviewMemories } from "./PreviewMemories";

/**
 * The property dashboard's centre of gravity: the wall being edited.
 *
 * A Host cannot open their own unpublished wall — it is served to nobody — so
 * without this the page is a stack of form fields with no visible result, and
 * a half-filled property looks broken rather than unfinished. The preview
 * renders the draft, not the saved document, so it moves as they type.
 *
 * Host content follows the draft, and published guest memories are read from
 * the wall. An empty field is drawn as the absence a guest would meet:
 * the phone answers "what do they read", and the setup meter beside it answers
 * "what is still missing".
 */

export type WallView = "public" | "stay";

export function WallPreview({ name, profile, counts = null, view: fixed, slug, stayToken = null }: {
  name: string;
  profile: PropertyProfile;
  counts?: WallCounts | { error: string } | null;
  view?: WallView;
  slug?: string | null;
  stayToken?: string | null;
}) {
  const [chosen, setChosen] = useState<WallView>("public");
  const previewId = useId();
  const view = fixed ?? chosen;
  const memories = memoriesHeading(counts !== null && !("error" in counts) ? counts.visible : null);
  const property = {
    name, location: profile.location, welcome: profile.welcome, hosts: profile.hosts,
    cover: profile.cover, hostPhoto: profile.hostPhoto,
    houseInformation: {
      heading: profile.stayNoteOff ? "" : profile.stayHeading,
      welcome: profile.stayNoteOff ? "" : profile.stayWelcome,
      tip: profile.stayNoteOff ? "" : profile.stayTip,
      facts: profile.factsOff ? [] : profile.facts
    }
  };
  return <div className="wall-preview">
    {fixed === undefined && <div className="preview-switch" role="tablist" aria-label="Preview which wall">
      {(["public", "stay"] as const).map(option => <button key={option} type="button" role="tab"
        id={`${previewId}-${option}`} aria-selected={view === option} aria-controls={previewId}
        className={view === option ? "active" : undefined} onClick={() => setChosen(option)}>
        {option === "public" ? "Public wall" : "After the QR scan"}
      </button>)}
    </div>}
    <div className="phone">
      <div className="phone-screen" data-wall-theme={profile.theme} data-wall-colour={profile.colour}
        id={previewId} role={fixed === undefined ? "tabpanel" : "group"}
        aria-label={fixed === undefined ? undefined : "On a phone"}
        aria-labelledby={fixed === undefined ? `${previewId}-${view}` : undefined}>
        <div className="phone-wall-content">
          <WallHeader property={property} view={view} headingLevel={2} />
          <HostNotes author={profile.hosts || "your hosts"} notes={writtenHostNotes(profile).map(note => ({
            id: note.id, message: note.message, style: note.style,
            photo: note.photo ? { src: note.photo.url, alt: note.photo.alt } : undefined
          }))} />
          <h2 className="wall-heading">{memories}</h2>
          {slug
            ? <PreviewMemories key={`${slug}/${view}/${stayToken ?? ""}`} slug={slug} view={view} token={stayToken} />
            : counts !== null && !("error" in counts) && counts.visible === 0 && <p className="field-hint">No memories yet.</p>}
        </div>
      </div>
    </div>
  </div>;
}

/**
 * How ready the wall is, in one line. It is the only place that names what is
 * missing — the preview shows the wall as guests would find it, gaps and all —
 * so the detail is here, collapsed, rather than written into the phone.
 */
export function SetupMeter({ profile }: { profile: PropertyProfile }) {
  const steps = setupSteps(profile);
  const { done, total, complete } = setupProgress(profile);

  return (
    <details className="setup-meter">
      <summary>
        <span className="setup-meter-line" role="status">
          {complete ? "Ready for guests" : `${done} of ${total} filled in`}
        </span>
        <span className="setup-bar" aria-hidden="true">
          <span style={{ width: `${(done / total) * 100}%` }} />
        </span>
      </summary>
      <ul className="setup-list">
        {steps.map((step) => (
          <li key={step.id} className={step.done ? "setup-item done" : "setup-item"}>
            <span className="setup-mark" aria-hidden="true">{step.done ? "✓" : "○"}</span>
            <span>
              <b>{step.label}</b>
              {!step.done && <small>{step.hint}</small>}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
