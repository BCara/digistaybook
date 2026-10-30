import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useProperty } from "../host/useProperty";
import { propertyBlock } from "../host/usePropertyDraft";
import { PropertyShell } from "../host/PropertyShell";
import { hostCall } from "../host/GuestReviewPanel";
import type { HostProperty } from "../host/propertyStore";
import type { ExportPost } from "../host/exportArchive";

// A part stops taking memories once its photographs reach this, so a ZIP stays
// a size a browser can hold in memory and a Host can download in one go. A
// single memory is never split: ten full-size photographs still fit.
const PART_PHOTO_BUDGET = 60 * 1024 * 1024;

type Progress = { cursor: string; part: number };
// Where the Host got to, kept in this browser so leaving the page — or a
// download that takes a while — does not send them back to part 1.
const progressKey = (propertyId: string) => `digistaybook:export:${propertyId}`;
function readProgress(propertyId: string): Progress | null {
  try {
    const saved = JSON.parse(localStorage.getItem(progressKey(propertyId)) ?? "null");
    return saved && typeof saved.cursor === "string" && Number.isInteger(saved.part) && saved.part > 1 ? saved : null;
  } catch { return null; }
}
function writeProgress(propertyId: string, progress: Progress | null) {
  try {
    if (progress) localStorage.setItem(progressKey(propertyId), JSON.stringify(progress));
    else localStorage.removeItem(progressKey(propertyId));
  } catch { /* Progress is a convenience; the export works without it. */ }
}

export function HostExportPage({ propertyId }: { propertyId: string }) {
  const { user } = useAuth(), [load] = useProperty(propertyId);
  const [saved] = useState(() => readProgress(propertyId));
  const [cursor, setCursor] = useState<string | null>(saved?.cursor ?? null), [part, setPart] = useState(saved?.part ?? 1);
  const [done, setDone] = useState(false), [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(saved ? `Picking up where you left off: parts 1 to ${saved.part - 1} were downloaded earlier.` : "");
  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; }, []);
  const block = propertyBlock(load, user?.uid);
  if (block) return <main className="page"><h1>{block.title}</h1><p>{block.message}</p></main>;
  const property = (load as { status: "ready"; property: HostProperty }).property;
  async function download() {
    cancelled.current = false; setBusy(true); setNotice("Preparing messages…");
    try {
      type Page = { name: string; posts: ExportPost[]; nextCursor: string | null };
      let page = await hostCall<Page>("listHostExport", { propertyId, cursor });
      // A stretch of hidden or removed memories yields an empty page; read on
      // rather than hand the Host a ZIP with nothing in it.
      while (page.posts.length === 0 && page.nextCursor) {
        if (cancelled.current) throw new Error("Cancelled");
        page = await hostCall<Page>("listHostExport", { propertyId, cursor: page.nextCursor });
      }
      const photos: Record<string, Uint8Array> = {}; let size = 0;
      // Memories taken whole, in order, until the photographs reach the
      // budget; the rest wait for the next part, which starts after the last
      // memory this one kept.
      const included: ExportPost[] = [];
      for (const [position, post] of page.posts.entries()) {
        if (included.length > 0 && size >= PART_PHOTO_BUDGET) break;
        for (let index = 0; index < post.photoCount; index++) {
          if (cancelled.current) throw new Error("Cancelled");
          setNotice(`Preparing memory ${position + 1} of ${page.posts.length}, photo ${index + 1} of ${post.photoCount}…`);
          const photo = await hostCall<{ base64: string }>("readHostExportPhoto", { propertyId, postId: post.id, index });
          const bytes = Uint8Array.from(atob(photo.base64), char => char.charCodeAt(0));
          size += bytes.length;
          photos[`photos/${post.id}-${index}.webp`] = bytes;
        }
        included.push(post);
      }
      const stoppedEarly = included.length < page.posts.length;
      const next = stoppedEarly ? included.at(-1)!.id : page.nextCursor;
      if (cancelled.current) throw new Error("Cancelled");
      const { exportArchive } = await import("../host/exportArchive");
      if (cancelled.current) throw new Error("Cancelled");
      const bytes = exportArchive(page.name, included, photos);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/zip" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `guestbook-${propertyId}-part-${part}.zip`;
      document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setCursor(next); setDone(!next); setPart(value => value + 1);
      writeProgress(propertyId, next ? { cursor: next, part: part + 1 } : null);
      setNotice(`Part ${part} prepared with ${included.length} ${included.length === 1 ? "memory" : "memories"}. ${next ? "Download the next part to continue." : "That was the last part."} Check your browser downloads.`);
    } catch { setNotice(cancelled.current ? "Export cancelled. You can retry this part." : "This part could not be completed. Retry it; no partial ZIP was downloaded."); }
    finally { setBusy(false); }
  }
  return <PropertyShell property={property} current="export"><section><h2>Take your guestbook with you</h2>
    <p>Download your guestbook as ZIP files containing messages, photos and a copy you can read offline. Each part holds up to 25 memories, or fewer when they have a lot of photos, so every download stays a manageable size.</p>
    <p>Only visible, unrestricted memories are included. Older external photos are identified if they cannot be included.</p>
    <p role="status">{notice}</p>
    <button disabled={busy || done} onClick={() => void download()}>Download ZIP part {part}</button>
    {busy && <button onClick={() => { cancelled.current = true; }}>Cancel export</button>}
    {(done || (part > 1 && !busy)) && <button onClick={() => { setCursor(null); setPart(1); setDone(false); setNotice(""); writeProgress(propertyId, null); }}>Start a fresh export</button>}
  </section></PropertyShell>;
}
