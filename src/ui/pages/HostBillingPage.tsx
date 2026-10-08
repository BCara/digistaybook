import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { formatPrice, posCurrencies, type PosCurrency } from "../../domain/pricing";
import {
  isPubliclyReadable,
  lifecycleSummaries
} from "../../domain/property";
import { useAuth } from "../auth/AuthProvider";
import { ActivatePanel } from "../host/ActivatePanel";
import {
  cancelSubscription,
  resumeSubscription,
  type SubscriptionChange
} from "../host/billingStore";
import { PropertyShell } from "../host/PropertyShell";
import { formatDate } from "../host/PropertyState";
import { loadProperty, type BillingSnapshot, type HostProperty } from "../host/propertyStore";
import { useProperty, type PropertyLoad } from "../host/useProperty";
import { propertyBlock } from "../host/usePropertyDraft";

/**
 * What this property costs, and what its subscription is currently buying.
 *
 * Billing was three dates folded into the setup list, which put the one thing
 * that decides whether a wall is served to anyone at all — the lifecycle — in
 * the same column as the wording of a welcome note. It is its own screen
 * because it answers its own question, and because the answer has consequences
 * a Host has to be able to find: a suspended property is a placard on a
 * kitchen table that now leads nowhere.
 *
 * A draft property is the exception: this is where it is taken live, so the
 * screen carries the activation flow (`ActivatePanel`). Everything after that
 * is read-only, and not as a placeholder — lifecycle is written by the server
 * from payment events and Firestore rules refuse a client write to it.
 */

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page narrow-page">
      <p className="eyebrow">Host control centre</p>
      <h1>{title}</h1>
      {children}
    </div>
  );
}

/**
 * The state the Host lands in when Stripe redirects back. The subscription is
 * paid for but the property is still `draft` until the webhook is processed
 * (BOP §4.2), so this watches the document rather than trusting the return.
 */
function ActivationPending({
  propertyId,
  publish
}: {
  propertyId: string;
  publish: Dispatch<SetStateAction<PropertyLoad>>;
}) {
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      const outcome = await loadProperty(propertyId);
      if (stopped || outcome.status !== "ok" || !outcome.value) return;
      if (outcome.value.lifecycle !== "draft") publish({ status: "ready", property: outcome.value });
    };
    void check();
    const timer = setInterval(() => void check(), 4000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [propertyId, publish]);

  return (
    <div className="notice" role="status">
      <strong>Finishing activation…</strong>
      <p>
        Stripe has your payment method. This property goes live the moment we receive Stripe&rsquo;s
        confirmation, usually within a few seconds. You can leave this page — it will be live when you come
        back.
      </p>
    </div>
  );
}

/** A date a Host can read, or nothing at all — never the words "Not set". */
function readable(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const formatted = formatDate(iso);
  return formatted === "Not set" ? null : formatted;
}

/**
 * The next charge as a figure, when the catalogue can name one in the currency
 * this subscription is actually billed in. The webhook writes null rather than
 * guess, and a missing figure costs the sentence its amount, not its date.
 */
function nextCharge(billing: BillingSnapshot | null): string | null {
  const amount = billing?.renewalAmount;
  const named = billing?.renewalCurrency;
  if (typeof amount !== "number" || !named) return null;
  const currency = named.toLowerCase();
  if (!(posCurrencies as readonly string[]).includes(currency)) return null;
  return formatPrice(amount, currency as PosCurrency);
}

/** When the subscription next does something: bills, or stops. */
function nextDate(property: HostProperty): string | null {
  return readable(
    property.lifecycle === "trialing"
      ? property.billing?.trialEndsAt ?? property.billing?.currentPeriodEndsAt
      : property.serviceEndsAt ?? property.billing?.currentPeriodEndsAt
  );
}

/**
 * The one thing a Host opens this page to find out: what is about to happen to
 * their card, and when.
 *
 * This was three date rows — "Trial ends", "Current period ends", "Last
 * payment" — leaving the Host to work out which of them was a bill. During a
 * trial the first two are the same date, because the trial *is* the current
 * period, and the third was reporting a payment that had never been taken. The
 * page listed three dates and stated the only one that costs money nowhere.
 */
