export function NotFoundPage() {
  return (
    <div className="page narrow-page">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p className="lede">The page you requested is unavailable. It may have moved, or the link may be incomplete.</p>
      <div className="actions">
        <a className="btn btn-primary" href="/">Return home</a>
        <a className="btn btn-secondary" href="/wall/demo-cottage">See the guest demo</a>
      </div>
    </div>
  );
}
