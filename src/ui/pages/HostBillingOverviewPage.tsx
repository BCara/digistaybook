import { useCallback, useEffect, useState } from "react";
import { firebaseConfigured } from "../../lib/firebaseConfig";
import { lifecycleLabels } from "../../domain/property";
import {
  attentionItems,
  billingTotals,
  formatScheduleDay,
  intervalLabels,
  paymentSchedule,
  renewalPrice,
  scheduleByMonth,
  type CurrencyTotal,
  type ScheduleEntry
} from "../../domain/billingSchedule";
import { currencyNames, formatPrice } from "../../domain/pricing";
import { useAuth } from "../auth/AuthProvider";
import { rememberProperties } from "../host/propertyCache";
import { listOwnedProperties, type HostProperty } from "../host/propertyStore";
import "../host/billingOverview.css";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; properties: HostProperty[] }
  | { status: "error"; message: string };

/**
 * Everything a Host is committed to paying, across every property.
 *
 * Billing already existed per property, which answers "what does this
 * property cost" and nothing else. A Host with five properties on two
 * currencies and both plans had no way to ask the question they actually
 * have — what leaves my account, and when — except by opening five screens
 * and doing the arithmetic themselves. The dashboard's old billing panel
 * tried to be that page inside a box, and was empty for most accounts and
 * unreadable for the rest.
 *
 * So the page is ordered by date rather than by property: a schedule, not a
 * ledger of subscriptions. The totals sit above it, per currency and never
 * summed together, and the per-property table sits below it as the lookup it
 * is. See `domain/billingSchedule` for why the maths refuses to combine
 * currencies or to state a price it cannot verify.
 */
export function HostBillingOverviewPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [load, setLoad] = useState<LoadState>({ status: "loading" });

  const refresh = useCallback(async (ownerUid: string) => {
    const outcome = await listOwnedProperties(ownerUid);
    if (outcome.status === "ok") rememberProperties(outcome.value);
    setLoad(outcome.status === "ok"
      ? { status: "ready", properties: outcome.value }
      : { status: "error", message: outcome.message });
  }, []);

  useEffect(() => {
    if (!firebaseConfigured || !uid) return;
    void refresh(uid);
  }, [uid, refresh]);

  if (!firebaseConfigured) {
    return (
      <div className="page narrow-page">
        <p className="eyebrow">Protected host area</p>
        <h1>Billing unavailable</h1>
        <div className="notice">
          <strong>No Firebase environment is configured.</strong>
          <p>The implementation deliberately fails closed instead of providing a local authentication bypass.</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/host">Back to your dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <p className="eyebrow">Host control centre</p>
      <h1>Billing</h1>
      <p className="lede">Every renewal across your properties, in the order it happens.</p>

      {load.status === "loading" && <p className="lede" role="status">Loading your billing…</p>}

      {load.status === "error" && (
        <div className="notice" role="alert">
          <strong>We could not load your billing.</strong>
          <p>{load.message}</p>
        </div>
      )}

      {load.status === "ready" && <BillingBody properties={load.properties} />}
    </div>
  );
}