function NextEvent({ property }: { property: HostProperty }) {
  const price = nextCharge(property.billing);
  const due = nextDate(property);
  const ends = readable(property.serviceEndsAt ?? property.billing?.currentPeriodEndsAt);

  switch (property.lifecycle) {
    case "trialing":
      return (
        <p className="next-event">
          <strong>
            {price && due
              ? `Your card will be charged ${price} on ${due}.`
              : due
                ? `Your first payment is due on ${due}.`
                : "Your first payment is due when the trial ends."}
          </strong>{" "}
          Cancel before then and you will not be charged anything.
        </p>
      );
    case "active":
      return (
        <p className="next-event">
          <strong>
            {price && due
              ? `Renews at ${price} on ${due}.`
              : due
                ? `Renews on ${due}.`
                : "Renews at the end of the current period."}
          </strong>{" "}
          Cancel before then and the wall stays live until that date.
        </p>
      );
    case "grace_period":
      return (
        <p className="next-event">
          <strong>A payment did not go through.</strong> We keep retrying it, and the wall stays live while we
          do. Updating the card is the fix — contact support and we will send you a secure link.
        </p>
      );
    case "cancelled_pending_end":
      return (
        <p className="next-event">
          <strong>Nothing further to pay.</strong>{" "}
          {ends
            ? `This property stays live until ${ends}. After that its wall stops being served, and everything on it is kept.`
            : "This property stays live until the end of the period you have paid for, and everything on it is kept."}
        </p>
      );
    case "suspended":
      return (
        <p className="next-event">
          <strong>No payment is scheduled.</strong> The wall is offline until a payment succeeds. Everything on
          it is kept.
        </p>
      );
    default:
      return null;
  }
}

const CANCELLABLE = ["trialing", "active", "grace_period"];

/**
 * Cancelling, and undoing it (ST-09).
 *
 * The confirmation names the date service actually stops, because BOP §4.3
 * makes that date the substance of the notice rather than decoration on it. The
 * lifecycle is not written here: like activation, the change is Stripe's to
 * report through the webhook, so a successful call re-reads the property rather
 * than assuming what the band overhead should now say.
 */
