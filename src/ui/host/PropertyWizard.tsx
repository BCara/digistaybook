import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { propertyIdentityLimits } from "../../domain/property";
import {
  emptyFact,
  emptyHostNote,
  exampleNote,
  factExample,
  profileLimits,
  unusedFactSuggestions,
  type HostNote,
  type HouseFact,
  type PropertyProfile
} from "../../domain/propertyProfile";
import { HostNoteStylePicker } from "./HostNoteStylePicker";
import { hostNoteSlot, type PhotoSlot } from "./photoSlots";
import {
  stepCount,
  stepOfProblem,
  validateStep,
  validateWizard,
  wizardSteps,
  type WizardDraft,
  type WizardField,
  type WizardProblem,
  type WizardStepId
} from "../../domain/propertyWizard";

/**
 * The whole of a property, asked for three steps at a time.
 *
 * This is the form and not the window it opens in: the same steps are used to
 * create a property and to change one, and the two differ only in what they do
 * with the answers and how they store a photograph. Both of those are handed
 * in, so neither case can drift from the other's wording.
 *
 * Every field here is also somewhere else — the wall canvas types the same
 * lines in the places a guest reads them — and that is deliberate. The canvas
 * is where a Host writes a wall; this is where they fill a property in. A Host
 * who has just decided to add a property is not yet looking for the sentence
 * they want to change, and a Host who came to change the Wi-Fi password should
 * not have to find the line it is printed on.
 */

/**
 * What each photograph slot is called here, and what it is for.
 *
 * The property's own three are named once. A note's photograph is named for
 * the note it is on, because a Host with three notes open would otherwise be
 * offered "The photograph on your note" three times over.
 */
export function photoCopy(slot: PhotoSlot, position?: number): { label: string; hint?: string } {
  if (slot === "avatar") return { label: "Main photo", hint: "For your dashboard only. Guests never see it." };
  if (slot === "cover") return { label: "Cover photo", hint: "Across the top of both walls. Wide works best." };
  if (slot === "hostPhoto") {
    return { label: "Your photograph", hint: "Beside your names on every note. Without one, your initials." };
  }
  return { label: "Photograph" };
}

/**
 * The arrival note, line by line, in the order the wall prints them and under
 * the names the canvas gives them. The labels are the canvas's own "+" offers
 * word for word, so a Host who has met one has met both.
 */
type WelcomeLine = "stayHeading" | "stayWelcome" | "stayTip" | "hosts";

const welcomeLines: readonly { field: WelcomeLine; label: string }[] = [
  { field: "stayHeading", label: "a heading" },
  { field: "stayWelcome", label: "an arrival note" },
  { field: "stayTip", label: "a local recommendation" },
  { field: "hosts", label: "your names" }
];

export type PropertyWizardProps = {
  draft: WizardDraft;
  onDraft: (draft: WizardDraft) => void;
  /**
   * One photograph slot, drawn by whichever mode is using these steps. A
   * property that exists stores a file as it is chosen; one that does not
   * cannot, so the file waits on the device and this renders the waiting.
   */
  renderPhoto: (slot: PhotoSlot, position?: number) => ReactNode;
  /**
   * The wall address, shown only where there is one to state: a property that
   * already exists shows its address here, and adding one says nothing about it.
   */
  address?: ReactNode;
  /** What the button on the last step says when it is not working. */
  submitLabel: string;
  /** What it says while it is working, or null when nothing is in flight. */
  busy: string | null;
  /** The message from a write that failed, which is the server's not ours. */
  failure: string | null;
  onSubmit: () => void;
  onCancel: () => void;
};

function problemFor(problems: WizardProblem[], field: WizardField, index?: number) {
  return problems.find((problem) => problem.field === field && problem.index === index)?.message;
}

