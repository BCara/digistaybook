import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useProperty } from "../host/useProperty";
import { propertyBlock } from "../host/usePropertyDraft";
import { PropertyShell } from "../host/PropertyShell";
import { hostCall } from "../host/GuestReviewPanel";
import type { HostProperty } from "../host/propertyStore";
import type { ExportPost } from "../host/exportArchive";

export function HostExportPage({ propertyId }: { propertyId: string }) {
  const { user } = useAuth(), [load] = useProperty(propertyId);
  const [cursor, setCursor] = useState<string | null>(null), [part, setPart] = useState(1);
  const [done, setDone] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; }, []);
  const block = propertyBlock(load, user?.uid);
  if (block) return <main className="page"><h1>{block.title}</h1><p>{block.message}</p></main>;
  const property = (load as { status: "ready"; property: HostProperty }).property;
  async function download() {
    cancelled.current = false; setBusy(true); setNotice("Preparing messages…");
    try {
      const page = await hostCall<{ name: string; posts: ExportPost[]; nextCursor: string | null }>("listHostExport", { propertyId, cursor });
      const photos: Record<string, Uint8Array> = {}; let size = 0;
      for (const post of page.posts) for (let index = 0; index < post.photoCount; index++) {
        if (cancelled.current) throw new Error("Cancelled");
        setNotice(`Preparing photo ${index + 1} of ${post.photoCount}…`);
        const photo = await hostCall<{ base64: string }>("readHostExportPhoto", { propertyId, postId: post.id, index });
        const bytes = Uint8Array.from(atob(photo.base64), char => char.charCodeAt(0));
        size += bytes.length;
        if (size > 80 * 1024 * 1024) throw new Error("Too large");
        photos[`photos/${post.id}-${index}.webp`] = bytes;
      }
      if (cancelled.current) throw new Error("Cancelled");
      const { exportArchive } = await import("../host/exportArchive");
      if (cancelled.current) throw new Error("Cancelled");
      const bytes = exportArchive(page.name, page.posts, photos);
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/zip" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `guestbook-${propertyId}-part-${part}.zip`;
      document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setCursor(page.nextCursor); setDone(!page.nextCursor); setPart(value => value + 1);
      setNotice(`Part ${part} prepared with ${page.posts.length} memories. ${page.nextCursor ? "Download the next part to continue." : "All parts prepared."} Check your browser downloads.`);
    } catch { setNotice(cancelled.current ? "Export cancelled. You can retry this part." : "This part could not be completed. Retry it; no partial ZIP was downloaded."); }
    finally { setBusy(false); }
  }
  return <PropertyShell property={property} current="export"><section><h2>Take your guestbook with you</h2>
    <p>Download ZIP parts containing messages, photos and an offline readable copy. Each part checks up to three memories to keep downloads manageable.</p>
    <p>Only visible, unrestricted memories are included. Older external photos are identified if they cannot be included.</p>
    <p role="status">{notice}</p>
    <button disabled={busy || done} onClick={() => void download()}>Download ZIP part {part}</button>
    {busy && <button onClick={() => { cancelled.current = true; }}>Cancel export</button>}
    {done && <button onClick={() => { setCursor(null); setPart(1); setDone(false); setNotice(""); }}>Start a fresh export</button>}
  </section></PropertyShell>;
}
