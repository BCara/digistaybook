import { useEffect, useRef, useState } from "react";
import { getFirebaseServices } from "../../lib/firebase";
import { guestPhotoUrl } from "../../lib/guestSession";

type PhotoProps = { postId: string; index: number; ownerPropertyId?: string; sessionUid?: string };
type PhotoLoad = { status: "loading" } | { status: "ready"; src: string } | { status: "error" };

/** Closed walls use the existing owner-only reader; their public photo URLs are closed too. */
export function MemoryPhoto({ postId, index, ownerPropertyId, sessionUid }: PhotoProps) {
  if (ownerPropertyId && sessionUid) return <OwnerPhoto key={`${sessionUid}:${ownerPropertyId}:${postId}:${index}`} propertyId={ownerPropertyId} postId={postId} index={index} />;
  return <img src={guestPhotoUrl(postId, index)} alt={`Guest memory photo ${index + 1}`} loading="lazy" />;
}

function OwnerPhoto({ propertyId, postId, index }: { propertyId: string; postId: string; index: number }) {
  const [load, setLoad] = useState<PhotoLoad>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setLoad({ status: "loading" });
    async function read() {
      timer = setTimeout(() => { if (current) { current = false; setLoad({ status: "error" }); } }, 15000);
      try {
        const services = await getFirebaseServices();
        if (!services) throw new Error("Photo unavailable");
        if (!current) return;
        const { httpsCallable } = await import("firebase/functions");
        // This endpoint verifies ownership and rechecks visibility/safety after reading the bytes.
        const result = await httpsCallable<{ propertyId: string; postId: string; index: number }, { base64: string }>(services.functions, "readHostExportPhoto", { timeout: 15000 })({ propertyId, postId, index });
        if (!result.data.base64) throw new Error("Photo unavailable");
        if (current) setLoad({ status: "ready", src: `data:image/webp;base64,${result.data.base64}` });
      } catch {
        if (current) setLoad({ status: "error" });
      } finally { clearTimeout(timer); }
    }
    // Keep an owner's long wall from downloading every full-size photo at once.
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== "undefined" && target.current) {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { observer?.disconnect(); void read(); }
      }, { rootMargin: "200px" });
      observer.observe(target.current);
    } else void read();
    return () => { current = false; clearTimeout(timer); observer?.disconnect(); };
  }, [propertyId, postId, index, attempt]);

  return <div ref={target}>
    {load.status === "ready" ? <img src={load.src} alt={`Guest memory photo ${index + 1}`} onError={() => setLoad({ status: "error" })} />
      : load.status === "error" ? <div className="field-hint"><p>This photo couldn’t load.</p><button type="button" className="btn btn-secondary btn-sm" onClick={() => setAttempt(value => value + 1)}>Retry photo {index + 1}</button></div>
        : <p className="field-hint" role="status">Loading photo {index + 1}…</p>}
  </div>;
}
