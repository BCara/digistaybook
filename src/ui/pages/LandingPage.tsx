export function LandingPage() {
  return (
    <div className="page landing-page">
      <section className="hero">
        <p className="eyebrow">A warmer, more useful guest experience</p>
        <h1>Turn each stay into a shared property story.</h1>
        <p>DigiStayBook combines an easy QR guest wall with practical property guidance—without requiring guests to create an account or install an app.</p>
        <div className="actions"><a className="primary-action" href="/wall/demo-cottage">Open the guest demo</a><a className="secondary-action" href="/host/sign-in">Host sign in</a></div>
      </section>
      <section className="feature-grid" aria-label="Product highlights">
        <article><h2>Scan and contribute</h2><p>Guests can view approved memories and add their own with explicit content consent.</p></article>
        <article><h2>Guide the stay</h2><p>Hosts can pin useful property information and local recommendations above the wall.</p></article>
        <article><h2>Calm controls</h2><p>Reporting, moderation, privacy and deletion routes are designed into the service from the start.</p></article>
      </section>
    </div>
  );
}
