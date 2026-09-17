import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { firebaseConfigured } from "../../lib/firebaseConfig";
import { recallProperty, rememberProperty } from "./propertyCache";
import { loadProperty, type HostProperty } from "./propertyStore";

/**
 * One property, read once.
 *
 * Every host screen for a property starts the same way — ask for it, and be
 * ready for no environment, a read in flight, a read that failed, a property
 * that is not there. The editing pages then build a draft on top of it and the
 * read-only ones do not, so the read itself lives here on its own.
 *
 * A property already read this session opens from `propertyCache` in the first
 * render, and the read then runs behind the screen rather than in front of it.
 * Moving between a property's four screens is a click, not a reload, and it
 * should not look like one: the banner, the nav and the screen stay where they
 * are and the new one is simply there.
 *
 * `onReady` is handed the property in the same tick the load lands, so a page
 * that seeds something from it does so in the same render. Seeding afterwards
 * would put one frame on the screen with the property loaded and the thing
 * seeded from it still empty, and that frame is a wall with nothing on it. A
 * page opening from the cache seeds itself from the cache instead, and is only
 * called back if the read disagrees with what it opened on.
 *
 * The setter is handed back because a page that writes to the property owns
 * what the read returned afterwards: a save is the newest truth about it, and
 * re-reading to learn what we just wrote is a round trip for nothing.
 */

export type PropertyLoad =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; property: HostProperty }
  | { status: "error"; message: string };

/** Where a screen for this property starts: on what is known, or on nothing. */
function opening(propertyId: string): PropertyLoad {
  const known = recallProperty(propertyId);
  return known ? { status: "ready", property: known } : { status: "loading" };
}

/** Whether the read agrees with what the screen opened on, field for field. */
function unchanged(before: HostProperty, after: HostProperty): boolean {
  return JSON.stringify(before) === JSON.stringify(after);
}

export function useProperty(
  propertyId: string,
  onReady?: (property: HostProperty) => void
): [PropertyLoad, Dispatch<SetStateAction<PropertyLoad>>] {
  const [load, setLoad] = useState<PropertyLoad>(() => opening(propertyId));
  // The read is keyed on the property alone, so the callback is held by ref
  // rather than re-running the read every time a page re-renders.
  const ready = useRef(onReady);
  ready.current = onReady;
  // Which property the state on screen describes, so a page handed a second
  // one while mounted starts again rather than showing the first.
  const shown = useRef(propertyId);

  // A page that writes to the property is stating the newest truth about it,
  // so what it sets is what the next screen opens on.
  const publish = useCallback<Dispatch<SetStateAction<PropertyLoad>>>((action) => {
    setLoad((current) => {
      const next = typeof action === "function" ? action(current) : action;
      if (next.status === "ready") rememberProperty(next.property);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!firebaseConfigured || !propertyId) return;
    if (shown.current !== propertyId) {
      shown.current = propertyId;
      setLoad(opening(propertyId));
    }
    let cancelled = false;
    void (async () => {
      const opened = recallProperty(propertyId);
      const outcome = await loadProperty(propertyId);
      if (cancelled) return;
      if (outcome.status === "error") {
        // A screen already showing the property keeps it. A read that failed
        // on the way past is not a reason to replace a working screen with an
        // error the Host can do nothing about; the next one asks again.
        setLoad((current) => (current.status === "ready" ? current : { status: "error", message: outcome.message }));
        return;
      }
      if (!outcome.value) {
        // The property is gone, whatever we were showing of it.
        setLoad({ status: "missing" });
        return;
      }
      const property = outcome.value;
      rememberProperty(property);
      // Seeding again would throw away anything typed since the screen opened,
      // so a page is only called back when it opened on nothing, or on
      // something the server disagrees with.
      if (!opened || !unchanged(opened, property)) ready.current?.(property);
      setLoad({ status: "ready", property });
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  return [load, publish];
}
