import { render, screen, within } from "@testing-library/react";
import { BillingOverviewBody } from "./HostBillingOverviewPage";
import { emptyProfile } from "../../domain/propertyProfile";
import type { HostProperty } from "../host/propertyStore";

const now = Date.parse("2026-09-11T12:00:00Z");

function property(id: string, overrides: Partial<HostProperty> = {}): HostProperty {
  return { id, name: id, slug: id, ownerUid: "host", lifecycle: "active", mode: "live", foundationalPostCount: 0,
    createdAt: null, updatedAt: null, profile: emptyProfile(), billing: {
      renewalAmount: 1500, renewalCurrency: "aud", renewalInterval: "month", trialEndsAt: null,
      currentPeriodEndsAt: "2026-10-01T00:00:00Z", lastPaymentAt: null
    }, ...overrides };
}

const billingOf = (overrides: Partial<NonNullable<HostProperty["billing"]>>) =>
  ({ ...property("base").billing!, ...overrides });

const schedule = () => within(screen.getByRole("region", { name: "Coming up" }));
const byProperty = () => within(screen.getByRole("region", { name: "By property" }));

it("totals each currency on its own and shows how a yearly plan became a monthly figure", () => {
  render(<BillingOverviewBody now={now} properties={[
    property("monthly"),
    property("annual", { billing: billingOf({ renewalAmount: 15000, renewalInterval: "year" }) }),
    property("american", { billing: billingOf({ renewalAmount: 1000, renewalCurrency: "USD" }) })
  ]} />);
  const totals = within(screen.getByRole("region", { name: "Recurring commitments" }));
  expect(totals.getByText("Australian dollars").parentElement).toHaveTextContent("A$27.50 / month");
  expect(totals.getByText("US dollars").parentElement).toHaveTextContent("US$10.00 / month");
  expect(totals.getByText(/includes A\$150\.00\/yr as A\$12\.50\/mo/)).toBeInTheDocument();
  expect(totals.getByText(/Currencies are never added together/)).toBeInTheDocument();
});

it("says what it has left out rather than quietly dropping it", () => {
  render(<BillingOverviewBody now={now} properties={[
    property("priced"),
    property("trial", { lifecycle: "trialing", billing: billingOf({ trialEndsAt: "2026-09-21T00:00:00Z" }) }),
    property("mystery", { billing: billingOf({ renewalAmount: null }) })
  ]} />);
  expect(screen.getByText(/Trials are counted at the rate that applies once they end/)).toBeInTheDocument();
  expect(screen.getByText(/1 property has no price we can show and is left out/)).toBeInTheDocument();
});

it("orders the schedule by date under the month it falls in", () => {
  render(<BillingOverviewBody now={now} properties={[
    property("next-year", { billing: billingOf({ renewalAmount: 15000, renewalInterval: "year", currentPeriodEndsAt: "2027-03-14T00:00:00Z" }) }),
    property("october"),
    property("trial", { lifecycle: "trialing", billing: billingOf({ trialEndsAt: "2026-09-21T00:00:00Z" }) })
  ]} />);
  expect(schedule().getAllByRole("listitem").map((row) => row.textContent)).toEqual([
    expect.stringContaining("trial"),
    expect.stringContaining("october"),
    expect.stringContaining("next-year")
  ]);
  expect(schedule().getByText("September 2026")).toBeInTheDocument();
  expect(schedule().getByText("March 2027")).toBeInTheDocument();
  expect(schedule().getByText(/^21 Sept?$/)).toBeInTheDocument();
});

it("lifts a failed payment out of the list and states the deadline with it", () => {
  render(<BillingOverviewBody now={now} properties={[
    property("failed", { lifecycle: "grace_period", billing: billingOf({ currentPeriodEndsAt: "2026-09-16T00:00:00Z" }) })
  ]} />);
  const banner = within(screen.getByRole("alert"));
  expect(banner.getByText("failed")).toBeInTheDocument();
  expect(banner.getByText(/Payment failed/)).toBeInTheDocument();
  expect(banner.getByRole("link", { name: "Review payment" }))
    .toHaveAttribute("href", "/host/property/failed/billing");
  // Still on the schedule too: the retry is a date money moves on.
  expect(schedule().getByText("Retry after a failed payment")).toBeInTheDocument();
});

it("keeps a setup reminder off a page about money", () => {
  render(<BillingOverviewBody now={now} properties={[property("draft", { lifecycle: "draft", mode: "sandbox" })]} />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByText(/Continue setup/)).not.toBeInTheDocument();
});

it("raises a banner only for what is actually wrong, not for every dated fact", () => {
  render(<BillingOverviewBody now={now} properties={[
    property("failed", { lifecycle: "grace_period" }),
    property("ending-trial", { lifecycle: "trialing", billing: billingOf({ trialEndsAt: "2026-09-14T00:00:00Z" }) }),
    property("cancelled", { lifecycle: "cancelled_pending_end", serviceEndsAt: "2026-11-30T00:00:00Z" })
  ]} />);
  // The trial and the cancellation are on the schedule with their dates; a
  // banner each would be three alarms for one problem.
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(screen.getByRole("alert")).toHaveTextContent("failed");
});

it("shows a wall going dark as a date with no charge against it", () => {
  render(<BillingOverviewBody now={now} properties={[
    property("ending", { lifecycle: "cancelled_pending_end", serviceEndsAt: "2026-11-30T00:00:00Z" })
  ]} />);
  const row = schedule().getByRole("listitem");
  expect(row).toHaveTextContent("Cancelled — wall goes offline, no charge");
  expect(row).toHaveTextContent("no charge");
  expect(row).not.toHaveTextContent("A$");
});

it("lists every property, including the ones nothing is owed on", () => {
  render(<BillingOverviewBody now={now} properties={[
    property("paying"),
    property("draft", { lifecycle: "draft", mode: "sandbox" }),
    property("mystery", { billing: null })
  ]} />);
  const rows = byProperty().getAllByRole("listitem");
  expect(rows).toHaveLength(3);
  expect(rows[0]).toHaveTextContent("A$15.00 / monthly");
  expect(rows[1]).toHaveTextContent("Not billed");
  expect(rows[2]).toHaveTextContent("Price unavailable");
  expect(byProperty().getByRole("link", { name: "Set up" })).toHaveAttribute("href", "/host/property/draft");
});

it("offers the way in rather than an empty schedule when there are no properties", () => {
  render(<BillingOverviewBody now={now} properties={[]} />);
  expect(screen.getByText(/Nothing is billed until you add a property/)).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Coming up" })).not.toBeInTheDocument();
});
