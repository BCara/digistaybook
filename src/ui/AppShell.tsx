import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/">DigiStayBook</a>
        <nav aria-label="Primary navigation">
          <a href="/wall/demo-cottage">Guest demo</a>
          <a href="/privacy-safety">Privacy &amp; Safety</a>
          <a href="/host/sign-in">Host sign in</a>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <span>DigiStayBook working implementation</span>
        <nav aria-label="Legal navigation"><a href="/terms">Terms</a><a href="/privacy">Privacy</a></nav>
      </footer>
    </div>
  );
}
