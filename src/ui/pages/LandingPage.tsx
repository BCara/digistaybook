import { QrPlaceholder } from "../Brand";

const steps = [
  {
    title: "Put the QR display out",
    body: "One QR kit per property. It goes on the counter, in the welcome folder, or by the door."
  },
  {
    title: "Guests scan on arrival",
    body: "The wall opens in the browser. Wi-Fi, bin day and your local favourites are pinned to the top."
  },
  {
    title: "Notes arrive, screened",
    body: "Photos and messages pass automated screening before they publish. Anything borderline waits for you."
  }
];

const capabilities = [
  {
    title: "A wall guests actually use",
    body: "A mobile-first run of photos and notes from every stay. No account, no download, nothing in the way."
  },
  {
    title: "Your house manual, pinned",
    body: "Wi-Fi, bin days, appliance quirks, checkout steps and recommendations sit above the wall, so the questions stop arriving."
  },
  {
    title: "Screened before it publishes",
    body: "Uploads land in private storage and pass image and text screening first. Severe cases never reach your inbox."
  },
  {
    title: "One dashboard, every property",
    body: "Curate, pin, hide and delete across all your properties, with clear active and unpaid states."
  },
  {
    title: "QR kit per property",
    body: "Print, download, email or copy the link. Live routing unlocks the moment a property is activated."
  },
  {
    title: "Privacy designed in",
    body: "Consent capture, self-service deletion, a report flag on every post, and a public Privacy & Safety route that does not depend on your inbox."
  }
];

const included = [
  "Unlimited guest posts and photo uploads",
  "Printable and downloadable QR kit",
  "Pinned host posts and house guidance",
  "Automated content screening plus host approval",
  "Dashboard moderation, pinning and deletion",
  "Themes, layouts and live wall preview",
  "Private guest feedback inbox",
  "Privacy and takedown request queue"
];

