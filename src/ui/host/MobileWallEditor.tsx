import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { propertyIdentityLimits, validatePropertyName } from "../../domain/property";
import {
  emptyFact, emptyHostNote, defaultCover, exampleNote, guestPromptSamples, markInitials, profileLimits, validatePhotoFile, validateProfile,
  writtenHostNotes, type PropertyProfile,
} from "../../domain/propertyProfile";
import { emptyStayAgainLink, noteLinkLimits, stayAgainLimits, stayAgainProblems, wallStayAgainLinks, type StayAgainLink } from "../../domain/stayAgain";
import { isPostMvpFeatureEnabled } from "../../domain/featureFlags";
import { wallColourName, wallTheme } from "../../domain/wallTheme";
import { setupSectionIds, type SetupSection } from "../../domain/setupSections";
import { PropertyShell } from "./PropertyShell";
import { WallPreview } from "./WallPreview";
import { WallThemePicker } from "./WallThemePicker";
import { PhotoDropTarget, PhotoField } from "./PhotoField";
import { HostNotes } from "../wall/HostNotes";
import { NoteLinks, StayAgainLinks } from "../wall/WallHeader";
import { withPhotoInSlot } from "./photoSlots";
import { removePropertyPhoto, uploadPropertyPhoto, type HostProperty } from "./propertyStore";
import type { PropertyDraft } from "./usePropertyDraft";
import "./mobileWallEditor.css";

type Section = SetupSection;
type SectionRow = { id: Section; title?: string; detail: string; state: "done" | "todo" };
type WelcomeLine = "hosts" | "stayHeading" | "stayWelcome" | "stayTip";
const titles: Record<Section, string> = {
  property: "Property details", welcome: "Welcome & hosts",
  essentials: "Wi-Fi & essentials", notes: "More from your hosts", links: "Stay with us again", style: "Look & feel",
};

function EditSection({ title, action, onEdit, children }: { title: string; action: string; onEdit: () => void; children: ReactNode }) {
  return <section className="phone-wall-section">
    <div className="phone-wall-section-head"><h3>{title}</h3><button type="button" className="btn btn-ghost" onClick={onEdit}>{action}</button></div>
    {children}
  </section>;
}

