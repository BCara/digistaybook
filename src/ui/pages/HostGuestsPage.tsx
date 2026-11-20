import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useProperty } from "../host/useProperty";
import { propertyBlock } from "../host/usePropertyDraft";
import { PropertyShell } from "../host/PropertyShell";
import { hostCall } from "../host/GuestReviewPanel";
import { rememberProperty } from "../host/propertyCache";
import { saveGuestStays, type HostProperty } from "../host/propertyStore";
import {
  emptyGuestStay, formatDay, greetingFor, guestStayLimits, guestStayProblems, isDay, localDay, normalizeGuestStays, stayState,
  type GuestStay
} from "../../domain/guestStays";
import "./hostGuests.css";

/**
 * Who is staying.
 *
 * The one page of a property a Host returns to between guests: name the people
 * arriving and the nights they have, and the guest wall greets them by name
 * for exactly those nights. Typing three fields is the whole job, and the box
 * at the top does the typing from a pasted booking or a sentence.
 *
 * It saves its own list and nothing else, so it never crosses the wall editor.
 */

type Draft = { names: string; arrives: string; leaves: string; note: string };
const sameStays = (a: readonly GuestStay[], b: readonly GuestStay[]) => JSON.stringify(a) === JSON.stringify(b);

const stateLabel = { now: "Greeting now", upcoming: "Upcoming", ended: "Ended", unset: "Needs dates" } as const;