function BillingBody({ properties, now = Date.now() }: { properties: HostProperty[]; now?: number }) {
  const { totals, unpriced, includesTrials } = billingTotals(properties);
  const schedule = paymentSchedule(properties, now);
  // Only what is actually wrong. A trial ending and a cancellation running to
  // its end are dated facts, and the schedule below states them with their
  // dates; raising a banner for each was three alarms for one problem.
  const problems = attentionItems(properties, now).filter((item) => item.urgent);

  if (properties.length === 0) {
    return (
      <div className="empty-state">
        <p><b>No properties yet.</b></p>
        <p>Nothing is billed until you add a property and start its trial.</p>
        <div className="actions">
          <a className="btn btn-primary" href="/host#add-property">Add your first property</a>
        </div>
      </div>
    );
  }

  return (
    <>
      {problems.map((problem) => (
        <div key={problem.property.id} className="billing-banner" role="alert">
          <div>
            <strong>{problem.property.name}</strong> — {problem.text}
          </div>
          <a className="text-link" href={problem.href}>{problem.action}</a>
        </div>
      ))}

      {totals.length > 0 && (
        <section className="billing-totals" aria-label="Recurring commitments">
          <div className="billing-total-cards">
            {totals.map((total) => <TotalCard key={total.currency} total={total} />)}
          </div>
          <p className="billing-footnote">
            Currencies are never added together. Yearly plans are shown divided by twelve.
            {includesTrials && " Trials are counted at the rate that applies once they end."}
            {unpriced.length > 0 && ` ${unpriced.length} ${unpriced.length === 1 ? "property has" : "properties have"} `
              + `no price we can show ${unpriced.length === 1 ? "and is" : "and are"} left out of these figures.`}
          </p>
        </section>
      )}

      <section className="host-section" aria-labelledby="billing-schedule">
        <h2 id="billing-schedule">Coming up</h2>
        {schedule.length === 0
          ? <p className="lede">Nothing is scheduled. No property has a running subscription.</p>
          : scheduleByMonth(schedule).map((group) => (
              <div key={group.month ?? "undated"}>
                <p className="billing-month">{group.month ?? "Date not set"}</p>
                <ul className="billing-schedule">
                  {group.entries.map((entry) => <ScheduleRow key={entry.property.id} entry={entry} />)}
                </ul>
              </div>
            ))}
      </section>

      <section className="host-section" aria-labelledby="billing-by-property">
        <h2 id="billing-by-property">By property</h2>
        <ul className="billing-properties">
          {properties.map((property) => {
            const price = renewalPrice(property);
            const billed = property.lifecycle !== "draft";
            return (
              <li key={property.id} className={billed ? undefined : "billing-row-quiet"}>
                <span className="billing-property-name">{property.name}</span>
                <span className={`state-pill lifecycle-${property.lifecycle}`}>{lifecycleLabels[property.lifecycle]}</span>
                <span className="billing-property-rate">
                  {!billed ? "Not billed"
                    : price ? `${formatPrice(price.amount, price.currency)} / ${intervalLabels[price.interval]}`
                    : "Price unavailable"}
                </span>
                <a className="text-link" href={billed ? `/host/property/${property.id}/billing` : `/host/property/${property.id}`}>
                  {billed ? "Manage" : "Set up"}
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function TotalCard({ total }: { total: CurrencyTotal }) {
  return (
    <div className="billing-total">
      <p className="billing-total-label">{currencyNames[total.currency]}</p>
      <p className="billing-total-amount">
        {formatPrice(total.monthlyEquivalent, total.currency)}<span> / month</span>
      </p>
      <p className="billing-total-note">
        {total.properties} {total.properties === 1 ? "property" : "properties"}
        {/* The working, shown rather than assumed: a Host holding an annual
            plan should never have to wonder how a yearly figure became part
            of a monthly one. */}
        {total.includesAnnual && ` · includes ${formatPrice(total.perYear, total.currency)}/yr `
          + `as ${formatPrice(Math.round(total.perYear / 12), total.currency)}/mo`}
      </p>
    </div>
  );
}

function ScheduleRow({ entry }: { entry: ScheduleEntry<HostProperty> }) {
  return (
    <li className={entry.kind === "ends" ? "billing-row-quiet" : undefined}>
      <span className="billing-day">{formatScheduleDay(entry.date)}</span>
      <span className="billing-event">
        <b>{entry.property.name}</b>
        <span className={entry.kind === "retry" || entry.overdue ? "billing-event-alert" : undefined}>
          {entry.label}
          {entry.date === null && " — we do not have a date for this yet"}
        </span>
      </span>
      <span className="billing-amount">
        {entry.price
          ? <><b>{formatPrice(entry.price.amount, entry.price.currency)}</b><span>{intervalLabels[entry.price.interval]}</span></>
          : entry.kind === "ends" ? <span>no charge</span> : <span>amount unavailable</span>}
      </span>
      <a
        className="text-link"
        href={`/host/property/${entry.property.id}/billing`}
        aria-label={`Billing for ${entry.property.name}`}
      >
        Billing
      </a>
    </li>
  );
}

/** Exported for the tests: the page's body without the Firestore read in front of it. */
export { BillingBody as BillingOverviewBody };
