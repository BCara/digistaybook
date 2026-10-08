import { useAuth } from "../auth/AuthProvider";
import { UnavailableWall, type Unavailable } from "../wall/UnavailableWall";
import { PreviewBanner, type WallOwner } from "../wall/PreviewBanner";
import { PreviewGaps } from "../wall/PreviewGaps";
import { useEffect, useState } from "react";
import { getFirebaseServices, wallReaderFunctions } from "../../lib/firebase";
import { guestPhotoUrl } from "../../lib/guestSession";
import { GuestContribution, type ContributionMode } from "../guest/GuestContribution";
import { ReportMemory } from "../guest/ReportMemory";
import { readWallTheme, readWallColour } from "../../domain/wallTheme";
import { readHostNoteStyle } from "../../domain/propertyProfile";
import { HostNotes } from "../wall/HostNotes";
import { WallHeader } from "../wall/WallHeader";
import { memoriesHeading } from "../wall/memoryHeading";
import { WallSkeleton } from "../wall/WallSkeleton";
import "../guest/guest.css";

// "preview" is the same wall, served to the account that owns it while it is
// closed to everyone else. It carries the owner's recovery fields so the page
// can say why it is closed and what opens it.
type Wall = { status: "open" | "preview"; owner?: WallOwner; contributionsEnabled?: boolean; property: { name: string; location: string; welcome: string; hosts: string; hostNotes?: { id: string; message: string; style?: string; photo?: { url: string; alt: string } | null }[];
  theme?: string; colour?: string; guestPrompt?: string; hostPhoto?: { url: string; alt: string } | null;
  cover?: { url: string; alt: string } | null; houseInformation?: { heading: string; welcome: string; tip: string; facts: { term: string; detail: string; note: string }[] } | null };
  posts: { id: string; message: string; displayName: string; photoCount?: number }[]; nextCursor: string | null };

const LOADING = "Loading this guestbook…";

