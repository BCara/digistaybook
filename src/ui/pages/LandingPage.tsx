import { useEffect } from "react";
import { QrPlaceholder } from "../Brand";
import { navigate } from "../routing";
import {
  currencyFor,
  publishedPlans,
  taxCallout,
  taxHeadline,
  taxPitch,
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
    body: "The wall opens in the browser. Wi-Fi, trash day and your local favorites are pinned to the top."
  },
  {
    title: "Notes arrive, screened",
    body: "Photos and messages pass automated screening before they publish. Anything borderline waits for you."
  }
];

const capabilities = [
  {
    title: "Your house manual, pinned",
    body: "Wi-Fi, trash days, appliance quirks, checkout steps and recommendations sit above the wall, so the questions stop arriving."
  },
  {
    title: "A wall guests actually use",
    body: "A mobile-first run of photos and notes from every stay, added from a browser tab in under a minute."
  },
  {
    title: "One dashboard, every property",
    body: "Curate, pin, hide and delete across all your properties, with clear active and unpaid states."
  }
];

export function LandingPage() {
  const { status } = useAuth();
  // The footer's "How it works" and "Features" are sections of this page, and
  // a Host who follows one asked for the section, not their dashboard.
  const section = typeof window !== "undefined" && window.location.hash.length > 1;
  useEffect(() => {
    if (status === "host" && !section) navigate("/host", { replace: true });
  }, [status, section]);

  // While the session restores, the page is the one almost every reader of it
  // will get: the visitor landing page. It is also what the build prerenders,
  // so a crawler and a first paint both see the content rather than a status
  // line. A Host is moved to the dashboard the moment the session says so.
  if (status === "host" && !section) return null;
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
  // an unlabelled "$10" is not a price. The visitor's own region picks it, the
  // same way /pricing does: the country's own price on the ladder, else USD.
  const currency = currencyFor(detectBillingCountry());
  const [monthly, annual] = publishedPlans(currency);

  return (
    <div className="landing-page">
      <div className="page">
        <section className="masthead">
          <div className="masthead-copy">
            <h1>The <em>guestbook</em> your rental never had.</h1>
            <p className="masthead-lede">
              One QR display on the counter opens your house guidance, your local favorites, and every
              note left by the people who stayed before them.
            </p>
            <div className="actions">
              <a className="btn btn-primary" href="/stay/demo-cottage">See what guests see</a>
              <a className="btn btn-secondary" href="/host/sign-in">Host sign in</a>
            </div>
            <ul className="masthead-facts">
              <li>No app download</li>
              <li>No guest accounts</li>
              <li>28-day free trial</li>
            </ul>
            <p className="masthead-tax">
              <a href="#tax">{taxHeadline}<sup>*</sup></a> as a business expense
            </p>
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
                    <p>Wi-Fi: SEABREEZE-5G &middot; Trash goes out Tuesday night &middot; Sunset is best from the back deck.</p>
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
            <p>
              Your wall can also give guests helpful information that booking platforms may restrict in their
              messages: your own local recommendations, useful links and the house details that make a stay
              easier.
            </p>
          </div>
        </div>
      </section>

      <div className="page landing-tail">
        {/* BOP §6.3.3 asks the landing page for "a concise pricing prompt",
            not a second pricing page. The rates, the trial and the link are
            here; the unified checklist, the currency choice and the
            cancellation terms are §6.3.4's job, at /pricing. The tax message
            is the exception: it is advertised, so it sits beside the rates on
            both pages with its small print attached. Every figure
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

          <TaxCallout />
        </section>

        <section className="section closing">
          <h2>Give your next guests something better than a laminated sheet.</h2>
          <div className="closing-side">
            <p>Open the demo to see exactly what your guests see, then set up your first property.</p>
            <div className="actions">
              <a className="btn btn-primary" href="/stay/demo-cottage">See what guests see</a>
              <a className="btn btn-secondary" href={signUpHref}>{signUpLabel}</a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * The tax message as an advertisement with its footnote: the starred headline,
 * the reason, and BOP §4.1's approved wording as the small print. Shared with
 * /pricing so the headline never appears without the wording beside it.
 */
export function TaxCallout() {
  return (
    <aside className="tax-callout" id="tax" aria-labelledby="tax-heading">
      <p className="tax-stamp" aria-hidden="true">Tax time</p>
      <div>
        <h3 id="tax-heading">{taxHeadline}<sup>*</sup></h3>
        <p>{taxPitch}</p>
        <p className="tax-small-print"><span aria-hidden="true">* </span>{taxCallout}</p>
      </div>
    </aside>
  );
}
