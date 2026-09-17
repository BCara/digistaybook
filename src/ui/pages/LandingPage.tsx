import { useEffect } from "react";
import { QrPlaceholder } from "../Brand";
import { navigate } from "../routing";
import {
  currencyForCountry,
  publishedPlans,
  trialCallout,
  trialDays
} from "../../domain/pricing";
import { useAuth } from "../auth/AuthProvider";
import { detectBillingCountry } from "../host/billingCountry";

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

export function LandingPage() {
  const { status } = useAuth();
  useEffect(() => {
    if (status === "host") navigate("/host", { replace: true });
  }, [status]);

  if (status === "loading") {
    return <div className="page"><p role="status">Checking your session…</p></div>;
  }
  if (status === "host") return null;
  if (status === "error") return <div className="page">
    <p role="alert">Your session couldn't load. Check your connection and try again.</p>
    <button className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button>
  </div>;
  return <VisitorLandingPage />;
}

function VisitorLandingPage() {
  const signUpHref = "/host/sign-up";
  const signUpLabel = "Create your account";

  // A price has to be in some currency, and with two dollar currencies on sale
  // an unlabelled "$10" is not a price. The browser's own region opens the
  // quote and /pricing is where it can be changed, so this page stays a prompt.
  const detected = detectBillingCountry();
  const currency = detected ? currencyForCountry[detected] : "usd";
  const [monthly, annual] = publishedPlans(currency);

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
              <a className="btn btn-primary" href="/wall/demo-cottage">See a live public wall</a>
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
                  <span>Public wall</span>
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
                  <div className="btn btn-primary btn-block btn-sm">Add a memory</div>
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
        {/* BOP §6.3.3 asks the landing page for "a concise pricing prompt",
            not a second pricing page. The rates, the trial and the link are
            here; the unified checklist, the currency choice and the tax and
            cancellation callouts are §6.3.4's job, at /pricing. Every figure
            comes from domain/pricing, so the two pages cannot disagree. */}
        <section id="pricing" aria-labelledby="pricing-heading">
          <div className="section-head">
            <p className="eyebrow">Pricing</p>
            <h2 id="pricing-heading">One price per property. Choose monthly or annual billing.</h2>
          </div>

          <div className="trial-callout">
            <strong>{trialDays}-day free trial on your first property.</strong>
            <p>{trialCallout}</p>
          </div>

          <div className="rates">
            <article className="rate">
              <div className="rate-head">
                <h3>Monthly</h3>
              </div>
              <p className="price">{monthly!.rate}<span> {monthly!.period}</span></p>
              <p>Everything included, billed monthly. Cancel from your dashboard in one click.</p>
              <a className="btn btn-secondary btn-block" href={signUpHref}>{signUpLabel}</a>
            </article>
            <article className="rate featured">
              <div className="rate-head">
                <h3>Annual</h3>
                {annual!.saving && <span className="rate-badge">{annual!.saving}</span>}
              </div>
              <p className="price">{annual!.rate}<span> {annual!.period}</span></p>
              <p>The same complete platform at the annual rate, renewing automatically until you cancel.</p>
              <a className="btn btn-primary btn-block" href={signUpHref}>{signUpLabel}</a>
            </article>
          </div>

          <p className="rates-more">
            <a className="text-link" href="/pricing">See everything included, and the billing terms</a>
          </p>
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
