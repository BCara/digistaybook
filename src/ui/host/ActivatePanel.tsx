import { useEffect, useState } from "react";
import type { HostProperty } from "./propertyStore";
import { detectBillingCountry } from "./billingCountry";
import {
  annualSaving,
  formatRate,
  monthsFreeOnAnnual,
  posCurrencies,
  type PosCurrency
} from "../../domain/pricing";
import {
  loadActivationOffer,
  redirectToCheckout,
  startActivationCheckout,
  type ActivationOffer,
  type ActivationPlanOffer,
  type BillingCountry
} from "./billingStore";

/**
 * The screen a Host meets before Stripe does.
 *
 * BOP §6.3.4 requires the exact trial end date and a ticked acknowledgement
 * *before* payment details are collected, and Stripe's hosted page cannot
 * render our checkbox in our words. So the order is ours: establish where the
 * Host is billed (which sets the currency and is the §3a layer-1 country
 * gate), read the disclosure the server quotes, tick the box against a
 * specific price and date, and only then is a Checkout Session created.
 *
 * The country is guessed from the browser so the Host can see prices
 * immediately. The guess is stated in plain words next to that price and is one
 * click to overrule; when the browser looks like neither served country, the
 * question is asked outright rather than answered wrongly.
 *
 * Every dated or priced sentence here is a string the server returned, not one
 * this component built, so marketing, checkout and the acknowledgement record
 * are guaranteed to read the same (BOP §4.3).
 *
 * ---------------------------------------------------------------------------
 * Two plans, side by side, and the terms once.
 *
 * The screen used to stack the plans as two radio rows, each carrying its own
 * seventy-word §6.3.4 disclosure. That put the two things a Host is actually
 * choosing between — fifteen dollars a month or a hundred and fifty a year —
 * in the same typographic weight as two near-identical paragraphs of law, and
 * asked them to spot the difference by reading both. The comparison is the
 * decision, so the prices are set against each other in the columns the
 * pricing page already uses, and the disclosure appears once, underneath,
 * for the plan actually chosen — which is the only one it describes and the
 * only point at which §6.3.4 requires it to be read.
 */

const COUNTRIES: { code: BillingCountry; name: string }[] = [
  { code: "AU", name: "Australia" },
  { code: "US", name: "United States" }
];

const PLAN_NAMES: Record<ActivationPlanOffer["plan"], string> = {
  monthly: "Monthly",
  annual: "Annual"
};

const PLAN_PERIODS: Record<ActivationPlanOffer["plan"], string> = {
  monthly: "per month",
  annual: "per year"
};

/**
 * A point-of-sale currency, or null for one this app has no rate card for.
 *
 * Only the annual saving is derived from it, never a quoted price: the price,
 * the disclosure and the acknowledgement are all server strings. The saving is
 * safe to compute here because `stripeActivation.quote()` refuses to quote at
 * all unless the Stripe catalogue matches this same published rate card, so by
 * the time a price is on screen the two tables are known to agree.
 */
function posCurrency(currency: string): PosCurrency | null {
  return posCurrencies.includes(currency as PosCurrency) ? (currency as PosCurrency) : null;
}

/** What the columns say under the price. The annual saving, when it is a whole number of months. */
function planNote(plan: ActivationPlanOffer["plan"], currency: PosCurrency | null): string {
  if (plan === "monthly") return "Billed every month. Cancel from your dashboard in one click.";
  const base = "Billed once a year, renewing automatically until you cancel.";
  if (!currency || monthsFreeOnAnnual(currency) === null) return base;
  return `${base} That is ${formatRate(annualSaving(currency), currency)} less than twelve months at the monthly rate.`;
}

function savingBadge(currency: PosCurrency | null): string | null {
  if (!currency) return null;
  const months = monthsFreeOnAnnual(currency);
  if (months === null) return null;
  return `${months === 2 ? "Two" : String(months)} months free`;
}