/** Manage opens on the sections checklist; the wall and guest preview remain one tap away. */
export function MobileWallEditor({ property, draft, onEditingChange }: { property: HostProperty; draft: PropertyDraft; onEditingChange: (editing: boolean) => void }) {
  const [mode, setMode] = useState<"wall" | "sections" | "preview">("sections");
  const previewFrom = useRef<"wall" | "sections">("sections");
  const [editing, setEditing] = useState<Section | null>(null);
  const [notice, setNotice] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  const dock = useRef<HTMLElement>(null);
  const profile = draft.profile;
  const linksEnabled = isPostMvpFeatureEnabled("directBookingLinks");
  const links = wallStayAgainLinks(profile.stayAgainLinks);
  const usefulLinks = wallStayAgainLinks(profile.noteLinks, noteLinkLimits.linksMax);
  const problems = validateProfile(profile);
  function reviewedState(section: Section): "done" | "todo" {
    const invalid = section === "property" ? validatePropertyName(draft.name).length > 0
      : problems.some(problem => section === "essentials" ? problem.field === "facts" : section === "notes" ? problem.field === "noteLinks" : section === "links" && problem.field === "stayAgainLinks");
    return !invalid && profile.reviewedSections.includes(section) ? "done" : "todo";
  }
  function edit(section: Section) { opener.current = document.activeElement as HTMLElement; setEditing(section); onEditingChange(true); }
  function close() { setEditing(null); onEditingChange(false); requestAnimationFrame(() => opener.current?.focus()); }
  useLayoutEffect(() => {
    const footer = dock.current;
    const page = footer?.closest<HTMLElement>(".phone-wall-page");
    if (!footer || !page) return;
    const measure = () => page.style.setProperty("--phone-wall-dock-height", `${footer.getBoundingClientRect().height}px`);
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(footer);
    return () => observer?.disconnect();
  }, []);
  const sections: SectionRow[] = [
    { id: "property", detail: [draft.name, profile.location].filter(Boolean).join(" · ") || "Name, address and cover photo", state: reviewedState("property") },
    { id: "welcome", detail: !profile.stayNoteOff && profile.stayWelcome.trim() || "Your names, welcome note and host photo", state: reviewedState("welcome") },
    { id: "essentials", title: "Wi-Fi and essentials", detail: !profile.factsOff && profile.facts.map(f => f.term).filter(Boolean).join(", ") || "Wi-Fi, check-out, parking", state: reviewedState("essentials") },
    { id: "notes", title: "More notes", detail: [writtenHostNotes(profile).length && `${writtenHostNotes(profile).length} notes from your hosts`, usefulLinks.length && `${usefulLinks.length} ${usefulLinks.length === 1 ? "link" : "links"}`].filter(Boolean).join(" · ") || "Anything else you want guests to know, and useful links", state: reviewedState("notes") },
    ...(linksEnabled ? [{ id: "links" as const, detail: links.length ? links.map(link => link.label).join(" · ") : "Book direct or join your mailing list", state: reviewedState("links") }] : []),
    { id: "style", detail: `${wallTheme(profile.theme).name}, ${wallColourName(profile.theme, profile.colour)}`, state: reviewedState("style") },
  ];
  return <PropertyShell property={property} current="design" name={draft.name} profile={profile} className="phone-wall-page">
    <header className="phone-wall-heading" hidden={mode === "sections"}>
      <div><h2>{mode === "preview" ? "Guest preview" : mode === "sections" ? "Your sections" : "Guest wall"}</h2>
        <p className="phone-wall-status" role="status">{draft.dirty ? "You have unsaved changes" : notice || "All changes saved"}</p></div>
      {mode !== "preview" && <button type="button" className="btn btn-ghost" onClick={() => edit("style")}>Look & feel</button>}
    </header>

    {mode === "sections" ? <>
      <p className="phone-wall-review-hint">Only the property name is required to get started. Review and save each section at your own pace.</p>
      <nav aria-label="Guest wall sections" className="phone-wall-sections">
      {sections.map((section, index) => <button key={section.id} type="button" data-state={section.state} onClick={() => edit(section.id)}>
        <span className="phone-section-mark" role="img" aria-label={section.state === "done" ? "Reviewed and saved" : "Not reviewed"}>{section.state === "done" ? "✓" : index + 1}</span>
        <span className="phone-section-words"><b>{section.title || titles[section.id]}</b><small>{section.detail}</small></span><span className="phone-section-chevron" aria-hidden="true">›</span>
      </button>)}
    </nav></> : mode === "preview" ? <section className="phone-wall-guest" aria-label="Guest preview">
      <WallPreview name={draft.name} profile={profile} counts={draft.counts} view="stay" slug={property.slug} stayToken={property.stayToken} propertyId={property.id} />
    </section> : <div className="phone-wall-surface" data-wall-theme={profile.theme} data-wall-colour={profile.colour}>
      <section className="phone-wall-section phone-wall-property">
        <div className="phone-wall-cover">{profile.cover ? <img src={profile.cover.url} alt={profile.cover.alt || "Your property"} /> : <img src={defaultCover.url} alt="Standard cover photo" />}</div>
        <div className="phone-wall-section-head"><h3>Property details</h3><button type="button" className="btn btn-ghost" onClick={() => edit("property")}>Edit details</button></div>
        <div className="phone-wall-property-words"><h3>{draft.name}</h3>{profile.location && <p>{profile.location}</p>}</div>
      </section>
      <EditSection title="Your welcome" action="Edit welcome" onEdit={() => edit("welcome")}>
        <div className="phone-wall-welcome">
          <div className="phone-wall-hosts">
            {profile.hostPhoto ? <img src={profile.hostPhoto.url} alt={profile.hostPhoto.alt || "Your hosts"} /> : <span className="phone-wall-initials" aria-hidden="true">{markInitials(profile.hosts, draft.name)}</span>}
            <div><h3>{!profile.stayNoteOff && profile.stayHeading || "Your welcome"}</h3><p>{profile.hosts || "Add your names"}</p></div>
          </div>
          {profile.stayNoteOff ? <p className="phone-wall-message">Write a personal welcome for arriving guests.</p> : <>
            <p className="phone-wall-message">{profile.stayWelcome || "Write a personal welcome for arriving guests."}</p>
            {profile.stayTip && <p className="phone-wall-tip">{profile.stayTip}</p>}
          </>}
        </div>
      </EditSection>
      <EditSection title="Wi-Fi & essentials" action="Edit essentials" onEdit={() => edit("essentials")}>
        <div className="phone-wall-summary">{!profile.factsOff && profile.facts.filter(f => f.term.trim()).map(f => f.term).join(" · ") || "Add Wi-Fi, check-out, parking and house information."}</div>
      </EditSection>
      <EditSection title="More from your hosts" action="Edit notes" onEdit={() => edit("notes")}>
        <div className="phone-wall-summary">{writtenHostNotes(profile).length ? <HostNotes author={profile.hosts || "your hosts"} notes={writtenHostNotes(profile).map(note => ({ id: note.id, message: note.message, style: note.style, photo: note.photo ? { src: note.photo.url, alt: note.photo.alt } : undefined }))} /> : "Optional notes, recommendations or a personal touch."}
          {usefulLinks.length > 0 && <div className="stay-wall"><NoteLinks id="phone-wall-useful" links={usefulLinks} headingLevel={4} /></div>}</div>
      </EditSection>
      {linksEnabled && <EditSection title="Stay with us again" action={links.length ? "Edit links" : "Add links"} onEdit={() => edit("links")}>
        <div className="phone-wall-summary stay-wall">{links.length ? <StayAgainLinks id="phone-wall-links" links={links} headingLevel={4} /> : <p>Help guests book another stay or join your mailing list.</p>}</div>
      </EditSection>}
    </div>}

    <footer className="phone-wall-dock" ref={dock}>
      {mode === "sections" && <p className="phone-wall-status" role="status">{draft.dirty ? "You have unsaved changes" : notice || "Everything here is saved."}</p>}
      {draft.dirty && <button type="button" className="btn btn-primary" disabled={draft.saving} onClick={() => void draft.save()}>{draft.saving ? "Saving…" : "Save pending changes"}</button>}
      {draft.problems.failure && <p className="form-feedback" role="alert">{draft.problems.failure}</p>}
      {/* The way between the two editors always on the left, the guest view
          always on the right, so the buttons never trade places under a thumb. */}
      <div>{(() => {
        const next = mode === "sections" ? "wall" : mode === "wall" ? "sections" : previewFrom.current;
        return <button type="button" className="btn btn-secondary" onClick={() => setMode(next)}>{next === "wall" ? "Edit the wall" : "Sections"}</button>;
      })()}
        {mode !== "preview" && <button type="button" className="btn btn-primary" onClick={() => { previewFrom.current = mode as "sections" | "wall"; setMode("preview"); }}>See guest view</button>}
      </div>
    </footer>
    {editing && <SectionForm key={editing} section={editing} property={property} draft={draft} onClose={close} onSaved={() => { setNotice("Saved · Your guest wall is up to date"); close(); }} />}
  </PropertyShell>;
}

