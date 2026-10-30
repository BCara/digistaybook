import { useEffect, useRef, useState, type ReactNode } from "react";
import { BrandLock, BrandMark } from "./Brand";
import { useAuth } from "./auth/AuthProvider";
import { signOutHost } from "./auth/hostAuth";
import { navigate, useLocation } from "./routing";
import { HelpWidget } from "./help/HelpWidget";

/** Acquisition navigation: what a visitor without a host session needs. */
const visitorLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/stay/demo-cottage", label: "See what guests see" },
  { href: "/privacy-safety", label: "Privacy & Safety" }
];

/** Official DigiStayBook social profiles, shown at the foot of every page. */
const socialLinks = [
  {
    href: "https://www.facebook.com/profile.php?id=61595061885990",
    label: "Facebook",
    icon: "M14 8.5V6.6c0-.8.2-1.3 1.4-1.3H17V2.2c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.3H8v3.4h2.6V22H14V11.9h2.7l.4-3.4H14z"
  },
  {
    href: "https://www.pinterest.com/digistaybook/",
    label: "Pinterest",
    icon: "M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"
  }
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
            <nav className="footer-social" aria-label="DigiStayBook on social media">
              {socialLinks.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                    <path d={link.icon} fill="currentColor" />
                  </svg>
                  <span>{link.label}</span>
                </a>
              ))}
            </nav>
          </div>
          <div className="footer-col">
            <h2>Product</h2>
            <nav aria-label="Product navigation">
              <a href="/#how-it-works">How it works</a>
              <a href="/#features">Features</a>
              <a href="/pricing">Pricing</a>
              <a href="/qr-sign-maker">Free QR sign maker</a>
              <a href="/stay/demo-cottage">Guest wall demo</a>
              <a href="/wall/demo-cottage">Public page demo</a>
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
              <a href="/contact">Contact us</a>
              <a href="/privacy-safety">Privacy &amp; Safety</a>
              <a href="/terms">Terms</a>
              <a href="/privacy">Privacy</a>
            </nav>
          </div>
        </div>
        <div className="footer-base">
          <span>&copy; {new Date().getFullYear()} DigiStayBook.</span>
          <span>Guest stay support stays with your host or booking provider.</span>
        </div>
      </footer>
      {!/^\/(stay|wall|embed|operations)(\/|$)/.test(path) && <HelpWidget />}
    </div>
  );
}