export function HostGuestsPage({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const [stays, setStays] = useState<GuestStay[] | null>(null);
  const [load, setLoad] = useProperty(propertyId, (property) => setStays(property.guestStays ?? []));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "status" | "alert"; message: string } | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [paste, setPaste] = useState("");
  const [reading, setReading] = useState(false);

  const block = propertyBlock(load, user?.uid);
  const property = block ? null : (load as { status: "ready"; property: HostProperty }).property;
  const saved = property?.guestStays ?? [];
  // A page opening from the cache is not called back, so it seeds from it.
  const rows = stays ?? saved;
  const problems = useMemo(() => guestStayProblems(rows.filter((stay) => stay.names.trim() || stay.arrives || stay.leaves || stay.note.trim())), [rows]);
  if (block || !property) return <main className="page"><h1>{block?.title}</h1><p>{block?.message}</p></main>;

  const filled = rows.filter((stay) => stay.names.trim() || stay.arrives || stay.leaves || stay.note.trim());
  const dirty = !sameStays(normalizeGuestStays(rows), normalizeGuestStays(saved));
  const full = rows.length >= guestStayLimits.staysMax;
  const change = (id: string, patch: Partial<GuestStay>) => {
    setNotice(null);
    setStays(rows.map((stay) => (stay.id === id ? { ...stay, ...patch } : stay)));
  };
  const problemFor = (stay: GuestStay, field: "names" | "arrives" | "leaves") =>
    showProblems ? problems.find((problem) => filled[problem.index]?.id === stay.id && problem.field === field)?.message : undefined;

  async function save() {
    if (problems.length) { setShowProblems(true); setNotice({ tone: "alert", message: "Check the highlighted names and dates." }); return; }
    setBusy(true); setNotice(null);
    const outcome = await saveGuestStays(propertyId, rows);
    setBusy(false);
    if (outcome.status === "error") { setNotice({ tone: "alert", message: outcome.message }); return; }
    const next = { ...property!, guestStays: outcome.value };
    rememberProperty(next);
    setLoad({ status: "ready", property: next });
    setStays(outcome.value); setShowProblems(false);
    setNotice({ tone: "status", message: outcome.value.length ? "Saved. The guest wall will greet them on those days." : "Saved. Nobody is named on the guest wall." });
  }

  async function read() {
    const text = paste.trim();
    if (!text || full) return;
    setReading(true); setNotice(null);
    try {
      const draft = await hostCall<Draft>("draftGuestStay", { propertyId, text, today: localDay() });
      if (!draft.names && !draft.arrives && !draft.leaves) {
        setNotice({ tone: "alert", message: "We couldn’t find names or dates in that. Add the stay by hand below." });
        return;
      }
      setStays([...rows.filter((stay) => stay.names.trim() || stay.arrives || stay.leaves || stay.note.trim()),
        { ...emptyGuestStay(), names: draft.names, arrives: isDay(draft.arrives) ? draft.arrives : "", leaves: isDay(draft.leaves) ? draft.leaves : "", note: draft.note }]);
      setPaste("");
      setNotice({ tone: "status", message: "Added below. Check the names and dates, then save." });
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
      setNotice({ tone: "alert", message: code === "functions/resource-exhausted"
        ? "That’s a lot of quick adds for one day. Add the stay by hand below."
        : "We couldn’t read that just now. Add the stay by hand below, or try again." });
    } finally { setReading(false); }
  }

  return <PropertyShell property={property} current="guests" className="guests-page narrow-main">
    <section aria-labelledby="guests-title">
      <h2 id="guests-title">Who’s staying</h2>
      <p>Name your guests and the guest wall greets them: <b>{greetingFor("Sarah & Tom")}</b>. The greeting shows from midday on the day they arrive until midday on the day they leave, then the wall goes back to your usual welcome.</p>

      <div className="guests-quick">
        <label htmlFor="guests-paste">Quick add</label>
        <p className="field-hint" id="guests-paste-hint">Paste a booking confirmation, or type something like “Sarah and Tom, Friday to Monday, their anniversary”. We’ll fill in the names and dates for you to check.</p>
        <textarea id="guests-paste" aria-describedby="guests-paste-hint guests-paste-privacy" rows={3} maxLength={guestStayLimits.pasteMax}
          value={paste} disabled={reading || busy} onChange={(event) => setPaste(event.target.value)} />
        <p className="field-hint" id="guests-paste-privacy">The text is read by an AI service to find the names and dates and is not saved. Leave out phone numbers, email addresses and payment details.</p>
        <button type="button" className="btn btn-secondary" disabled={reading || busy || !paste.trim() || full} onClick={() => void read()}>
          {reading ? "Reading…" : "Fill in from this"}
        </button>
      </div>

      {rows.length === 0 && <p className="guests-empty">Nobody is named yet, so every guest reads your usual welcome.</p>}

      <ol className="guests-list">
        {rows.map((stay, index) => {
          const state = stayState(stay);
          const label = stay.names.trim() || `stay ${index + 1}`;
          const errors = { names: problemFor(stay, "names"), arrives: problemFor(stay, "arrives"), leaves: problemFor(stay, "leaves") };
          return <li key={stay.id} className="guests-stay">
            <div className="guests-stay-head">
              <span className={`status-pill guests-state guests-state-${state}`}>{stateLabel[state]}</span>
              {state !== "unset" && <span className="guests-when">{formatDay(stay.arrives)} to {formatDay(stay.leaves)}</span>}
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} aria-label={`Remove ${label}`}
                onClick={() => { setNotice(null); setStays(rows.filter((other) => other.id !== stay.id)); }}>Remove</button>
            </div>
            <label htmlFor={`${stay.id}-names`}>Names to greet</label>
            <input id={`${stay.id}-names`} value={stay.names} maxLength={guestStayLimits.namesMax} disabled={busy} placeholder="Sarah & Tom"
              aria-invalid={errors.names ? true : undefined} aria-describedby={errors.names ? `${stay.id}-names-error` : undefined}
              onChange={(event) => change(stay.id, { names: event.target.value })} />
            {errors.names && <p className="guests-error" id={`${stay.id}-names-error`}>{errors.names}</p>}
            <div className="guests-dates">
              <div>
                <label htmlFor={`${stay.id}-arrives`}>Arrive</label>
                <input id={`${stay.id}-arrives`} type="date" value={stay.arrives} disabled={busy}
                  aria-invalid={errors.arrives ? true : undefined} aria-describedby={errors.arrives ? `${stay.id}-arrives-error` : undefined}
                  onChange={(event) => change(stay.id, { arrives: event.target.value })} />
              </div>
              <div>
                <label htmlFor={`${stay.id}-leaves`}>Leave</label>
                <input id={`${stay.id}-leaves`} type="date" value={stay.leaves} min={stay.arrives || undefined} disabled={busy}
                  aria-invalid={errors.leaves ? true : undefined} aria-describedby={errors.leaves ? `${stay.id}-leaves-error` : undefined}
                  onChange={(event) => change(stay.id, { leaves: event.target.value })} />
              </div>
            </div>
            {errors.arrives && <p className="guests-error" id={`${stay.id}-arrives-error`}>{errors.arrives}</p>}
            {errors.leaves && <p className="guests-error" id={`${stay.id}-leaves-error`}>{errors.leaves}</p>}
            <label htmlFor={`${stay.id}-note`}>A line just for them <span className="label-optional">Optional</span></label>
            <input id={`${stay.id}-note`} value={stay.note} maxLength={guestStayLimits.noteMax} disabled={busy}
              placeholder="Happy anniversary! There’s something in the fridge for you."
              onChange={(event) => change(stay.id, { note: event.target.value })} />
          </li>;
        })}
      </ol>

      <div className="guests-actions">
        <button type="button" className="btn btn-secondary" disabled={busy || full}
          onClick={() => { setNotice(null); setStays([...rows, emptyGuestStay()]); }}>Add a stay</button>
        <button type="button" className="btn btn-primary" disabled={busy || !dirty} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button>
      </div>
      {full && <p className="field-hint">That’s the most stays the list holds. Ones that have ended are cleared when you save.</p>}
      {notice && <p className="form-feedback" role={notice.tone}>{notice.message}</p>}
      <p className="field-hint guests-privacy">Use first names only. Anyone holding the guest link can read the greeting while it shows, and a stay is removed from your list once it has ended.</p>
    </section>
  </PropertyShell>;
}
