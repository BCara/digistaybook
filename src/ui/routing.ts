import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Client-side navigation, in the shape the app already has.
 *
 * Every link in this app is a plain `<a href>`, and every one of them used to
 * be a full document load: React unmounted, the Firebase SDK was imported
 * again, the session was resolved again and the page's first Firestore read
 * started again — all in series, before anything appeared. A Host moving
 * between the dashboard, a property, its walls and its moderation queue paid
 * that four times over.
 *
 * Rather than replace every link with a component, one delegated click handler
 * turns a same-origin navigation into a history push and re-renders the tree.
 * The SDK, the resolved session and Firestore's open connection all survive,
 * so a second page costs a render rather than a boot.
 *
 * A link that only changes the fragment is deliberately left to the browser:
 * `#add-property` is heard through `hashchange` (HostDashboardPage), and
 * `pushState` does not fire it.
 */
export type AppLocation = { pathname: string; hash: string; scroll?: { top: number; left: number } };

const listeners = new Set<() => void>();

function read(): AppLocation {
  if (typeof window === "undefined") return { pathname: "/", hash: "" };
  return { pathname: window.location.pathname, hash: window.location.hash };
}

/**
 * Navigate without a document load. An off-site URL still leaves the app, so
 * this is safe to call with anything a link could hold.
 */
export function navigate(href: string, options: { replace?: boolean } = {}): void {
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) {
    window.location.assign(url.href);
    return;
  }
  if (options.replace) window.history.replaceState(null, "", url.href);
  else window.history.pushState(null, "", url.href);
  for (const listener of [...listeners]) listener();
}

/** The current location, re-read on a push, a back button or a fragment jump. */
export function useLocation(): AppLocation {
  const [location, setLocation] = useState(read);

  useEffect(() => {
    // Capture before React changes the page height and browser scroll anchoring
    // can move the viewport as one wall's settings replace the other's.
    const update = () => setLocation({ ...read(), scroll: { top: window.scrollY, left: window.scrollX } });
    listeners.add(update);
    // A child can redirect in its mount effect before this subscription starts.
    const current = read();
    setLocation(previous => previous.pathname === current.pathname && previous.hash === current.hash ? previous : current);
    window.addEventListener("popstate", update);
    // Fragment-only links are still the browser's to handle; this keeps the
    // rendered location honest when it handles one.
    window.addEventListener("hashchange", update);
    return () => {
      listeners.delete(update);
      window.removeEventListener("popstate", update);
      window.removeEventListener("hashchange", update);
    };
  }, []);

  return location;
}

/**
 * Where a click is going, or null when the browser should keep it: another
 * origin, a download, a new tab, a modified click, or a jump within this page.
 */
function destination(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;

  const anchor = event.target instanceof Element ? event.target.closest("a") : null;
  if (!anchor || anchor.hasAttribute("download")) return null;

  const linkTarget = anchor.getAttribute("target");
  if (linkTarget && linkTarget !== "_self") return null;

  const href = anchor.getAttribute("href");
  if (!href) return null;

  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // Same page, different fragment. The browser scrolls to it and fires
  // `hashchange`; intercepting would silence the pages listening for that.
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;

  return url.href;
}

/**
 * Intercepts in-app links, and puts the reader where a document load would
 * have put them: at the top of the new page, with focus out of the old one.
 */
export function useLinkNavigation(location: AppLocation): void {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const href = destination(event);
      if (!href) return;
      event.preventDefault();
      navigate(href);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // The location the document loaded at needs neither: the browser already put
  // the reader there. Tracking it by value rather than by a "first run" flag
  // keeps this idempotent under StrictMode's double-invoked effects.
  const settled = useRef(`${location.pathname}${location.hash}`);
  useLayoutEffect(() => {
    const here = `${location.pathname}${location.hash}`;
    if (settled.current === here) return;
    const previous = settled.current;
    settled.current = here;

    // These are two views of the same mounted editor. Keep the property's
    // navigation in place when switching, including with Back and Forward.
    const wallEditor = /^\/host\/property\/([^/]+)(?:\/public)?$/;
    const previousProperty = wallEditor.exec(previous)?.[1];
    const currentProperty = wallEditor.exec(here)?.[1];
    const sameEditor = previousProperty !== undefined && previousProperty === currentProperty;

    // Both jumps are explicitly instant. The stylesheet asks for smooth
    // scrolling, which is right for a jump within a page and wrong for
    // arriving at a new one: a document load lands where it lands, it does not
    // glide there from the last page's scroll position.
    const anchored = location.hash ? document.getElementById(location.hash.slice(1)) : null;
    if (anchored) {
      anchored.scrollIntoView({ behavior: "instant" });
      return;
    }
    window.scrollTo({ ...(sameEditor && location.scroll ? location.scroll : { top: 0, left: 0 }), behavior: "instant" });
    // `main` is the new page; focusing it is what tells a screen reader that
    // the page changed, since no document load announced it.
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [location.pathname, location.hash]);
}