export function ActivatePanel({ property }: { property: HostProperty }) {
  // Guessed, not asked. Null means the browser looks like neither country we
  // serve, which is the one case worth a question.
  const [country, setCountry] = useState<BillingCountry | null>(detectBillingCountry);
  const [choosingCountry, setChoosingCountry] = useState(country === null);
  const [offer, setOffer] = useState<ActivationOffer | null>(null);
  const [loadingOffer, setLoadingOffer] = useState(false);
  const [plan, setPlan] = useState<"monthly" | "annual" | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Collapsed until asked for, the way Stripe's own field is. §4.1's code is
  // an internal verification code the plan says is "not marketed", and an
  // always-open box on the last screen before payment advertises a discount to
  // every Host paying full price — and sends some of them off to look for one.
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [applyingCode, setApplyingCode] = useState(false);
  const [codeProblem, setCodeProblem] = useState<string | null>(null);

  // A new country is a new quote, and everything chosen against the old one —
  // the plan, the ticked box — is no longer a choice the Host has made.
  useEffect(() => {
    if (!country) return;
    let cancelled = false;
    setLoadingOffer(true);
    setOffer(null);
    setPlan(null);
    setAcknowledged(false);
    setProblem(null);
    // A code is validated against a currency and an amount, so a new country
    // is a code that has not been checked. It is dropped rather than re-sent.
    setAppliedCode(null);
    setCodeInput("");
    setCodeProblem(null);
    void loadActivationOffer(property.id, country).then((outcome) => {
      if (cancelled) return;
      setLoadingOffer(false);
      if (outcome.status === "error") setProblem(outcome.message);
      else setOffer(outcome.value);
    });
    return () => {
      cancelled = true;
    };
  }, [country, property.id]);

  const chosen = offer?.plans.find((option) => option.plan === plan) ?? null;
  const currency = offer ? posCurrency(offer.currency) : null;
  const badge = savingBadge(currency);
  const appliedTo = offer?.plans.find((option) => option.discount !== null)?.discount ?? null;

  /**
   * Re-quote with a code, or without one.
   *
   * Deliberately not the country effect above, which clears the offer before it
   * fetches: a mistyped code would blank the prices a Host was reading and
   * replace them with an error. The current quote stands until a new one
   * arrives, so a refusal is a line under the field and nothing else moves.
   */
  async function applyCode(code: string | null) {
    if (!country || applyingCode) return;
    setApplyingCode(true);
    setCodeProblem(null);
    const outcome = await loadActivationOffer(property.id, country, code);
    setApplyingCode(false);
    if (outcome.status === "error") {
      setCodeProblem(outcome.message);
      return;
    }
    setOffer(outcome.value);
    setAppliedCode(code);
    // Different prices mean a different sentence to agree to.
    setPlan(null);
    setAcknowledged(false);
    setProblem(null);
    if (!code) {
      setCodeOpen(false);
      setCodeInput("");
    }
  }

  async function submit() {
    if (!country || !offer || !chosen || !acknowledged || submitting) return;
    setSubmitting(true);
    setProblem(null);
    const outcome = await startActivationCheckout({
      propertyId: property.id,
      country,
      plan: chosen.plan,
      version: offer.version,
      trialEndsAt: offer.trialEndsAt,
      // The code this plan was actually quoted with, and the figure it
      // produced. The server re-resolves both and refuses a quote that moved.
      promotionCode: chosen.discount ? appliedCode : null,
      chargedAmount: chosen.chargedAmount
    });
    if (outcome.status === "error") {
      setSubmitting(false);
      setProblem(outcome.message);
      return;
    }
    // Leaves the app for Stripe. The return trip grants nothing (BOP §4.2) —
    // this property goes live when the webhook says so.
    redirectToCheckout(outcome.value.url);
  }

  return (
    <div className="activate">
      <p className="lede">
        {property.name} is a private draft. Choose a plan and add a payment method to take it live; nothing is
        served to a guest until you do.
      </p>

      {choosingCountry ? (
        <fieldset className="activate-countries">
          <legend>Where will you be billed?</legend>
          <p className="field-hint">
            This sets your currency. DigiStayBook currently serves Australia and the United States.
          </p>
          {COUNTRIES.map((option) => (
            <label key={option.code} className="check-row">
              <input
                type="radio"
                name="billing-country"
                value={option.code}
                checked={country === option.code}
                onChange={() => setCountry(option.code)}
              />
              {option.name}
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="activate-country field-hint">
          Billed in {COUNTRIES.find((option) => option.code === country)?.name}.{" "}
          <button
            type="button"
            className="text-link link-button"
            onClick={() => setChoosingCountry(true)}
          >
            Not right?
          </button>
        </p>
      )}

      {loadingOffer && <p role="status">Fetching today&rsquo;s prices&hellip;</p>}

      {offer && (
        <>
          <div className="activate-trial">
            {offer.trialAvailable ? (
              <>
                <strong>{offer.trialDays} days free, then whichever plan you pick.</strong>
                <p>Cancel any time before the trial ends and you pay nothing.</p>
              </>
            ) : (
              <>
                <strong>Billed today.</strong>
                <p>Your free trial applies to your first property only.</p>
              </>
            )}
          </div>

          <fieldset className="activate-plans">
            <legend>Choose a plan</legend>
            <p className="field-hint">
              Both plans are the same complete platform. The only difference is how often you are billed.
            </p>
            <div className="plan-cards">
              {offer.plans.map((option) => (
                <label
                  key={option.plan}
                  className={plan === option.plan ? "plan-card selected" : "plan-card"}
                >
                  <span className="plan-card-head">
                    <input
                      type="radio"
                      name="billing-plan"
                      value={option.plan}
                      checked={plan === option.plan}
                      // Named and described explicitly rather than left to the
                      // card's text. A wrapping label names a control by
                      // concatenating everything inside it, which here is the
                      // plan, the price, the period and a two-line note run
                      // together — and the accessible-name algorithm does not
                      // put spaces at the element boundaries this layout is
                      // built from. The name is the choice being made; the
                      // note is a description of it, which is what it is.
                      aria-label={
                        option.discount
                          ? `${PLAN_NAMES[option.plan]}, ${option.chargedPrice} ${PLAN_PERIODS[option.plan]} `
                            + `with code ${option.discount.code}, normally ${option.price}`
                          : `${PLAN_NAMES[option.plan]}, ${option.price} ${PLAN_PERIODS[option.plan]}`
                      }
                      aria-describedby={`plan-note-${option.plan}`}
                      onChange={() => {
                        setPlan(option.plan);
                        // A different price and date means a different sentence
                        // to agree to, so the box cannot stay ticked across the
                        // change.
                        setAcknowledged(false);
                        setProblem(null);
                      }}
                    />
                    <span className="plan-name">{PLAN_NAMES[option.plan]}</span>
                    {option.plan === "annual" && badge && (
                      // Repeated inside the description below, because a badge
                      // beside a heading is a visual adjacency a screen reader
                      // does not get.
                      <span className="rate-badge" aria-hidden="true">{badge}</span>
                    )}
                  </span>
                  <span className="plan-price">
                    {option.discount && (
                      // The published rate is kept in view beside the
                      // discounted one: a price that simply changed is a price
                      // a Host has to take on trust.
                      <s className="plan-price-was">{option.price}</s>
                    )}
                    {option.discount ? option.chargedPrice : option.price}
                    <span> {PLAN_PERIODS[option.plan]}</span>
                  </span>
                  <span className="plan-note" id={`plan-note-${option.plan}`}>
                    {option.plan === "annual" && badge ? `${badge}. ` : ""}
                    {planNote(option.plan, currency)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Below the plans and above the terms, which is where a total is
              adjusted and where Stripe puts the same field. */}
          <div className="activate-code">
            {appliedCode && appliedTo ? (
              <p className="activate-code-applied">
                <span>
                  <strong>Code {appliedTo.code} applied.</strong> {appliedTo.label} the plans it covers.
                </span>
                <button
                  type="button"
                  className="text-link link-button"
                  disabled={applyingCode}
                  onClick={() => void applyCode(null)}
                >
                  Remove
                </button>
              </p>
            ) : codeOpen ? (
              <div className="activate-code-entry">
                <label htmlFor="promotion-code">Promotion code</label>
                <div className="activate-code-row">
                  <input
                    id="promotion-code"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    value={codeInput}
                    onChange={(event) => {
                      setCodeInput(event.target.value);
                      setCodeProblem(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      // The panel is not a form, and Enter in a code box means
                      // "apply this", never "start the trial".
                      event.preventDefault();
                      if (codeInput.trim()) void applyCode(codeInput.trim());
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!codeInput.trim() || applyingCode}
                    onClick={() => void applyCode(codeInput.trim())}
                  >
                    {applyingCode ? "Checking…" : "Apply"}
                  </button>
                </div>
                {codeProblem && (
                  <p className="form-feedback" role="alert">
                    {codeProblem}
                  </p>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="text-link link-button"
                onClick={() => setCodeOpen(true)}
              >
                Have a promotion code?
              </button>
            )}
          </div>

          {chosen ? (
            <div className="activate-terms">
              <h3>Before you continue</h3>
              {/* The server's own sentence for this plan, never one built here. */}
              <p className="activate-disclosure">{chosen.disclosure}</p>
              <label className="check-row activate-ack">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                {chosen.acknowledgement}
              </label>
            </div>
          ) : (
            <p className="field-hint activate-terms-pending">
              Pick a plan above and its exact terms, price and dates appear here to confirm.
            </p>
          )}

          {problem && (
            <p className="form-feedback" role="alert">
              {problem}
            </p>
          )}

          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!chosen || !acknowledged || submitting}
              onClick={() => void submit()}
            >
              {submitting
                ? "Opening checkout…"
                : offer.trialAvailable
                  ? "Start free trial"
                  : "Continue to payment"}
            </button>
            <a className="btn btn-secondary" href={`/host/property/${property.id}`}>
              Back to the property
            </a>
          </div>

          <p className="field-hint">
            Payment is handled by Stripe. Your card details never reach DigiStayBook, and this property goes
            live only once Stripe confirms the payment method &mdash; not when you return to this page.
          </p>
        </>
      )}

      {problem && !offer && (
        <p className="form-feedback" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
