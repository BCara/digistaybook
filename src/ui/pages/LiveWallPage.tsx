import { useEffect, useState } from "react";
import { getFirebaseServices } from "../../lib/firebase";
import { guestPhotoUrl } from "../../lib/guestSession";
import { GuestContribution } from "../guest/GuestContribution";
import { ReportMemory } from "../guest/ReportMemory";
import { readWallTheme } from "../../domain/wallTheme";
import { readHostNoteStyle, hostInitials } from "../../domain/propertyProfile";
import { HostNotes } from "../wall/HostNotes";
import "../guest/guest.css";

type Wall = { status: "open"; contributionsEnabled?: boolean; property: { name: string; location: string; welcome: string; hosts: string; hostNotes?: { id: string; message: string; style?: string; photo?: { url: string; alt: string } | null }[];
  theme?: string; guestPrompt?: string; hostPhoto?: { url: string; alt: string } | null;
  cover?: { url: string; alt: string } | null; houseInformation?: { heading: string; welcome: string; tip: string; facts: { term: string; detail: string; note: string }[] } | null };
  posts: { id: string; message: string; displayName: string; photoCount?: number }[]; nextCursor: string | null };

export function LiveWallPage({ slug }: { slug: string }) {
  const [wall, setWall] = useState<Wall | null>(null);
  const [status, setStatus] = useState("Loading this guestbook…");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setWall(null);
    setStatus("Loading this guestbook…");
    const timer = setTimeout(() => { if (current) { current = false; setStatus("The guestbook took too long to respond. Please try again."); } }, 15000);
    void readWall(slug).then(result => {
      if (!current) return;
      if (result.status === "open") { setWall(result); setStatus(""); }
      else setStatus("This guestbook is currently unavailable. For help with your stay, contact your host through your booking app.");
    }).catch(() => { if (current) setStatus("We couldn’t load this guestbook. Check your connection and try again."); })
      .finally(() => clearTimeout(timer));
    return () => { current = false; clearTimeout(timer); };
  }, [slug, attempt]);

  async function more() {
    if (!wall?.nextCursor || busy) return;
    setBusy(true);
    setStatus("");
    try {
      const result = await readWall(slug, wall.nextCursor);
      if (result.status !== "open") { setWall(null); setStatus("This guestbook is currently unavailable."); }
      else setWall(previous => previous && ({ ...result, posts: [...previous.posts, ...result.posts.filter(post => !previous.posts.some(existing => existing.id === post.id))] }));
    } catch { setStatus("More memories could not be loaded. Please try again."); }
    finally { setBusy(false); }
  }

  return <main className="page wall-page" data-wall-theme={readWallTheme(wall?.property.theme)}>
    {status && <p role="status">{status}</p>}
    {!wall && <button className="btn btn-secondary" onClick={() => setAttempt(value => value + 1)}>Try again</button>}
    {wall && <>
      <header>
        {wall.property.cover && <img className="live-property-cover" src={wall.property.cover.url} alt={wall.property.cover.alt} />}
        <p>{wall.property.location}</p><h1>{wall.property.name}</h1><p>{wall.property.welcome}</p>
        {wall.property.hostPhoto && <div className="host-byline">
          <img className="avatar avatar-lg avatar-photo" src={wall.property.hostPhoto.url} alt={wall.property.hostPhoto.alt || "Your hosts"} />
          {wall.property.hosts && <b>{wall.property.hosts}</b>}
        </div>}
      </header>
      {wall.property.houseInformation && <section className="stay-welcome" aria-label="House information">
        <div className="stay-welcome-head">
          {wall.property.hostPhoto ? (
            <img className="avatar avatar-lg avatar-photo" src={wall.property.hostPhoto.url} alt={wall.property.hostPhoto.alt} />
          ) : wall.property.hosts ? (
            <span className="avatar avatar-lg tone-2" aria-hidden="true">{hostInitials(wall.property.hosts)}</span>
          ) : null}
          <div>
            {(wall.property.houseInformation.welcome || wall.property.houseInformation.tip) && <p className="eyebrow">A note from your hosts</p>}
            <h2>{wall.property.houseInformation.heading || "House information"}</h2>
          </div>
        </div>
        {wall.property.houseInformation.welcome.split('\n').filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        {wall.property.houseInformation.tip && <p className="stay-tip">{wall.property.houseInformation.tip}</p>}
        {wall.property.hosts && <p className="stay-signature">{wall.property.hosts}</p>}
        {wall.property.houseInformation.facts.length > 0 && <h3 className="wall-heading">The essentials</h3>}
        <dl className="essentials-grid">{wall.property.houseInformation.facts.map((fact, index) => <div className="essential" key={index}><dt>{fact.term}</dt><dd><b>{fact.detail}</b>{fact.note && <small>{fact.note}</small>}</dd></div>)}</dl>
      </section>}
      <HostNotes
        author={wall.property.hosts || "your hosts"}
        notes={(wall.property.hostNotes ?? []).map(note => ({
          id: note.id, message: note.message, style: readHostNoteStyle(note.style),
          photo: note.photo ? { src: note.photo.url, alt: note.photo.alt } : undefined
        }))} />
      <section aria-label="Guest memories" className="note-grid">
        {wall.posts.map(post => <article className="note" key={post.id}>
          {Array.from({ length: post.photoCount ?? 0 }, (_, index) => <img key={index} src={guestPhotoUrl(post.id, index)} alt={`Guest memory photo ${index + 1}`} loading="lazy" />)}
          <p>{post.message}</p><p>{post.displayName || "A guest"}</p><ReportMemory slug={slug} postId={post.id} /></article>)}
        {!wall.posts.length && <p>No memories have been published yet.</p>}
      </section>
      {wall.nextCursor && <button className="btn btn-secondary" disabled={busy} onClick={() => void more()}>{busy ? "Loading…" : "Load more memories"}</button>}
      {wall.property.guestPrompt && <p>{wall.property.guestPrompt}</p>}
      {wall.contributionsEnabled ? <GuestContribution key={slug} slug={slug} onChanged={() => {
        void readWall(slug).then(result => { if (result.status === "open") setWall(result); else { setWall(null); setStatus("This guestbook is currently unavailable."); } })
          .catch(() => setStatus("The wall could not refresh. Your saved memory is still in Your memories below."));
      }} /> : <p>New contributions are not available yet.</p>}
    </>}
    <p><a href="/privacy-safety">Privacy &amp; Safety</a></p>
    <a href="/" aria-label="Create a digital guestbook for your property with DigiStayBook">Loved your stay? Powered by DigiStayBook — Create a digital guestbook for your property.</a>
  </main>;
}

async function readWall(slug: string, cursor?: string): Promise<Wall | { status: "unavailable" }> {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Unavailable");
  const { httpsCallable } = await import("firebase/functions");
  const response = await httpsCallable<{ slug: string; cursor?: string }, Wall | { status: "unavailable" }>(services.functions, "getPublicWall", { timeout: 15000 })({ slug, ...(cursor ? { cursor } : {}) });
  return response.data;
}
