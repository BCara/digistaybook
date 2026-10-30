import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { propertyIdentityLimits, validatePropertyName } from "../../domain/property";
import {
  emptyFact, emptyHostNote, defaultCover, markInitials, profileLimits, validatePhotoFile, validateProfile,
  writtenHostNotes, type PropertyProfile,
} from "../../domain/propertyProfile";
import { emptyStayAgainLink, stayAgainLimits, stayAgainProblems, wallStayAgainLinks } from "../../domain/stayAgain";
import { isPostMvpFeatureEnabled } from "../../domain/featureFlags";
import { wallColourName, wallTheme } from "../../domain/wallTheme";
import { setupSectionIds, type SetupSection } from "../../domain/setupSections";
import { PropertyShell } from "./PropertyShell";
import { WallPreview } from "./WallPreview";
import { WallThemePicker } from "./WallThemePicker";
import { HostNoteStylePicker } from "./HostNoteStylePicker";
import { PhotoField } from "./PhotoField";
import { HostNotes } from "../wall/HostNotes";
import { StayAgainLinks } from "../wall/WallHeader";
import { withPhotoInSlot } from "./photoSlots";
import { removePropertyPhoto, uploadPropertyPhoto, type HostProperty } from "./propertyStore";
import type { PropertyDraft } from "./usePropertyDraft";
import "./mobileWallEditor.css";