export function LandingPage() {
  return (
    <div className="landing-page">
      <div className="page">
        <section className="masthead">
          <div className="masthead-copy">
            <h1>The <em>guestbook</em> your rental never had.</h1>
            <p className="masthead-lede">
              One QR display on the counter opens your house guidance, your local favourites, and every
              note left by the people who stayed before them.
            </p>
            <div className="actions">
              <a className="btn btn-primary" href="/wall/demo-cottage">See a live guest wall</a>
              <a className="btn btn-secondary" href="/host/sign-in">Host sign in</a>
            </div>
            <ul className="masthead-facts">
              <li>No app download</li>
              <li>No guest accounts</li>
              <li>28-day free trial</li>
            </ul>
          </div>

          {/* The paper book, the QR display that opens it, and the wall it becomes. */}
          <div className="masthead-art" aria-hidden="true">
            <div className="spread">
              <div className="spread-head">
                <span>Guest book</span>
                <b>Seabreeze Cottage</b>
              </div>
              <p className="hand hand-1">
                The coastal walk and the tiny bakery near the lighthouse made our week.
                <small>Mia &amp; Sam</small>
              </p>
              <p className="hand hand-2">
                Thank you for the log fire instructions. Perfect first night.
                <small>The Aldridges</small>
              </p>
              <p className="hand hand-3">
                Third year running. The garden is somehow better every time.
                <small>Priya</small>
              </p>
            </div>

            <div className="device">
              <div className="device-screen">
                <div className="device-top">
                  <span>Guest wall</span>
                  <strong>Seabreeze Cottage</strong>
                </div>
                <div className="device-feed">
                  <article className="mini-post pinned">
                    <span className="mini-tag">Pinned by host</span>
                    <p>Wi-Fi: SEABREEZE-5G &middot; Bins go out Tuesday night &middot; Sunset is best from the back deck.</p>
                  </article>
                  <article className="mini-post">
                    <img className="mini-photo" src="/wall/memory-coast.webp" alt="" width="880" height="660" />
                    <p>The coastal walk and the tiny bakery near the lighthouse made our week.</p>
                    <small>Mia &amp; Sam</small>
                  </article>
                  <article className="mini-post">
                    <p>Thank you for the log fire instructions. Perfect first night.</p>
                    <small>The Aldridges</small>
                  </article>
                  <article className="mini-post">
                    <img className="mini-photo" src="/wall/memory-garden.webp" alt="" width="880" height="660" />
                    <p>Third year running. The garden is somehow better every time.</p>
                    <small>Priya</small>
                  </article>
                </div>
                <div className="device-composer">
                  <span>Add a memory&hellip;</span>
                  <b>Post</b>
                </div>
              </div>
            </div>

            <div className="qr-display">
              <QrPlaceholder size={64} />
              <p className="qr-display-caption">Scan to leave a memory</p>
              <small>Seabreeze Cottage</small>
            </div>
          </div>
        </section>

        <div className="ledger">
          <div>
            <strong>Scan, read, post</strong>
            <p>The whole guest journey happens in a browser tab, in under a minute.</p>
          </div>
          <div>
            <strong>Curated by you</strong>
            <p>Flagged posts wait for host approval. Nothing questionable lands on the wall unreviewed.</p>
          </div>
          <div>
            <strong>Per property billing</strong>
            <p>Add as many properties as you like and manage them all from one dashboard.</p>
          </div>
        </div>

        <section className="section" id="how-it-works" aria-labelledby="how-it-works-heading">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2 id="how-it-works-heading">From a printed QR display to a wall full of memories.</h2>
          </div>
          <ol className="walkthrough">
            {steps.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section" id="features" aria-labelledby="features-heading">
          <div className="section-head">
            <p className="eyebrow">What hosts get</p>
            <h2 id="features-heading">A guestbook, a house manual and a moderation queue.</h2>
            <p className="lede">Everything below is in both plans. There is no feature tier to decode.</p>
          </div>
          <div className="capabilities">
            {capabilities.map((capability, index) => (
              <article className="capability" key={capability.title}>
                <h3>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {capability.title}
                </h3>
                <p>{capability.body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="manifesto" aria-labelledby="experience-heading">
        <div className="manifesto-inner">
          <blockquote className="quote">
            &ldquo;Staying at a friend&rsquo;s house&rdquo; is a feeling. It comes from good information, a warm
            welcome, and the sense that other people loved this place too.
            <cite>Why we built it</cite>
          </blockquote>
          <div className="manifesto-note">
            <p className="eyebrow">Why it matters</p>
            <h2 id="experience-heading">A stay that feels considered is a stay people talk about.</h2>
            <p>
              Create a more memorable guest experience&mdash;one that may encourage guests to share more
              positive feedback on their official booking platform.
            </p>
            <p className="band-note">
              DigiStayBook never asks guests for a rating, never pre-fills a review and never links into a
              booking provider&rsquo;s review form. Improved feedback is a possible indirect benefit of a better
              stay, not a guaranteed outcome.
            </p>
          </div>
        </div>
      </section>

      <div className="page landing-tail">
        <section id="pricing" aria-labelledby="pricing-heading">
          <div className="section-head">
            <p className="eyebrow">Pricing</p>
            <h2 id="pricing-heading">One price per property. Choose monthly or annual billing.</h2>
          </div>

          <div className="trial-callout">
            <strong>28-day free trial on your first property.</strong>
            <p>Create your account and add your first property to activate your 28-day free trial.</p>
          </div>

          <div className="rates">
            <article className="rate">
              <div className="rate-head">
                <h3>Monthly</h3>
              </div>
              <p className="price">$10<span> USD / month, per property</span></p>
              <p>Everything included, billed monthly. Cancel from your dashboard in one click.</p>
              <a className="btn btn-secondary btn-block" href="/host/sign-in">Create your account</a>
            </article>
            <article className="rate featured">
              <div className="rate-head">
                <h3>Annual</h3>
                <span className="rate-badge">Two months free</span>
              </div>
              <p className="price">$100<span> USD / year, per property</span></p>
              <p>The same complete platform at the annual rate, renewing automatically until you cancel.</p>
              <a className="btn btn-primary btn-block" href="/host/sign-in">Create your account</a>
            </article>
          </div>

          <div className="included">
            <h3>Included in both plans</h3>
            <ul className="check-list">
              {included.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>

          <div className="fine-print">
            <p>
              Prices are shown in USD and render in your local point-of-sale currency, rounded to the nearest
              whole unit, at checkout.
            </p>
            <p>Billing is calculated per property. Every property is managed from a single host dashboard.</p>
            <p>DigiStayBook may be deductible as a business expense. Eligibility depends on your circumstances and business use; seek tax advice.</p>
            <p>
              Cancel anytime before your next billing cycle &mdash;{" "}
              <a className="text-link" href="/terms">read the Cancellation &amp; Billing Policy</a>.
            </p>
          </div>
        </section>

        <section className="section closing">
          <h2>Give your next guests something better than a laminated sheet.</h2>
          <div className="closing-side">
            <p>Open the demo to see exactly what your guests see, then set up your first property.</p>
            <div className="actions">
              <a className="btn btn-primary" href="/wall/demo-cottage">Open the public wall</a>
              <a className="btn btn-secondary" href="/stay/demo-cottage">See the in-stay view</a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