function SubscriptionControls({
  property,
  publish
}: {
  property: HostProperty;
  publish: Dispatch<SetStateAction<PropertyLoad>>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The action is kept with its answer because the lifecycle is not a record of
  // it: once the webhook lands, a cancelled property reads as resumable, and a
  // notice worked out from that would announce the opposite of what was done.
  const [done, setDone] = useState<
    { action: "cancel" | "resume"; from: string; change: SubscriptionChange } | null
  >(null);

  const cancellable = CANCELLABLE.includes(property.lifecycle);
  const resumable = property.lifecycle === "cancelled_pending_end";
  const lifecycle = property.lifecycle;

  // The webhook lands a second or two after Stripe answers, so the band
  // overhead is briefly still showing the old lifecycle. The same watch as the
  // one that follows activation, for the same reason — and it stops once the
  // change has arrived.
  useEffect(() => {
    if (!done || lifecycle !== done.from) return;
    let stopped = false;
    const check = async () => {
      const outcome = await loadProperty(property.id);
      if (stopped || outcome.status !== "ok" || !outcome.value) return;
      if (outcome.value.lifecycle !== done.from) publish({ status: "ready", property: outcome.value });
    };
    const timer = setInterval(() => void check(), 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [done, property.id, lifecycle, publish]);

  if (!cancellable && !resumable) return null;

  const run = async (action: "cancel" | "resume") => {
    setBusy(true);
    setError(null);
    const outcome = await (action === "cancel"
      ? cancelSubscription(property.id)
      : resumeSubscription(property.id));
    setBusy(false);
    if (outcome.status === "error") {
      setError(outcome.message);
      return;
    }
    setConfirming(false);
    setDone({ action, from: lifecycle, change: outcome.value });
  };

  if (done) {
    const resumed = done.action === "resume";
    const date = done.change.serviceEndsOn;
    return (
      <div className="notice" role="status">
        <strong>
          {resumed
            ? date
              ? `Your subscription is back on. It renews on ${date}.`
              : "Your subscription is back on."
            : date
              ? `Cancelled. This property stays live until ${date}.`
              : "Cancelled. This property stays live until the end of the period you have paid for."}
        </strong>
        <p>
          {resumed
            ? "Nothing was charged for making this change."
            : "You will not be charged again. Everything on the wall is kept, and you can undo this any time before that date."}
        </p>
      </div>
    );
  }

  return (
    <div className="subscription-controls">
      {error && (
        <div className="notice" role="alert">
          <strong>That did not go through.</strong>
          <p>{error}</p>
        </div>
      )}

      {resumable ? (
        <>
          <h3>Changed your mind?</h3>
          <p>
            This property is still live. Turning the subscription back on keeps the same wall address and the
            same placards — there is no new sign-up, and no second trial.
          </p>
          <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void run("resume")}>
            {busy ? "Working…" : "Keep this subscription"}
          </button>
        </>
      ) : confirming ? (
        <>
          <h3>Cancel this subscription?</h3>
          <p>
            {nextDate(property)
              ? `This property stays live until ${nextDate(property)}, and then its wall stops being served.`
              : "This property stays live until the end of the period you have paid for, and then its wall stops being served."}{" "}
            {lifecycle === "trialing"
              ? "You will not be charged."
              : "You will not be charged again, and the period you have already paid for is not refunded."}
          </p>
          <p>
            Your memories, photos and settings are kept. Placards printed for this property stop working when
            the wall does.
          </p>
          {/* Keeping it is the primary button. The Host has already said what
              they want by opening this panel, so the weight here belongs to
              the reversible choice rather than to the one being confirmed. */}
          <div className="actions">
            <button className="btn btn-primary" type="button" disabled={busy} onClick={() => setConfirming(false)}>
              Keep it
            </button>
            <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void run("cancel")}>
              {busy ? "Cancelling…" : "Yes, cancel"}
            </button>
          </div>
        </>
      ) : (
        <>
          <h3>Manage subscription</h3>
          <p>
            {lifecycle === "trialing"
              ? "Cancel before your trial ends to avoid a charge. Your photos and settings are kept."
              : "Cancel any time. Your property stays available until the end of your paid period."}
          </p>
          <button className="btn btn-secondary" type="button" onClick={() => setConfirming(true)}>
            {lifecycle === "trialing" ? "Cancel the free trial" : "Cancel this subscription"}
          </button>
        </>
      )}
    </div>
  );
}

function returningFromCheckout(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("activating") === "1";
}

export function HostBillingPage({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const [load, setLoad] = useProperty(propertyId);
  const block = propertyBlock(load, user?.uid);

  if (block) {
    return (
      <Shell title={block.title}>
        {block.kind === "loading" ? (
          <p className="lede" role="status">{block.message}</p>
        ) : (
          <>
            <div className="notice" role={block.alert ? "alert" : undefined}>
              <strong>{block.strong}</strong>
              <p>{block.message}</p>
            </div>
            <div className="actions">
              <a className="btn btn-secondary" href={block.backHref}>{block.backLabel}</a>
            </div>
          </>
        )}
      </Shell>
    );
  }

  // propertyBlock returns null only once the read has landed on a property
  // this account owns.
  const property = (load as { status: "ready"; property: HostProperty }).property;

  // A draft property has never been activated: this screen is where that
  // happens. Once Stripe has been through, the property is briefly still a
  // draft while the webhook catches up.
  if (property.lifecycle === "draft") {
    return (
      <PropertyShell property={property} current="billing" className="billing-page narrow-main">
        <h2>Activate this property</h2>
        {returningFromCheckout() ? (
          <ActivationPending propertyId={property.id} publish={setLoad} />
        ) : (
          <ActivatePanel key={property.id} property={property} />
        )}
      </PropertyShell>
    );
  }

  const live = isPubliclyReadable(property);
  const justActivated = returningFromCheckout() && live;
  const lastPayment = readable(property.billing?.lastPaymentAt);

  return (
    // The band overhead already carries the lifecycle and the mode, so this
    // page opens on what they mean rather than restating them.
    <PropertyShell property={property} current="billing" className="billing-page narrow-main">
      <h2>Billing</h2>

      {justActivated && <p className="billing-confirmation" role="status">Subscription set up successfully.</p>}

      <section className="billing-summary" aria-label="Subscription summary">
        <p className="billing-status">{lifecycleSummaries[property.lifecycle]}</p>
        <NextEvent property={property} />
        {lastPayment && (
          <dl className="property-facts">
            <div>
              <dt>Last payment</dt>
              <dd>{lastPayment}</dd>
            </div>
          </dl>
        )}
      </section>

      <SubscriptionControls property={property} publish={setLoad} />

      <p className="billing-help">
        Need to update your card? Contact support for a secure link.
        {" "}<a className="text-link" href="/pricing">View pricing</a>.
      </p>

      <div className="actions">
        <a className="btn btn-secondary" href={`/host/property/${property.id}`}>Back to the property</a>
      </div>
    </PropertyShell>
  );
}
