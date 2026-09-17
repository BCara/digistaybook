import { isPubliclyReadable } from "../../domain/property";
import { attentionItems, formatScheduleDate, nextCharge } from "../../domain/billingSchedule";
import { formatPrice } from "../../domain/pricing";
import type { HostProperty } from "./propertyStore";
import "./dashboardOverview.css";

/**
 * What a Host's whole account amounts to, in one line.
 *
 * This was four stat tiles over two panels, and it restated the list below it
 * three times: a "Draft" pill on the card, a "Draft property, continue setup"
 * row in a panel, and the same sentence again in the card's own body. None of
 * the three was where the Host could act, and together they pushed the
 * properties — the thing the page is for — below the fold.
 *
 * So the counts collapse to a rule, and the attention moves onto the cards
 * themselves, where the control that resolves it already lives. What survives
 * here is only what is *not* on a card: how many properties there are, and
 * when money next leaves the account. The second of those is a link, because
 * the full answer is a page (`/host/billing`) rather than a panel — a Host
 * with properties on different schedules and in different currencies needs a
 * schedule, and a schedule does not fit in a dashboard box.
 */
export function DashboardOverview({ properties, now = Date.now() }: { properties: HostProperty[]; now?: number }) {
  const live = properties.filter((property) => isPubliclyReadable(property, now)).length;
  const drafts = properties.filter((property) => property.lifecycle === "draft").length;
  const alerts = attentionItems(properties, now);
  const next = nextCharge(properties, now);

  return (
    <section className="dashboard-strip" aria-label="Account overview">
      <p className="dashboard-counts">
        <span><b>{properties.length}</b> {properties.length === 1 ? "property" : "properties"}</span>
        <span aria-hidden="true" className="dashboard-sep">·</span>
        <span><b>{live}</b> live</span>
        {drafts > 0 && <>
          <span aria-hidden="true" className="dashboard-sep">·</span>
          <span><b>{drafts}</b> {drafts === 1 ? "draft" : "drafts"}</span>
        </>}
        {alerts.length > 0 && <>
          <span aria-hidden="true" className="dashboard-sep">·</span>
          {/* Said once, in the accent, and left unlinked on purpose: every
              item it counts is marked on its own card a few rows down, with
              the control that clears it. A link here would send a Host away
              from the answer. */}
          <span className="dashboard-alert">{alerts.length} need{alerts.length === 1 ? "s" : ""} attention</span>
        </>}
      </p>
      <p className="dashboard-next">
        {next
          ? <>Next payment <b>{formatPrice(next.price!.amount, next.price!.currency)}</b> on {formatScheduleDate(next.date)}. </>
          : <>No renewing subscriptions. </>}
        <a className="text-link" href="/host/billing">All billing &rarr;</a>
      </p>
    </section>
  );
}
