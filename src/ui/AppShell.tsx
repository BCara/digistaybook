import { useState, type ReactNode } from "react";
import { BrandLock, BrandMark, Wordmark } from "./Brand";

const primaryLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/wall/demo-cottage", label: "See a live wall" },
  { href: "/privacy-safety", label: "Privacy & Safety" }
];

function currentPath(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const path = currentPath();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <BrandLock />
        <button
          type="button"
          className="btn btn-secondary btn-sm nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
        <div className={menuOpen ? "header-inner open" : "header-inner"} id="primary-navigation">
          <nav className="site-nav" aria-label="Primary navigation">
            {primaryLinks.map((link) => (
              <a key={link.href} href={link.href} className={path === link.href ? "active" : undefined}>
                {link.label}
              </a>
            ))}
          </nav>
          <a className="btn btn-primary btn-sm" href="/host/sign-in">Host sign in</a>
        </div>
      </header>

      <main id="main">{children}</main>

      <footer className="site-footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <a className="brand" href="/"><BrandMark /><Wordmark /></a>
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
              <a href="/#pricing">Pricing</a>
              <a href="/wall/demo-cottage">Public wall demo</a>
              <a href="/stay/demo-cottage">In-stay guest view</a>
            </nav>
          </div>
          <div className="footer-col">
            <h2>Support &amp; legal</h2>
            <nav aria-label="Support and legal navigation">
              <a href="/host/sign-in">Host sign in</a>
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