export function PropertyWizard({
  draft,
  onDraft,
  renderPhoto,
  address,
  submitLabel,
  busy,
  failure,
  onSubmit,
  onCancel
}: PropertyWizardProps) {
  const [position, setPosition] = useState(0);
  const [problems, setProblems] = useState<WizardProblem[]>([]);
  const form = useRef<HTMLFormElement>(null);
  const opening = useRef(true);

  // The heading and the note itself start open, the way they do on the canvas:
  // nearly every property says something to a guest who has just let
  // themselves in. The rest are offered rather than laid out empty.
  const [openLines, setOpenLines] = useState<ReadonlySet<WelcomeLine>>(
    () => new Set<WelcomeLine>(["stayHeading", "stayWelcome"])
  );

  /**
   * A property with nothing said on it yet opens with one note ready to write
   * into, rather than with a button that has to be found and pressed first.
   * It is only a row on the form: an empty note is dropped on the way to the
   * document, so a Host who ignores it stores nothing and is not offered a
   * save for a note they never wrote.
   *
   * Once, on the way in. A Host who removes the last note has removed it, and
   * putting it straight back would be the form arguing with them.
   */
  useEffect(() => {
    if (draft.profile.hostNotes.length > 0) return;
    onDraft({ ...draft, profile: { ...draft.profile, hostNotes: [emptyHostNote()] } });
  }, []);

  /**
   * A new step starts at its own top. Without this a Host who was reading the
   * foot of one step meets the next one already scrolled halfway down, which
   * is the one place a stepped form is worse than a long one: the heading that
   * says what is now being asked has gone past before they see it.
   *
   * The panel body is what scrolls, so it is what is put back; the window
   * behind it is the fallback, and after that the steps standing on their own
   * anywhere that is neither.
   */
  useEffect(() => {
    if (opening.current) {
      opening.current = false;
      return;
    }
    const scroller = form.current?.closest(".property-dialog-body, .property-dialog-scrim");
    if (scroller) scroller.scrollTop = 0;
    else form.current?.scrollIntoView({ block: "start" });
  }, [position]);

  const step = wizardSteps[position]!;
  const last = position === stepCount - 1;
  const working = busy !== null;
  const { profile } = draft;

  /** A line already written is on the wall, so it is on this step regardless. */
  const showsLine = (field: WelcomeLine) => profile[field].trim().length > 0 || openLines.has(field);
  const openLine = (field: WelcomeLine) => setOpenLines((was) => new Set([...was, field]));

  /**
   * Take a line back off the wall: clear what was typed and drop it from the
   * open set, so it returns to the "+" offers below the way the canvas lets a
   * Host leave any of these lines out.
   */
  const removeLine = (field: WelcomeLine) => {
    setOpenLines((was) => {
      const next = new Set(was);
      next.delete(field);
      return next;
    });
    set(field, "");
  };

  const removeLineButton = (field: WelcomeLine, label: string) => (
    <p className="wizard-line-remove">
      <button type="button" className="btn btn-ghost btn-sm" disabled={working} onClick={() => removeLine(field)}>
        Leave {label} out
      </button>
    </p>
  );

  function set<K extends keyof PropertyProfile>(field: K, value: PropertyProfile[K]) {
    setProblems([]);
    onDraft({ ...draft, profile: { ...profile, [field]: value } });
  }

  function setName(name: string) {
    setProblems([]);
    onDraft({ ...draft, name });
  }

  function setFact(index: number, field: keyof HouseFact, value: string) {
    set(
      "facts",
      profile.facts.map((fact, position) => (position === index ? { ...fact, [field]: value } : fact))
    );
  }

  /** Change one of the hosts' notes, found by its own id rather than a row. */
  function setNote(id: string, change: Partial<Omit<HostNote, "id">>) {
    set(
      "hostNotes",
      profile.hostNotes.map((note) => (note.id === id ? { ...note, ...change } : note))
    );
  }

  function addNote() {
    set("hostNotes", [...profile.hostNotes, emptyHostNote()]);
  }

  function removeNote(id: string) {
    set(
      "hostNotes",
      profile.hostNotes.filter((note) => note.id !== id)
    );
  }

  /**
   * Put the Host on the answer that was rejected. A message beside a field
   * that has scrolled out of the panel is a message nobody reads, and inside a
   * window that scrolls on its own it can be off-screen the moment it appears.
   */
  function land(found: WizardProblem[]) {
    const first = found[0];
    if (!first) return;
    const field = form.current?.querySelector<HTMLElement>(`[data-field="${first.field}"]`);
    field?.focus();
    field?.scrollIntoView({ block: "center" });
  }

  function go(to: number) {
    setProblems([]);
    setPosition(to);
  }

  /**
   * Leaving a step checks it. A Host is told about the name while they are
   * still looking at the name, rather than three steps later when the create
   * button finally refuses.
   */
  function next() {
    const found = validateStep(step.id, draft);
    setProblems(found);
    if (found.length > 0) {
      land(found);
      return;
    }
    setPosition(position + 1);
  }

  /**
   * The last step commits the whole thing, so it checks the whole thing: a
   * step walked past before an answer was changed must still be checked, and a
   * problem on an earlier step opens that step rather than reporting it here.
   */
  function submit() {
    const found = validateWizard(draft);
    setProblems(found);
    if (found.length > 0) {
      const back = wizardSteps.findIndex((entry) => entry.id === stepOfProblem(found[0]!));
      if (back >= 0 && back !== position) {
        setPosition(back);
        return;
      }
      land(found);
      return;
    }
    onSubmit();
  }

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    if (last) submit();
    else next();
  }

  const shows = (id: WizardStepId) => step.id === id;

  return (
    <form
      className="wizard stacked-form"
      ref={form}
      onSubmit={onFormSubmit}
      noValidate
      aria-label={`${step.title}: step ${position + 1} of ${stepCount}`}
    >
      {/* Three steps named rather than three dots. A Host deciding whether to
          start this now is really asking how long it is, and "The property, a
          note from your hosts, the essentials" answers that where a row of
          dots only says there is more. A step already passed is a way back to itself;
          one still ahead is not a way to skip the checks in front of it.

          The count is still written out, for whoever is read the form rather
          than shown it — the rail is a picture of the same sentence. */}
      <nav className="wizard-rail" aria-label="Steps">
        <p className="visually-hidden">Step {position + 1} of {stepCount}</p>
        <ol>
          {wizardSteps.map((entry, index) => (
            <li
              key={entry.id}
              className="wizard-rail-step"
              data-state={index === position ? "current" : index < position ? "done" : "ahead"}
              aria-current={index === position ? "step" : undefined}
            >
              {index < position ? (
                <button type="button" className="wizard-rail-back" disabled={working} onClick={() => go(index)}>
                  <span className="wizard-rail-number" aria-hidden="true">{index + 1}</span>
                  <span className="wizard-rail-name">{entry.title}</span>
                </button>
              ) : (
                <>
                  <span className="wizard-rail-number" aria-hidden="true">{index + 1}</span>
                  <span className="wizard-rail-name">{entry.title}</span>
                </>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <h3 className="wizard-step-title">{step.title}</h3>

      {shows("property") && (
        <>
          <label htmlFor="wizard-name">Property name</label>
          <input
            id="wizard-name"
            data-field="name"
            value={draft.name}
            maxLength={propertyIdentityLimits.nameMax}
            placeholder="Seabreeze Cottage"
            aria-describedby="wizard-name-hint"
            aria-invalid={problemFor(problems, "name") ? true : undefined}
            disabled={working}
            onChange={(event) => setName(event.target.value)}
          />
          <p className="field-hint" id="wizard-name-hint">
            {problemFor(problems, "name") ?? "Heads both walls and the QR placard."}
          </p>

          <label htmlFor="wizard-location">
            Where the property is<span className="label-optional">Optional</span>
          </label>
          <input
            id="wizard-location"
            data-field="location"
            value={profile.location}
            maxLength={profileLimits.locationMax}
            placeholder="10 Street Name, Town, Postcode"
            aria-describedby="wizard-location-hint"
            disabled={working}
            onChange={(event) => set("location", event.target.value)}
          />
          <p className="field-hint" id="wizard-location-hint">
            Shown under the name on both walls.
          </p>

          <section className="wizard-photos" aria-labelledby="wizard-photos-heading">
            <h4 id="wizard-photos-heading">Photographs</h4>
            <p className="field-hint">
              JPEG, PNG or WebP, up to {Math.round(profileLimits.photoBytesMax / (1024 * 1024))}MB.
            </p>
            <div className="photo-grid">
              {renderPhoto("avatar")}
              {renderPhoto("cover")}
            </div>
          </section>

          {address && (
            <section className="wizard-address" aria-labelledby="wizard-address-heading">
              <h4 id="wizard-address-heading">Wall address</h4>
              {address}
            </section>
          )}
        </>
      )}

      {shows("welcome") && (
        <>
          <p className="field-hint">
            The first thing your guests see when they scan the code on arrival.
          </p>

          {showsLine("stayHeading") && (
            <>
              <label htmlFor="wizard-stay-heading">Arrival heading</label>
              <input
                id="wizard-stay-heading"
                data-field="stayHeading"
                value={profile.stayHeading}
                maxLength={profileLimits.stayHeadingMax}
                placeholder={exampleNote.heading}
                disabled={working}
                onChange={(event) => set("stayHeading", event.target.value)}
              />
              {removeLineButton("stayHeading", "a heading")}
            </>
          )}

          {showsLine("stayWelcome") && (
            <>
              <label htmlFor="wizard-stay-welcome">Arrival note</label>
              <textarea
                id="wizard-stay-welcome"
                data-field="stayWelcome"
                value={profile.stayWelcome}
                maxLength={profileLimits.stayWelcomeMax}
                rows={6}
                placeholder={exampleNote.welcome}
                aria-describedby="wizard-stay-welcome-hint"
                disabled={working}
                onChange={(event) => set("stayWelcome", event.target.value)}
              />
              <p className="field-hint" id="wizard-stay-welcome-hint">
                Leave a blank line between paragraphs.
              </p>
              {removeLineButton("stayWelcome", "an arrival note")}
            </>
          )}

          {showsLine("stayTip") && (
            <>
              <label htmlFor="wizard-stay-tip">One local recommendation</label>
              <input
                id="wizard-stay-tip"
                data-field="stayTip"
                value={profile.stayTip}
                maxLength={profileLimits.stayTipMax}
                placeholder="The bakery behind the lighthouse. Go before 9am."
                disabled={working}
                onChange={(event) => set("stayTip", event.target.value)}
              />
              {removeLineButton("stayTip", "a local recommendation")}
            </>
          )}

          {showsLine("hosts") && (
            <>
              <label htmlFor="wizard-hosts">Your names</label>
              <input
                id="wizard-hosts"
                data-field="hosts"
                value={profile.hosts}
                maxLength={profileLimits.hostsMax}
                placeholder="Ana &amp; Tom"
                aria-describedby="wizard-hosts-hint"
                disabled={working}
                onChange={(event) => set("hosts", event.target.value)}
              />
              <p className="field-hint" id="wizard-hosts-hint">
                Signed at the foot of the note, however you&rsquo;d like your guests to know you.
              </p>
              {removeLineButton("hosts", "your names")}
            </>
          )}

          {/* The offer the canvas makes, in the canvas's own words. A line with
              nothing in it is not on the wall, so it is not a box here either;
              what stands in its place is the button that puts it there. */}
          {welcomeLines.some((line) => !showsLine(line.field)) && (
            <div className="wizard-suggestions">
              {welcomeLines
                .filter((line) => !showsLine(line.field))
                .map((line) => (
                  <button
                    key={line.field}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={working}
                    onClick={() => openLine(line.field)}
                  >
                    + {line.label}
                  </button>
                ))}
            </div>
          )}
        </>
      )}

      {shows("essentials") && (
        <>
          <section className="wizard-essentials" aria-labelledby="wizard-essentials-heading">
            <h4 id="wizard-essentials-heading">House guidance</h4>
            <p className="field-hint">
              Wi-Fi, bins, heating, checkout. Up to {profileLimits.factsMax} lines, on the in-stay wall only.
            </p>

            {problemFor(problems, "facts") && (
              <p className="form-feedback" role="alert">{problemFor(problems, "facts")}</p>
            )}

            {profile.facts.map((fact, index) => {
              const problem = problemFor(problems, "facts", index);
              return (
                <div className="wizard-essential" key={index}>
                  <label htmlFor={`wizard-fact-term-${index}`}>Line {index + 1}: label</label>
                  <input
                    id={`wizard-fact-term-${index}`}
                    data-field={index === 0 ? "facts" : undefined}
                    value={fact.term}
                    maxLength={profileLimits.factTermMax}
                    placeholder="Wi-Fi"
                    aria-invalid={problem ? true : undefined}
                    disabled={working}
                    onChange={(event) => setFact(index, "term", event.target.value)}
                  />

                  <label htmlFor={`wizard-fact-detail-${index}`}>Line {index + 1}: answer</label>
                  <input
                    id={`wizard-fact-detail-${index}`}
                    value={fact.detail}
                    maxLength={profileLimits.factDetailMax}
                    placeholder={factExample(fact.term).detail}
                    aria-invalid={problem ? true : undefined}
                    disabled={working}
                    onChange={(event) => setFact(index, "detail", event.target.value)}
                  />

                  <label htmlFor={`wizard-fact-note-${index}`}>
                    Line {index + 1}: detail<span className="label-optional">Optional</span>
                  </label>
                  <input
                    id={`wizard-fact-note-${index}`}
                    value={fact.note}
                    maxLength={profileLimits.factNoteMax}
                    placeholder={factExample(fact.term).note}
                    disabled={working}
                    onChange={(event) => setFact(index, "note", event.target.value)}
                  />

                  {problem && <p className="form-feedback" role="alert">{problem}</p>}

                  <div className="actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={working}
                      onClick={() =>
                        set("facts", profile.facts.filter((_, position) => position !== index))
                      }
                    >
                      Remove {fact.term.trim() || `line ${index + 1}`}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Suggestions rather than rows written into every new property: a
                label with no answer under it is the one thing the guidance is
                not allowed to put in front of a guest. */}
            {profile.facts.length < profileLimits.factsMax && (
              <div className="wizard-suggestions">
                {unusedFactSuggestions(profile.facts)
                  .slice(0, profileLimits.factsMax - profile.facts.length)
                  .map((suggestion) => (
                    <button
                      key={suggestion.term}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={working}
                      onClick={() => set("facts", [...profile.facts, { ...emptyFact(), term: suggestion.term }])}
                    >
                      + {suggestion.term}
                    </button>
                  ))}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={working}
                  onClick={() => set("facts", [...profile.facts, emptyFact()])}
                >
                  + A line of your own
                </button>
              </div>
            )}
          </section>

          <section className="wizard-host-note" aria-labelledby="wizard-host-note-heading">
            <h4 id="wizard-host-note-heading">Your own notes on the wall</h4>
            <p className="field-hint">
              Cards above the memories on both walls, each with your photograph and names. Write one for
              each thing you want said &mdash; the fire, the walk to the beach, the bakery that opens at seven.
            </p>

            {profile.hostNotes.map((note, index) => (
              <div className="wizard-note-row" key={note.id}>
                <div className="wizard-note-header">
                  <h5 className="wizard-note-title">Note {index + 1}</h5>
                  <HostNoteStylePicker
                    compact
                    name={`host-note-style-${note.id}`}
                    theme={profile.theme}
                    value={note.style}
                    disabled={working}
                    onChange={(style) => setNote(note.id, { style })}
                  />
                </div>

                {/* The photograph first and the words beside it, in the order
                    the wall itself prints them: a Host filling this in is
                    looking at the note as a guest will meet it, the picture on
                    the left and the writing to the right of it. */}
                <div className="wizard-note-body">
                  <div className="wizard-note-photo">{renderPhoto(hostNoteSlot(note), index + 1)}</div>

                  <div className="wizard-note-words">
                    <label htmlFor={`wizard-host-note-${note.id}`}>
                      Your note<span className="label-optional">Optional</span>
                    </label>
                    <textarea
                      id={`wizard-host-note-${note.id}`}
                      data-field="hostNotes"
                      value={note.message}
                      maxLength={profileLimits.hostNoteMax}
                      rows={5}
                      placeholder="The bench at the end of the garden gets the last of the sun. We have watched a lot of evenings go from there."
                      disabled={working}
                      onChange={(event) => setNote(note.id, { message: event.target.value })}
                    />

                  </div>
                </div>

                {/* A photograph is stored the moment it uploads, so what this
                    takes away is the note itself; the picture on it goes with
                    the note it was on. */}
                <div className="actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={working}
                    onClick={() => removeNote(note.id)}
                  >
                    Remove note {index + 1}
                  </button>
                </div>
              </div>
            ))}

            {profile.hostNotes.length < profileLimits.hostNotesMax && (
              <div className="wizard-suggestions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={working}
                  onClick={addNote}
                >
                  + {profile.hostNotes.length === 0 ? "A note of your own" : "Another note"}
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {failure && <p className="form-feedback" role="alert">{failure}</p>}

      {/* Stuck to the foot of the panel rather than the foot of the form. The
          essentials step is eight lines of guidance long, and a Host who has
          answered the one they came to answer should not have to scroll past
          the seven they left blank to get to the button that keeps it. */}
      <footer className="wizard-nav">
        <button type="submit" className="btn btn-primary" disabled={working}>
          {busy ?? (last ? submitLabel : "Next")}
        </button>
        {position > 0 && (
          <button type="button" className="btn btn-secondary" disabled={working} onClick={() => go(position - 1)}>
            Back
          </button>
        )}
        <button type="button" className="btn btn-ghost wizard-nav-cancel" disabled={working} onClick={onCancel}>
          Cancel
        </button>
      </footer>
    </form>
  );
}