/**
 * There are no show/hide switches on the phone: a part is on the wall when it
 * has something in it. The stored flags follow the content, which also brings
 * back anything an earlier switch had hidden.
 */
function shownAsFilled(profile: PropertyProfile): PropertyProfile {
  return {
    ...profile,
    factsOff: !profile.facts.some(fact => fact.term.trim() || fact.detail.trim() || fact.note.trim()),
    stayNoteOff: !profile.stayHeading.trim() && !profile.stayWelcome.trim()
  };
}

function SectionForm({ section, property, draft, onClose, onSaved }: { section: Section; property: HostProperty; draft: PropertyDraft; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const latest = useRef(draft); latest.current = draft;
  const id = useId();
  const [name, setName] = useState(draft.name);
  const [profile, setProfile] = useState(draft.profile);
  const [photos, setPhotos] = useState<Partial<Record<"cover" | "hostPhoto", File | null>>>({});
  const [previews, setPreviews] = useState<Partial<Record<"cover" | "hostPhoto", string>>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [openLines, setOpenLines] = useState<ReadonlySet<WelcomeLine>>(new Set());
  const inFlight = useRef(false);

  useEffect(() => {
    const sheet = dialog.current!;
    sheet.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const viewport = window.visualViewport;
    const resize = () => { sheet.style.height = `${viewport?.height ?? window.innerHeight}px`; sheet.style.top = `${viewport?.offsetTop ?? 0}px`; };
    resize(); viewport?.addEventListener("resize", resize); viewport?.addEventListener("scroll", resize);
    return () => { viewport?.removeEventListener("resize", resize); viewport?.removeEventListener("scroll", resize); document.body.style.overflow = previousOverflow; sheet.close(); };
  }, []);
  useEffect(() => {
    const next: Partial<Record<"cover" | "hostPhoto", string>> = {};
    for (const slot of ["cover", "hostPhoto"] as const) if (photos[slot]) next[slot] = URL.createObjectURL(photos[slot]);
    setPreviews(next);
    return () => Object.values(next).forEach(url => URL.revokeObjectURL(url));
  }, [photos]);
  useEffect(() => { if (attempted && draft.problems.failure) setFailure(draft.problems.failure); }, [attempted, draft.problems.failure]);

  function set<K extends keyof PropertyProfile>(key: K, value: PropertyProfile[K]) { setProfile(previous => ({ ...previous, [key]: value })); }
  const issues = attempted ? [...validatePropertyName(name).map(p => p.message), ...validateProfile(shownAsFilled(profile)).filter(p => !(section === "links" && p.field === "stayAgainLinks") && !(section === "notes" && p.field === "noteLinks")).map(p => p.message)] : [];
  const linkIssues = attempted ? stayAgainProblems(profile.stayAgainLinks) : [];
  const noteLinkIssues = attempted ? stayAgainProblems(profile.noteLinks, { max: noteLinkLimits.linksMax, example: "Our favourite walks" }) : [];
  /** One link's fields; the two lists differ only in where they are kept and what they suggest. */
  // One bin for everything a section can take away, at the right of the
  // thing's name (on an item's border, beside its legend), rather than a
  // full-width button that read as one more thing to fill in.
  function removeButton(label: string, onClick: () => void) {
    return <button type="button" className="phone-section-remove" aria-label={label} title={label} disabled={busy} onClick={onClick}>
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M3.5 5.5h13M8 5.5V3.8h4v1.7M5.2 5.5l.8 10.7h8l.8-10.7M8.4 8.6v4.8M11.6 8.6v4.8" /></svg>
    </button>;
  }
  function linkFields(key: "stayAgainLinks" | "noteLinks", issues: { index: number; message: string }[], placeholder: string) {
    const rows: StayAgainLink[] = profile[key];
    const setRow = (index: number, change: Partial<StayAgainLink>) => set(key, rows.map((row, i) => i === index ? { ...row, ...change } : row));
    return rows.map((link, index) => {
      const kept = rows.slice(0, index).filter(row => row.label.trim() || row.url.trim()).length;
      const problem = issues.find(issue => issue.index === kept)?.message;
      const problemId = `${id}-${key}-${index}`;
      return <fieldset key={index} className="phone-section-item"><legend>Link {index + 1}</legend>
        <label>Button text<input value={link.label} maxLength={stayAgainLimits.labelMax} placeholder={placeholder} disabled={busy} onChange={e => setRow(index, { label: e.target.value })} /></label>
        <label>Web address<input type="text" inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} value={link.url} maxLength={stayAgainLimits.urlMax} placeholder="yourwebsite.com/book" disabled={busy} aria-invalid={problem ? true : undefined} aria-describedby={problem ? problemId : undefined} onChange={e => setRow(index, { url: e.target.value })} /></label>
        {problem && <p id={problemId} className="form-feedback" role="alert">{problem}</p>}
        {removeButton(`Remove link ${index + 1}`, () => set(key, rows.filter((_, i) => i !== index)))}
      </fieldset>;
    });
  }
  function text(key: "location" | "hosts" | "stayHeading" | "stayWelcome" | "stayTip" | "guestPrompt", label: string, max: number, multiline = false, placeholder?: string) {
    const controlId = `${id}-${key}`;
    return <label htmlFor={controlId}><span className="phone-field-name">{label}</span>{multiline
      ? <textarea id={controlId} value={profile[key]} maxLength={max} rows={key === "stayWelcome" ? 5 : 3} placeholder={placeholder} disabled={busy} onChange={e => set(key, e.target.value)} />
      : <input id={controlId} value={profile[key]} maxLength={max} placeholder={placeholder} disabled={busy} onChange={e => set(key, e.target.value)} />}</label>;
  }
  // A welcome line with nothing in it is offered rather than laid out empty, as
  // the wizard does, so none of them reads as a box that has to be filled.
  // A note with neither heading nor message is turned off rather than stored
  // blank, or `withExampleNote` would write the example back in next time.
  function optionalText(key: WelcomeLine, label: string, noun: string, max: number, multiline: boolean, placeholder: string) {
    const other = key === "stayHeading" ? "stayWelcome" : key === "stayWelcome" ? "stayHeading" : null;
    if (!profile[key].trim() && !openLines.has(key)) return <button type="button" className="btn btn-secondary btn-sm phone-section-add" disabled={busy} onClick={() => {
      setOpenLines(was => new Set([...was, key]));
      if (other) set("stayNoteOff", false);
    }}>+ Add {noun}</button>;
    return <div className="phone-section-line">
      {text(key, label, max, multiline, placeholder)}
      {removeButton(`Remove ${noun}`, () => {
        setOpenLines(was => { const next = new Set(was); next.delete(key); return next; });
        set(key, "");
        if (other && !profile[other].trim() && !openLines.has(other)) set("stayNoteOff", true);
      })}
    </div>;
  }
  function photo(slot: "cover" | "hostPhoto", label: string) {
    const current = photos[slot] === null ? null : profile[slot];
    const shown = previews[slot] || current?.url;
    const controlId = `${id}-${slot}`;
    const choose = () => (document.getElementById(controlId) as HTMLInputElement | null)?.click();
    return <div className="phone-section-photo">
      <label htmlFor={controlId}>{label}</label>
      {shown ? <img src={shown} alt={label} /> : <PhotoDropTarget label={label} disabled={busy} onChoose={choose} />}
      {/* Hidden because a bare file input cannot be styled; the frame and buttons drive it. */}
      <input id={controlId} className="visually-hidden" type="file" accept={profileLimits.photoTypes.join(",")} disabled={busy} onChange={e => {
        const file = e.target.files?.[0]; e.target.value = "";
        if (!file) return;
        const problem = validatePhotoFile(file); setFailure(problem);
        if (!problem) setPhotos(previous => ({ ...previous, [slot]: file }));
      }} />
      {slot === "cover" && <p className="field-hint">Show off the property's best feature: the beach nearby, the fireplace, the open-plan kitchen. Landscape works best.</p>}
      {photos[slot] && <p className="field-hint">{photos[slot].name} · Ready to save</p>}
      {shown && removeButton(`Remove ${slot === "cover" ? "cover" : "welcome"} photo`, () => setPhotos(previous => ({ ...previous, [slot]: null })))}
      {shown && <div className="actions">
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={choose}>Replace photo</button>
      </div>}
      {photos[slot] === null && <p className="field-hint">Photo will be removed when you save.</p>}
    </div>;
  }
  async function save() {
    if (inFlight.current) return;
    setAttempted(true); setFailure(null);
    if (validatePropertyName(name).length || validateProfile(shownAsFilled(profile)).length) return;
    inFlight.current = true; setBusy(true);
    let next = { ...shownAsFilled(profile), reviewedSections: setupSectionIds.filter(id => id === section || profile.reviewedSections.includes(id)) };
    try {
      for (const slot of ["cover", "hostPhoto"] as const) {
        const chosen = photos[slot];
        if (chosen === undefined) continue;
        const existing = latest.current.profile[slot];
        if (!chosen && !existing) continue;
        setProgress(chosen ? "Uploading photo…" : "Removing photo…");
        const outcome = chosen ? await uploadPropertyPhoto(property.id, slot, chosen, amount => setProgress(`Uploading photo… ${Math.round(amount * 100)}%`)) : await removePropertyPhoto(property.id, slot, existing!.path);
        if (outcome.status === "error") { setFailure(outcome.message); return; }
        const stored = chosen ? outcome.value : null;
        next = withPhotoInSlot(next, slot, stored);
        latest.current.setProfile(withPhotoInSlot(latest.current.profile, slot, stored));
        // A successfully uploaded photo is already stored, even if saving the words later fails.
        setProfile(previous => withPhotoInSlot(previous, slot, stored));
        setPhotos(previous => { const rest = { ...previous }; delete rest[slot]; return rest; });
      }
      setProgress(null);
      if (await latest.current.saveValues({ name, profile: next })) onSaved();
      else setFailure(latest.current.problems.failure || "Your changes could not be saved. Please try again.");
    } catch { setFailure("Your changes could not be saved. Check your connection and try again."); }
    finally { inFlight.current = false; setBusy(false); setProgress(null); }
  }
  return createPortal(<dialog ref={dialog} className="phone-section-dialog" aria-labelledby={`${id}-title`} onCancel={e => { e.preventDefault(); if (!inFlight.current) onClose(); }}>
    <form onSubmit={e => { e.preventDefault(); void save(); }} noValidate>
      <header><button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Cancel</button><h2 id={`${id}-title`}>{titles[section]}</h2></header>
      <div className="phone-section-fields">
        {section === "property" && <>
          <label>Property name<input value={name} maxLength={propertyIdentityLimits.nameMax} disabled={busy} onChange={e => setName(e.target.value)} /></label>
          {text("location", "Address", profileLimits.locationMax)}
          {photo("cover", "Cover photo")}
        </>}
        {section === "welcome" && <>
          <p className="field-hint">Everything here is recommended, nothing is required. Fill in what suits you.</p>
          {optionalText("hosts", "Your names", "your names", profileLimits.hostsMax, false, "Ana & Tom")}
          {photo("hostPhoto", "Welcome photo")}
          {optionalText("stayHeading", "Welcome heading", "a heading", profileLimits.stayHeadingMax, false, exampleNote.heading)}
          {optionalText("stayWelcome", "Welcome message", "a welcome message", profileLimits.stayWelcomeMax, true, exampleNote.welcome)}
          {optionalText("stayTip", "A little tip", "a little tip", profileLimits.stayTipMax, true, "The bakery behind the lighthouse. Go before 9am.")}
        </>}
        {section === "essentials" && <>
          <p className="field-hint">Add the details guests need during their stay.</p>
          {profile.facts.map((fact, index) => <fieldset key={index} className="phone-section-item"><legend>Essential {index + 1}</legend>
            {([['term', 'Name', profileLimits.factTermMax], ['detail', 'Details', profileLimits.factDetailMax], ['note', 'Extra information (optional)', profileLimits.factNoteMax]] as const).map(([key, label, max]) => <label key={key}>{label}<input value={fact[key]} maxLength={max} disabled={busy} onChange={e => set("facts", profile.facts.map((row, i) => i === index ? { ...row, [key]: e.target.value } : row))} /></label>)}
            {removeButton(`Remove essential ${index + 1}`, () => set("facts", profile.facts.filter((_, i) => i !== index)))}
          </fieldset>)}
          {profile.facts.length < profileLimits.factsMax && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => set("facts", [...profile.facts, emptyFact()])}>Add an essential</button>}
        </>}
        {section === "notes" && <>
          {profile.hostNotes.map((note, index) => <fieldset key={note.id} className="phone-section-item"><legend>Note {index + 1}</legend>
            <label>Message<textarea value={note.message} rows={4} maxLength={profileLimits.hostNoteMax} disabled={busy} onChange={e => set("hostNotes", profile.hostNotes.map(row => row.id === note.id ? { ...row, message: e.target.value } : row))} /></label>
            <PhotoField propertyId={property.id} slot={`hostNote:${note.id}`} photo={note.photo} label="Photo (optional)" onChange={value => {
              setProfile(previous => withPhotoInSlot(previous, `hostNote:${note.id}`, value));
              latest.current.setProfile(withPhotoInSlot(latest.current.profile, `hostNote:${note.id}`, value));
            }} />
            {removeButton(`Remove note ${index + 1}`, () => set("hostNotes", profile.hostNotes.filter(row => row.id !== note.id)))}
          </fieldset>)}
          {profile.hostNotes.length < profileLimits.hostNotesMax && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => set("hostNotes", [...profile.hostNotes, emptyHostNote()])}>Add a note</button>}
          <h3 className="phone-section-subhead">Useful links</h3>
          <p className="field-hint">Pages guests might want during their stay: local walks, a favourite restaurant, the house manual. They appear under your notes.</p>
          {linkFields("noteLinks", noteLinkIssues, "Our favourite walks")}
          {profile.noteLinks.length < noteLinkLimits.linksMax && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => set("noteLinks", [...profile.noteLinks, emptyStayAgainLink()])}>Add a link</button>}
          {text("guestPrompt", "Guestbook prompt", 240, true)}
          <div className="phone-prompt-samples" role="group" aria-label="Sample guestbook prompts">
            {guestPromptSamples.map(sample => <button type="button" className="btn btn-secondary" key={sample} aria-pressed={profile.guestPrompt.trim() === sample} disabled={busy} onClick={() => set("guestPrompt", sample)}>{sample}</button>)}
          </div>
        </>}
        {section === "links" && <>
          <p className="field-hint">Add up to two links so guests can book another stay or join your mailing list.</p>
          {linkFields("stayAgainLinks", linkIssues, "Book direct")}
          {profile.stayAgainLinks.length < stayAgainLimits.linksMax && <div className="phone-section-add-links">
            {["Book direct", "Join our mailing list"].filter(label => !profile.stayAgainLinks.some(link => link.label === label)).map(label => <button type="button" className="btn btn-secondary" key={label} disabled={busy} onClick={() => set("stayAgainLinks", [...profile.stayAgainLinks, { label, url: "" }])}>+ {label}</button>)}
          </div>}
          <p className="field-hint">Check your booking platform’s rules before adding links. Other useful links go in More notes.</p>
        </>}
        {section === "style" && <WallThemePicker gallery value={profile.theme} colour={profile.colour} disabled={busy} onChange={value => set("theme", value)} onColourChange={value => set("colour", value)} />}
        {issues.length > 0 && <div className="form-feedback" role="alert">{Array.from(new Set(issues)).map(issue => <p key={issue}>{issue}</p>)}</div>}
        {failure && <p className="form-feedback" role="alert">{failure}</p>}
      </div>
      <footer><p>{property.lifecycle === "draft" ? "Saved changes will appear when your property is published." : "Saving updates your guest wall immediately."}</p>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? progress || "Saving…" : "Save changes"}</button>
      </footer>
    </form>
  </dialog>, document.body);
}