export function LiveWallPage({ slug, view = "public", stayToken = null }: {
  slug: string;
  view?: "public" | "stay";
  /**
   * The secret segment of the guestbook link. It is carried rather than
   * checked here: the server decides which wall a caller is reading, so a
   * missing or wrong token is not an error state this page draws — it is
   * simply the public wall, arriving with no house guidance on it.
   */
  stayToken?: string | null;
}) {
  const auth = useAuth();
  const [unavailable, setUnavailable] = useState<(Unavailable & { sessionUid?: string }) | null>(null);
  const [wall, setWall] = useState<Wall | null>(null);
  const [status, setStatus] = useState(LOADING);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [contributing, setContributing] = useState(false);
  const [contributionMode, setContributionMode] = useState<ContributionMode>("memory");
  const [formOpened, setFormOpened] = useState(false);
  // An owner previewing a closed wall can switch to what a guest gets instead.
  const [guestView, setGuestView] = useState(false);
  useEffect(() => {
    if (auth.status === "loading") return;
    let current = true;
    setWall(null);
    setUnavailable(null);
    setContributing(false);
    setFormOpened(false);
    setGuestView(false);
    setStatus(LOADING);
    const timer = setTimeout(() => { if (current) { current = false; setStatus("The guestbook took too long to respond. Please try again."); } }, 15000);
    void readWall(slug, view, stayToken, Boolean(auth.user)).then(result => {
      if (!current) return;
      if (result.status !== "unavailable") { setWall(result); setStatus(""); }
      else { setUnavailable({ ...result, sessionUid: auth.user?.uid }); setStatus(""); }
    }).catch(() => { if (current) setStatus("We couldn’t load this guestbook. Check your connection and try again."); })
      .finally(() => clearTimeout(timer));
    return () => { current = false; clearTimeout(timer); };
  }, [slug, view, stayToken, attempt, auth.status, auth.user?.uid]);

  async function more() {
    if (!wall?.nextCursor || busy) return;
    setBusy(true);
    setStatus("");
    try {
      const result = await readWall(slug, view, stayToken, Boolean(auth.user), wall.nextCursor);
      if (result.status === "unavailable") { setWall(null); setUnavailable({ ...result, sessionUid: auth.user?.uid }); setStatus(""); }
      else setWall(previous => previous && ({ ...result, posts: [...previous.posts, ...result.posts.filter(post => !previous.posts.some(existing => existing.id === post.id))] }));
    } catch { setStatus("More memories could not be loaded. Please try again."); }
    finally { setBusy(false); }
  }

  /* Which wall actually came back, which is not always the one that was
     asked for. The in-stay wall is reached with the token printed on the
     placard; a caller without it is served the public wall "whatever view it
     asked for", and says so by returning no house information at all. Drawing
     the in-stay arrangement over that answer produced the worst of both: an
     arrival note with no note in it, no essentials, and a Host certain the
     wall had lost what they wrote. So the page renders what it was given.
     A payload with no `houseInformation` key at all is not that statement. */
  const served: "public" | "stay" = wall && wall.property.houseInformation === null ? "public" : view;
  const preview = wall?.status === "preview" ? wall : null;
  // The owner asked to see the guest's side of a closed wall: the wall itself
  // stands down and the closed notice takes its place, exactly as served.
  const asGuest = Boolean(preview && guestView);

  return <main className="page wall-page" data-wall-theme={readWallTheme(wall?.property.theme)} data-wall-colour={readWallColour(wall?.property.colour, wall?.property.theme)} data-wall-view={served} data-wall-preview={preview ? "true" : undefined}>
    {preview?.owner && <PreviewBanner owner={preview.owner} view={served} guestView={guestView} onGuestView={setGuestView} />}
    {preview?.owner && !asGuest && <PreviewGaps property={preview.property} view={served} propertyId={preview.owner.propertyId} />}
    {asGuest && <UnavailableWall result={{ status: "unavailable" }} view={view} />}
    {unavailable && <UnavailableWall result={auth.status === "host" && unavailable.sessionUid === auth.user?.uid ? unavailable : { status: "unavailable" }} view={view} />}
    {/* Nothing arrived at all: not a closed wall, but a wall we could not
        reach. A guest standing in a hallway with a phone should be told which
        of the two it is, and given the one thing that ever helps — a retry —
        rather than a bare line of text on an empty page. */}
    {!wall && !unavailable && status && status !== LOADING
      ? <section className="unavailable-wall" aria-labelledby="wall-status-title">
          <p className="eyebrow">DigiStayBook</p>
          <h1 id="wall-status-title">This guestbook didn’t load</h1>
          <p className="lede" role="status">{status}</p>
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setAttempt(value => value + 1)}>Try again</button>
          </div>
          <p>The wall itself is fine. This is the connection between your phone and it.</p>
        </section>
      : status === LOADING
        ? <WallSkeleton view={view} label={LOADING} />
        : status && <p role="status">{status}</p>}
    {wall && !asGuest && <>
      {/* A field a Host never filled in rendered as an empty paragraph, so a
          bare property came out as a name floating between two blank lines.
          Nothing stands in for it on a published wall; in a preview a dashed
          marker says what a guest is not getting and where it would sit. */}
      {/* The public wall and the in-stay wall open differently because a
          reader arrives at them differently: a stranger following a shared
          link is being introduced to the property, and a guest who has just
          scanned the placard in the hallway is checking they scanned the
          right one. So the stay wall leads with the name and the place, and
          the public welcome — the line written for that stranger — is not on
          it. `StayWallHeader` below is the same arrangement the canvas and
          the phone preview draw, so a Host is looking at one wall twice. */}
      <WallHeader property={wall.property} view={served} preview={Boolean(preview)} />
      <HostNotes
        author={wall.property.hosts || "your hosts"}
        notes={(wall.property.hostNotes ?? []).map(note => ({
          id: note.id, message: note.message, style: readHostNoteStyle(note.style),
          photo: note.photo ? { src: note.photo.url, alt: note.photo.alt } : undefined
        }))} />
      <h2 className="wall-heading">{memoriesHeading(wall.nextCursor ? null : wall.posts.length)}</h2>
      <section aria-label="Guest memories" className="note-grid">
        {wall.posts.map(post => <article className="note" key={post.id}>
          {Array.from({ length: post.photoCount ?? 0 }, (_, index) => <img key={index} src={guestPhotoUrl(post.id, index)} alt={`Guest memory photo ${index + 1}`} loading="lazy" />)}
          <p>{post.message}</p>{post.displayName?.trim() && <p>{post.displayName}</p>}<ReportMemory slug={slug} postId={post.id} /></article>)}
        {!wall.posts.length && <p className="field-hint">No memories yet.</p>}
      </section>
      {wall.nextCursor && <button className="btn btn-secondary" disabled={busy} onClick={() => void more()}>{busy ? "Loading…" : "Load more memories"}</button>}
      {served === "stay" && (wall.contributionsEnabled ? <div className="wall-contribution-action">
        {contributing
          ? <button className="btn btn-primary" aria-expanded aria-controls="wall-contribution" onClick={() => setContributing(false)}>Back to wall</button>
          // A guest with a complaint should not have to guess that it lives
          // behind "Add a memory", so the private route is offered by name.
          : <div className="wall-contribution-choices">
            <button className="btn btn-primary" aria-expanded={false} aria-controls="wall-contribution" onClick={() => { setContributionMode("memory"); setFormOpened(true); setContributing(true); }}>Add a memory</button>
            <button className="btn btn-ghost" aria-expanded={false} aria-controls="wall-contribution" onClick={() => { setContributionMode("feedback"); setFormOpened(true); setContributing(true); }}>Private feedback</button>
          </div>}
        <div id="wall-contribution" hidden={!contributing}>
        {contributing && contributionMode === "memory" && wall.property.guestPrompt && <p>{wall.property.guestPrompt}</p>}
        {formOpened && <GuestContribution key={slug} slug={slug} stayToken={stayToken} mode={contributionMode} onModeChange={setContributionMode} onChanged={() => {
        void readWall(slug, view, stayToken, Boolean(auth.user)).then(result => { if (result.status !== "unavailable") setWall(result); else { setWall(null); setUnavailable({ ...result, sessionUid: auth.user?.uid }); setStatus(""); } })
          .catch(() => setStatus("The wall could not refresh. Your saved memory is still in Your memories below."));
      }} />}
        </div>
      </div> : <p className="wall-contribution-closed">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <rect x="4" y="10.5" width="16" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
        </svg>
        {preview
          ? "The add-a-memory button appears here once this wall is open."
          : "Adding memories is temporarily unavailable. Please try again later."}
      </p>)}
    </>}
    {/* The two links every wall carries, wherever the page got to: the wall,
        the closed notice and the failure all end here. They are the only
        chrome on a guest's page, so they sit under a rule and stay quiet. */}
    <footer className="wall-footer">
      <p><a href="/privacy-safety">Privacy &amp; Safety</a></p>
      <p className="wall-footer-brand">
        <a href="/" aria-label="Create a digital guestbook for your property with DigiStayBook">Powered by DigiStayBook</a>
      </p>
    </footer>
  </main>;
}



/**
 * `signedIn` decides which app asks.
 *
 * A signed-in Host reads through the default app, because a closed wall is
 * served back to its owner as a preview and the server resolves that from the
 * token on the request. Everyone else — which is every guest who has just
 * scanned a placard — reads through `wallReaderFunctions`, which carries no
 * App Check and so does not make them wait out a reCAPTCHA attestation for a
 * token this endpoint does not ask for.
 */
async function readWall(slug: string, view: "public" | "stay", stayToken: string | null, signedIn: boolean, cursor?: string): Promise<Wall | Unavailable> {
  const functions = signedIn ? (await getFirebaseServices())?.functions : await wallReaderFunctions();
  if (!functions) throw new Error("Unavailable");
  const { httpsCallable } = await import("firebase/functions");
  const response = await httpsCallable<{ slug: string; view: "public" | "stay"; token?: string; cursor?: string }, Wall | Unavailable>(functions, "getPublicWall", { timeout: 15000 })({ slug, view, ...(stayToken ? { token: stayToken } : {}), ...(cursor ? { cursor } : {}) });
  return response.data;
}