type Section = SetupSection;
type SectionRow = { id: Section; title?: string; detail: string; state: "done" | "todo" };
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
  const problems = validateProfile(profile);
  function reviewedState(section: Section): "done" | "todo" {
    const invalid = section === "property" ? validatePropertyName(draft.name).length > 0
      : problems.some(problem => section === "essentials" ? problem.field === "facts" : section === "links" && problem.field === "stayAgainLinks");
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
    { id: "welcome", detail: profile.stayNoteOff ? "Welcome hidden · Your names and host photo" : profile.stayWelcome.trim() || "Your names, welcome note and host photo", state: reviewedState("welcome") },
    { id: "essentials", title: "Wi-Fi and essentials", detail: profile.factsOff ? "Hidden from the wall" : profile.facts.map(f => f.term).filter(Boolean).join(", ") || "Wi-Fi, check-out, parking", state: reviewedState("essentials") },
    { id: "notes", title: "More notes", detail: writtenHostNotes(profile).length ? `${writtenHostNotes(profile).length} notes from your hosts` : "Anything else you want guests to know", state: reviewedState("notes") },
    ...(linksEnabled ? [{ id: "links" as const, detail: links.length ? links.map(link => link.label).join(" · ") : "Book direct, mailing list or another useful link", state: reviewedState("links") }] : []),
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
          {profile.stayNoteOff ? <p className="field-hint">Your welcome note is hidden.</p> : <>
            <p className="phone-wall-message">{profile.stayWelcome || "Write a personal welcome for arriving guests."}</p>
            {profile.stayTip && <p className="phone-wall-tip">{profile.stayTip}</p>}
          </>}
        </div>
      </EditSection>
      <EditSection title="Wi-Fi & essentials" action="Edit essentials" onEdit={() => edit("essentials")}>
        <div className="phone-wall-summary">{profile.factsOff ? "Hidden from the wall" : profile.facts.filter(f => f.term.trim()).map(f => f.term).join(" · ") || "Add Wi-Fi, check-out, parking and house information."}</div>
      </EditSection>
      <EditSection title="More from your hosts" action="Edit notes" onEdit={() => edit("notes")}>
        <div className="phone-wall-summary">{writtenHostNotes(profile).length ? <HostNotes author={profile.hosts || "your hosts"} notes={writtenHostNotes(profile).map(note => ({ id: note.id, message: note.message, style: note.style, photo: note.photo ? { src: note.photo.url, alt: note.photo.alt } : undefined }))} /> : "Optional notes, recommendations or a personal touch."}</div>
      </EditSection>
      {linksEnabled && <EditSection title="Stay with us again" action={links.length ? "Edit links" : "Add links"} onEdit={() => edit("links")}>
        <div className="phone-wall-summary stay-wall">{links.length ? <StayAgainLinks id="phone-wall-links" links={links} headingLevel={4} /> : <p>Help guests book another stay or join your mailing list.</p>}</div>
      </EditSection>}
    </div>}

    <footer className="phone-wall-dock" ref={dock}>
      {mode === "sections" && <p className="phone-wall-status" role="status">{draft.dirty ? "You have unsaved changes" : notice || "Everything here is saved."}</p>}
      {draft.dirty && <button type="button" className="btn btn-primary" disabled={draft.saving} onClick={() => void draft.save()}>{draft.saving ? "Saving…" : "Save pending changes"}</button>}
      {draft.problems.failure && <p className="form-feedback" role="alert">{draft.problems.failure}</p>}
      <div>{mode === "sections" ? <>
        <button type="button" className="btn btn-secondary" onClick={() => { previewFrom.current = "sections"; setMode("preview"); }}>See guest view</button>
        <button type="button" className="btn btn-primary" onClick={() => setMode("wall")}>Edit the wall</button>
      </> : <>
        <button type="button" className="btn btn-secondary" onClick={() => setMode(mode === "wall" ? "sections" : previewFrom.current)}>{mode === "wall" ? "Sections" : previewFrom.current === "sections" ? "Back to sections" : "Back to editor"}</button>
        {mode !== "preview" && <button type="button" className="btn btn-primary" onClick={() => { previewFrom.current = "wall"; setMode("preview"); }}>View as guest</button>}
      </>}</div>
    </footer>
    {editing && <SectionForm key={editing} section={editing} property={property} draft={draft} onClose={close} onSaved={() => { setNotice("Saved · Your guest wall is up to date"); close(); }} />}
  </PropertyShell>;
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
  const issues = attempted ? [...validatePropertyName(name).map(p => p.message), ...validateProfile(profile).filter(p => section !== "links" || p.field !== "stayAgainLinks").map(p => p.message)] : [];
  const linkIssues = attempted ? stayAgainProblems(profile.stayAgainLinks) : [];
  function text(key: "location" | "hosts" | "stayHeading" | "stayWelcome" | "stayTip" | "guestPrompt", label: string, max: number, multiline = false) {
    const controlId = `${id}-${key}`;
    return <label htmlFor={controlId}>{label}{multiline
      ? <textarea id={controlId} value={profile[key]} maxLength={max} rows={key === "stayWelcome" ? 5 : 3} disabled={busy} onChange={e => set(key, e.target.value)} />
      : <input id={controlId} value={profile[key]} maxLength={max} disabled={busy} onChange={e => set(key, e.target.value)} />}</label>;
  }
  function photo(slot: "cover" | "hostPhoto", label: string) {
    const current = photos[slot] === null ? null : profile[slot];
    return <div className="phone-section-photo">
      {(previews[slot] || current) && <img src={previews[slot] || current!.url} alt={label} />}
      <label>{label}<input type="file" accept={profileLimits.photoTypes.join(",")} disabled={busy} onChange={e => {
        const file = e.target.files?.[0]; e.target.value = "";
        if (!file) return;
        const problem = validatePhotoFile(file); setFailure(problem);
        if (!problem) setPhotos(previous => ({ ...previous, [slot]: file }));
      }} /></label>
      <p className="field-hint">{slot === "cover" ? "Show off the property's best feature: the beach nearby, the fireplace, the open-plan kitchen. Landscape works best." : "Optional. A friendly one of you, or a favorite corner of the property."} JPEG, PNG or WebP. Large photos are resized for you.</p>
      {photos[slot] && <p className="field-hint">{photos[slot].name} · Ready to save</p>}
      {(current || photos[slot]) && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setPhotos(previous => ({ ...previous, [slot]: null }))}>Remove {slot === "cover" ? "cover" : "welcome"} photo</button>}
      {photos[slot] === null && <p className="field-hint">Photo will be removed when you save.</p>}
    </div>;
  }
  async function save() {
    if (inFlight.current) return;
    setAttempted(true); setFailure(null);
    if (validatePropertyName(name).length || validateProfile(profile).length) return;
    inFlight.current = true; setBusy(true);
    let next = { ...profile, reviewedSections: setupSectionIds.filter(id => id === section || profile.reviewedSections.includes(id)) };
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
          {text("location", "Address", profileLimits.locationMax)}<p className="field-hint">Shown underneath your property name.</p>
          {photo("cover", "Cover photo")}
        </>}
        {section === "welcome" && <>
          {text("stayHeading", "Welcome heading", profileLimits.stayHeadingMax)}
          {text("hosts", "Your names", profileLimits.hostsMax)}
          {text("stayWelcome", "Welcome message", profileLimits.stayWelcomeMax, true)}
          {text("stayTip", "A little tip", profileLimits.stayTipMax, true)}
          <label className="phone-section-check"><input type="checkbox" checked={!profile.stayNoteOff} disabled={busy} onChange={e => set("stayNoteOff", !e.target.checked)} />Show the welcome note</label>
          {photo("hostPhoto", "Welcome photo")}
        </>}
        {section === "essentials" && <>
          <p className="field-hint">Add the details guests need during their stay.</p>
          <label className="phone-section-check"><input type="checkbox" checked={!profile.factsOff} disabled={busy} onChange={e => set("factsOff", !e.target.checked)} />Show essentials on the guest wall</label>
          {profile.facts.map((fact, index) => <fieldset key={index} className="phone-section-item"><legend>Essential {index + 1}</legend>
            {([['term', 'Name', profileLimits.factTermMax], ['detail', 'Details', profileLimits.factDetailMax], ['note', 'Extra information (optional)', profileLimits.factNoteMax]] as const).map(([key, label, max]) => <label key={key}>{label}<input value={fact[key]} maxLength={max} disabled={busy} onChange={e => set("facts", profile.facts.map((row, i) => i === index ? { ...row, [key]: e.target.value } : row))} /></label>)}
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => set("facts", profile.facts.filter((_, i) => i !== index))}>Remove essential {index + 1}</button>
          </fieldset>)}
          {profile.facts.length < profileLimits.factsMax && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => set("facts", [...profile.facts, emptyFact()])}>Add an essential</button>}
        </>}
        {section === "notes" && <>
          {profile.hostNotes.map((note, index) => <fieldset key={note.id} className="phone-section-item"><legend>Note {index + 1}</legend>
            <label>Message<textarea value={note.message} rows={4} maxLength={profileLimits.hostNoteMax} disabled={busy} onChange={e => set("hostNotes", profile.hostNotes.map(row => row.id === note.id ? { ...row, message: e.target.value } : row))} /></label>
            <HostNoteStylePicker name={`phone-note-${note.id}`} theme={profile.theme} colour={profile.colour} value={note.style} disabled={busy} onChange={style => set("hostNotes", profile.hostNotes.map(row => row.id === note.id ? { ...row, style } : row))} />
            <details><summary>Note photo</summary><PhotoField propertyId={property.id} slot={`hostNote:${note.id}`} photo={note.photo} label={`Note ${index + 1} photo`} hint="Note photos are saved separately when you choose Save photograph." onChange={value => {
              setProfile(previous => withPhotoInSlot(previous, `hostNote:${note.id}`, value));
              latest.current.setProfile(withPhotoInSlot(latest.current.profile, `hostNote:${note.id}`, value));
            }} /></details>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => set("hostNotes", profile.hostNotes.filter(row => row.id !== note.id))}>Remove note {index + 1}</button>
          </fieldset>)}
          {profile.hostNotes.length < profileLimits.hostNotesMax && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => set("hostNotes", [...profile.hostNotes, emptyHostNote()])}>Add a note</button>}
          {text("guestPrompt", "Guestbook prompt", 240, true)}
        </>}
        {section === "links" && <>
          <p className="field-hint">Add up to two links to your own booking page, mailing-list sign-up or another useful page. Guests open your website; mailing-list sign-ups happen there.</p>
          {profile.stayAgainLinks.map((link, index) => {
            const kept = profile.stayAgainLinks.slice(0, index).filter(row => row.label.trim() || row.url.trim()).length;
            const problem = linkIssues.find(issue => issue.index === kept)?.message;
            return <fieldset key={index} className="phone-section-item"><legend>Link {index + 1}</legend>
              <label>Button text<input value={link.label} maxLength={stayAgainLimits.labelMax} placeholder="Book direct" disabled={busy} onChange={e => set("stayAgainLinks", profile.stayAgainLinks.map((row, i) => i === index ? { ...row, label: e.target.value } : row))} /></label>
              <label>Web address<input type="text" inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} value={link.url} maxLength={stayAgainLimits.urlMax} placeholder="yourwebsite.com/book" disabled={busy} aria-invalid={problem ? true : undefined} aria-describedby={problem ? `${id}-link-${index}` : undefined} onChange={e => set("stayAgainLinks", profile.stayAgainLinks.map((row, i) => i === index ? { ...row, url: e.target.value } : row))} /></label>
              {problem && <p id={`${id}-link-${index}`} className="form-feedback" role="alert">{problem}</p>}
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => set("stayAgainLinks", profile.stayAgainLinks.filter((_, i) => i !== index))}>Remove link {index + 1}</button>
            </fieldset>;
          })}
          {profile.stayAgainLinks.length < stayAgainLimits.linksMax && <div className="phone-section-add-links">
            {["Book direct", "Join our mailing list"].filter(label => !profile.stayAgainLinks.some(link => link.label === label)).map(label => <button type="button" className="btn btn-secondary" key={label} disabled={busy} onClick={() => set("stayAgainLinks", [...profile.stayAgainLinks, { label, url: "" }])}>+ {label}</button>)}
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => set("stayAgainLinks", [...profile.stayAgainLinks, emptyStayAgainLink()])}>+ Custom link</button>
          </div>}
          <p className="field-hint">Links appear under your notes on the guest wall. Check your booking platform’s rules before adding links.</p>
        </>}
        {section === "style" && <WallThemePicker value={profile.theme} colour={profile.colour} disabled={busy} onChange={value => set("theme", value)} onColourChange={value => set("colour", value)} />}
        {issues.length > 0 && <div className="form-feedback" role="alert">{Array.from(new Set(issues)).map(issue => <p key={issue}>{issue}</p>)}</div>}
        {failure && <p className="form-feedback" role="alert">{failure}</p>}
      </div>
      <footer><p>{property.lifecycle === "draft" ? "Saved changes will appear when your property is published." : "Saving updates your guest wall immediately."}</p>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? progress || "Saving…" : "Save changes"}</button>
      </footer>
    </form>
  </dialog>, document.body);
}
