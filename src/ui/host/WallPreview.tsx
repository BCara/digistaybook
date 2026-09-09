import { useState } from "react";
import {
  hostInitials,
  setupProgress,
  setupSteps,
  welcomeParagraphs,
  writtenHostNotes,
  type PropertyProfile
} from "../../domain/propertyProfile";
import { memoriesHeading } from "../wall/memoryHeading";
import type { WallCounts } from "./propertyStore";

/**
 * The property dashboard's centre of gravity: the wall being edited.
 *
 * A Host cannot open their own unpublished wall — it is served to nobody — so
 * without this the page is a stack of form fields with no visible result, and
 * a half-filled property looks broken rather than unfinished. The preview
 * renders the draft, not the saved document, so it moves as they type.
 *
 * Nothing a Host has not written appears here. An empty field is drawn as the
 * absence a guest would meet, not as a prompt describing what belongs there:
 * the phone answers "what do they read", and the setup meter beside it answers
 * "what is still missing".
 */

export type WallView = "public" | "stay";

export function WallPreview({
  name,
  profile,
  counts = null,
  view: fixed
}: {
  name: string;
  profile: PropertyProfile;
  /**
   * How many memories are on the wall, when the page has read them. The phone
   * cannot show the memories themselves — they are read on the wall and judged
   * on the moderation page — but it can head the section the way the wall does,
   * which is how a Host sees that an empty wall says so.
   */
  counts?: WallCounts | { error: string } | null;
  /**
   * Which wall to show. Passing it hands the choice to the page: the wall
   * being edited is decided by which route a Host is on, and a switch inside
   * the phone would be a second answer to a question already answered.
   */
  view?: WallView;
}) {
  const [chosen, setChosen] = useState<WallView>("public");
  const view = fixed ?? chosen;
  const paragraphs = welcomeParagraphs(profile.stayWelcome);
  const facts = profile.facts.filter((fact) => fact.term.trim() && fact.detail.trim());
  const heading = profile.stayHeading.trim();
  const tip = profile.stayTip.trim();
  const hosts = profile.hosts.trim();
  /* The eyebrow labels a note, so it waits for a note to label: a heading on
     its own is shown as the one line it is. The signature is not a label but
     something a Host typed, so it stands wherever the note does. */
  const noteBody = paragraphs.length > 0 || tip !== "";
  const note = !profile.stayNoteOff && (noteBody || heading !== "" || hosts !== "");
  const memories = memoriesHeading(counts !== null && !("error" in counts) ? counts.visible : null);
  /* A wall with nothing written on it yet is a card with one thing on it, so
     the property's name is printed at the size that one thing deserves. */
  const essentials = !profile.factsOff && facts.length > 0;
  const alone = !note && !essentials;

  /* The hosts' own note stands above the memories on both walls rather than
     among them, so the phone shows it there too — and says whose it is, which
     is the whole reason it was taken out of the grid. It is the one note here
     drawn with what is actually written in it: the guests' are read on the
     wall and judged on the moderation page, and cannot be shown. */
  const written = writtenHostNotes(profile);
  const hostNotes = written.length > 0 && (
    <div className="phone-notes">
      <p className="phone-eyebrow">More from your hosts</p>
      {written.map((note) => (
        <div className="phone-note" data-note-style={note.style} key={note.id}>
          {note.photo && <img className="phone-note-photo" src={note.photo.url} alt={note.photo.alt} />}
          {note.message.trim() && <p className="phone-note-message">{note.message}</p>}
          {(hosts || profile.hostPhoto) && (
            <p className="phone-note-sign">
              {profile.hostPhoto ? (
                <img className="avatar avatar-photo" src={profile.hostPhoto.url} alt={profile.hostPhoto.alt} />
              ) : (
                <span className="avatar tone-2" aria-hidden="true">{hostInitials(hosts)}</span>
              )}
              {hosts && <b>{hosts}</b>}
            </p>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="wall-preview">
      {fixed === undefined && (
        <div className="preview-switch" role="tablist" aria-label="Preview which wall">
          <button
            type="button"
            role="tab"
            id="preview-tab-public"
            aria-selected={view === "public"}
            aria-controls="preview-panel"
            className={view === "public" ? "active" : undefined}
            onClick={() => setChosen("public")}
          >
            Public wall
          </button>
          <button
            type="button"
            role="tab"
            id="preview-tab-stay"
            aria-selected={view === "stay"}
            aria-controls="preview-panel"
            className={view === "stay" ? "active" : undefined}
            onClick={() => setChosen("stay")}
          >
            After the QR scan
          </button>
        </div>
      )}

      <div className="phone">
        <div
          className="phone-screen"
          data-wall-theme={profile.theme}
          id={fixed === undefined ? "preview-panel" : undefined}
          role={fixed === undefined ? "tabpanel" : "group"}
          aria-label={fixed === undefined ? undefined : "On a phone"}
          aria-labelledby={
            fixed === undefined ? (view === "public" ? "preview-tab-public" : "preview-tab-stay") : undefined
          }
        >
          {profile.cover && <img className="phone-cover" src={profile.cover.url} alt={profile.cover.alt} />}

          <div className="phone-body">
            {view === "public" ? (
              <>
                <p className="phone-eyebrow">The wall at</p>
                <h3>{name}</h3>
                {profile.location.trim() && <p className="phone-location">{profile.location}</p>}
                {profile.welcome.trim() && <p className="phone-welcome">{profile.welcome}</p>}
                {(hosts || profile.hostPhoto || profile.hostSince.trim()) && (
                  <p className="phone-byline">
                    {profile.hostPhoto ? (
                      <img className="avatar avatar-photo" src={profile.hostPhoto.url} alt={profile.hostPhoto.alt} />
                    ) : hosts ? (
                      <span className="avatar tone-2" aria-hidden="true">{hostInitials(hosts)}</span>
                    ) : null}
                    <span>
                      {hosts && <b>{hosts}</b>}
                      {profile.hostSince.trim() && <small>Hosting here since {profile.hostSince}</small>}
                    </span>
                  </p>
                )}
                {hostNotes}
                <p className="phone-heading">{memories}</p>
              </>
            ) : (
              <>
                {/* A guest arrives here from the placard in the hallway, so the
                    wall names the property before it says anything else: it is
                    the confirmation that they scanned the right display. It is
                    the property's name rather than a Host's sentence, so it is
                    on the wall whether or not anything else has been written. */}
                <p className={alone ? "phone-stay-name alone" : "phone-stay-name"}>
                  <b>{name}</b>
                  {profile.location.trim() && <span>{profile.location}</span>}
                </p>

                {note && (
                  <div className="stay-welcome">
                    <div className="stay-welcome-head">
                      {profile.hostPhoto ? (
                        <img className="avatar avatar-lg avatar-photo" src={profile.hostPhoto.url} alt={profile.hostPhoto.alt} />
                      ) : hosts ? (
                        <span className="avatar avatar-lg tone-2" aria-hidden="true">{hostInitials(hosts)}</span>
                      ) : null}
                      <div>
                        {noteBody && <p className="phone-eyebrow">A note from your hosts</p>}
                        {heading && <h3>{heading}</h3>}
                      </div>
                    </div>
                    {paragraphs.map((paragraph) => <p className="phone-para" key={paragraph}>{paragraph}</p>)}
                    {tip && <p className="phone-tip">{tip}</p>}
                    {hosts && <p className="phone-signature">{hosts}</p>}
                  </div>
                )}

                {!profile.factsOff && facts.length > 0 && (
                  <>
                    <p className="phone-heading">The essentials</p>
                    <dl className="phone-facts">
                      {facts.map((fact) => (
                        <div key={fact.term}>
                          <dt>{fact.term}</dt>
                          <dd>
                            <b>{fact.detail}</b>
                            {fact.note && <small>{fact.note}</small>}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}

                {hostNotes}
                <p className="phone-heading">{memories}</p>
              </>
            )}
          </div>

          {/* The contribution strip is not editable; it is here so the preview
              is the whole guest view rather than only the parts a Host writes. */}
          <div className="phone-composer" aria-hidden="true">
            <span className="btn btn-primary btn-block btn-sm">Add a memory</span>
          </div>
        </div>
      </div>
    </div>
  );
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
