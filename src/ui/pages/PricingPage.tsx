import {
  annualSaving,
  countryNames,
  currencyForCountry,
  currencyNames,
  formatRate,
  includedFeatures,
  publishedPlans,
  taxCallout,
  trialCallout,
  trialDays,
  type PosCurrency
} from "../../domain/pricing";
import { useAuth } from "../auth/AuthProvider";
import { detectBillingCountry } from "../host/billingCountry";

/**
 * BOP §6.3.4 — the pricing page.
 *
 * Every figure on this page comes from `domain/pricing`, which is the same rate
 * card `functions/src/billingPolicy.ts` holds and `stripeActivation.quote()`
 * refuses to sell against. That is what makes §4.3 — marketing, checkout and
 * the policies describing "the same offer, in the same words, at the same
 * price" — a property of the code rather than a note in a document. Nothing
 * here is a hand-typed price, a hand-typed saving, or a rephrasing of the
 * trial and tax callouts the plan fixes word for word.
 *
 * One currency, the visitor's own. §4.1 quotes a Host in their own
 * point-of-sale currency, so the page shows only that one rather than a
 * switch between two dollars: AUD for a visitor in Australia, USD for everyone
 * else. Every rate still names its dollar (A$, US$), and the activation screen
 * asks the billing country before anything is charged.
 */
export function PricingPage() {
  const { status } = useAuth();
  const signedIn = status === "host";

  // One currency, the visitor's own: AUD in Australia and USD everywhere else.
  // `detectBillingCountry` returns null outside the two countries we serve, so
  // USD is also what anyone we cannot place reads, as the fine print says.
  // Checkout asks the billing country again, so this is never the last word.
  const detected = detectBillingCountry();
  const currency: PosCurrency = detected ? currencyForCountry[detected] : "usd";

  const [monthly, annual] = publishedPlans(currency);
  const saving = formatRate(annualSaving(currency), currency);

  // §6.3.4's conditional action: a Host who already holds an account is not
  // sent through sign-up to reach the thing they are being sold.
  const startHref = signedIn ? "/host#add-property" : "/host/sign-up";
  const startLabel = signedIn ? "Add a property" : "Create free account";

  return (
    <div className="page pricing-page">
      <section id="pricing" aria-labelledby="pricing-heading">
        <div className="section-head">
          <p className="eyebrow">Pricing</p>
          <h1 id="pricing-heading">One price per property. Everything included.</h1>
          <p className="lede">
            There is no feature tier to decode. Monthly and annual buy the same complete platform; the only
            difference is how often you are billed and what it costs you over a year.
          </p>
        </div>

        <div className="trial-callout">
          <strong>{trialDays}-day free trial on your first property.</strong>
          <p>{trialCallout}</p>
        </div>

        <div className="rates">
          <article className="rate">
            <div className="rate-head">
              <h2>Monthly</h2>
            </div>
            <p className="price">{monthly!.rate}<span> {monthly!.period}</span></p>
            <p>Billed every month. Cancel from your dashboard in one click.</p>
            <a className="btn btn-secondary btn-block" href={startHref}>{startLabel}</a>
          </article>
          <article className="rate featured">
            <div className="rate-head">
              <h2>Annual</h2>
              {annual!.saving && <span className="rate-badge">{annual!.saving}</span>}
            </div>
            <p className="price">{annual!.rate}<span> {annual!.period}</span></p>
            <p>
              The same platform, charged once a year and renewing automatically until you cancel.
              {annual!.saving && ` That is ${saving} less than twelve months at the monthly rate.`}
            </p>
            <a className="btn btn-primary btn-block" href={startHref}>{startLabel}</a>
          </article>
        </div>

        <div className="included">
          <h2>Included in both plans</h2>
          <ul className="check-list">
            {includedFeatures.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>

        <div className="fine-print">
          <p>
            Prices are shown in {currencyNames[currency]} and charged in the currency of the country you are
            billed in. DigiStayBook currently sells in {countryNames.AU} and {countryNames.US}; checkout
            confirms the exact amount and date before you pay anything.
          </p>
          <p>Billing is per property. Every property is managed from a single host dashboard.</p>
          <p>{taxCallout}</p>
          <p>
            Cancel anytime before your next billing cycle &mdash;{" "}
            <a className="text-link" href="/terms">read the Cancellation &amp; Billing Policy</a>. Canceling
            keeps your wall and QR display working until the end of the period you have paid for.
          </p>
        </div>
      </section>

      <section className="section closing">
        <h2>See the product before you pay for it.</h2>
        <div className="closing-side">
          <p>
            You can create an account, add a property, write your welcome notes and preview every theme
            without paying. Only the live guest link and the printable QR kit wait for activation.
          </p>
          <div className="actions">
            <a className="btn btn-primary" href="/stay/demo-cottage">See what guests see</a>
            {signedIn ? (
              <a className="btn btn-secondary" href="/host">Go to your dashboard</a>
            ) : (
              <a className="btn btn-secondary" href="/host/sign-in">Host sign in</a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
