import { useEffect, useRef, useState, type ReactNode } from "react";
import { BrandLock, BrandMark } from "./Brand";
import { useAuth } from "./auth/AuthProvider";
import { signOutHost } from "./auth/hostAuth";
import { navigate, useLocation } from "./routing";

/** Acquisition navigation: what a visitor without a host session needs. */
const visitorLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/wall/demo-cottage", label: "See a live wall" },
  { href: "/privacy-safety", label: "Privacy & Safety" }
];

/** The dashboard's create form, addressed so the header can jump straight to it. */
const ADD_PROPERTY = "/host#add-property";

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuToggle = useRef<HTMLButtonElement>(null);
  const { status, user } = useAuth();
  const { pathname: path } = useLocation();

  useEffect(() => {
    if (!menuOpen) return;
    function dismiss(event: MouseEvent) {
      if (!(event.target instanceof Element) || menuToggle.current?.contains(event.target)) return;
      if (!menu.current?.contains(event.target) || event.target.closest("a, button")) setMenuOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuToggle.current?.focus();
    }
    document.addEventListener("click", dismiss, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", dismiss, true);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);

  // Only a Host swaps the header. An anonymous Guest wall session is signed in
  // to Firebase but is not an account holder, so it keeps the visitor header.
  const signedIn = status === "host";
  const accountName = user?.displayName?.trim() || user?.email || "Host account";

  async function handleSignOut() {
    setMenuOpen(false);
    await signOutHost();
    // Leaving a Host on a protected page after sign-out would only render a
    // refusal, so the header returns them somewhere they can still act.
    if (window.location.pathname.startsWith("/host")) navigate("/");
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <BrandLock href={signedIn ? "/host" : "/"} />
        <button
          ref={menuToggle}
          type="button"
          className="btn btn-secondary btn-sm nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
        <div ref={menu} className={menuOpen ? "header-inner open" : "header-inner"} id="primary-navigation">
          {!signedIn && (
            <nav className="site-nav" aria-label="Primary navigation">
              {visitorLinks.map((link) => (
                <a key={link.href} href={link.href} className={path === link.href ? "active" : undefined}>
                  {link.label}
                </a>
              ))}
            </nav>
          )}
          {signedIn ? (
            // The account name separates destinations from session controls.
            <nav className="header-account" aria-label="Primary navigation">
              <a className="btn btn-primary btn-sm" href="/host">Dashboard</a>
              <a className="btn btn-secondary btn-sm" href="/host/billing">Billing</a>
              <a className="btn btn-secondary btn-sm" href="/host/account" aria-current={path === "/host/account" ? "page" : undefined}>Account</a>
              <a className="btn btn-secondary btn-sm" href={ADD_PROPERTY}>Add property</a>
              <span className="header-account-name" title={user?.email ?? undefined}>{accountName}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  void handleSignOut();
                }}
              >
                Sign out
              </button>
            </nav>
          ) : (
            // While the session is still resolving the call to action is held
            // back: offering "Host sign in" to a Host who is already signed in,
            // for the moment it takes Firebase to answer, reads as a bug.
            status !== "loading" && (
              <a className="btn btn-primary btn-sm" href="/host/sign-in">Host sign in</a>
            )
          )}
        </div>
      </header>

      {/* Focusable so a client-side navigation can move focus here; see
          ui/routing. It is not in the tab order. */}
      <main id="main" tabIndex={-1}>{children}</main>

      <footer className="site-footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <a className="brand" href="/"><BrandMark /></a>
            <p className="footer-blurb">
              A digital guestbook for short-term rental hosts. Guests scan a QR display, read your house
              guidance and add a memory &mdash; no app, no account, no friction.
            </p>
          </div>
          <div className="footer-col">
            <h2>Product</h2>
            <nav aria-label="Product navigation">
              <a href="/#how-it-works">How it works</a>
              <a href="/#features">Features</a>
              <a href="/pricing">Pricing</a>
              <a href="/wall/demo-cottage">Public wall demo</a>
              <a href="/stay/demo-cottage">In-stay guest view</a>
            </nav>
          </div>
          <div className="footer-col">
            <h2>Support &amp; legal</h2>
            <nav aria-label="Support and legal navigation">
              {signedIn ? (
                <a href="/host">Your dashboard</a>
              ) : (
                <>
                  <a href="/host/sign-in">Host sign in</a>
                  <a href="/host/sign-up">Create a host account</a>
                </>
              )}
              <a href="/privacy-safety">Privacy &amp; Safety</a>
              <a href="/terms">Terms</a>
              <a href="/privacy">Privacy</a>
            </nav>
          </div>
        </div>
        <div className="footer-base">
          <span>&copy; {new Date().getFullYear()} DigiStayBook. Working implementation &mdash; not yet released.</span>
          <span>Guest stay support stays with your host or booking provider.</span>
        </div>
      </footer>
    </div>
  );
}
