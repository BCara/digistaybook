import { render, screen, within } from "@testing-library/react";
import { DashboardOverview } from "./DashboardOverview";
import { emptyProfile } from "../../domain/propertyProfile";
import type { HostProperty } from "./propertyStore";

const now = Date.parse("2026-09-11T12:00:00Z");
function property(id: string, overrides: Partial<HostProperty> = {}): HostProperty {
  return { id, name: id, slug: id, ownerUid: "host", lifecycle: "active", mode: "live", foundationalPostCount: 0,
    createdAt: null, updatedAt: null, profile: emptyProfile(), billing: {
      renewalAmount: 1500, renewalCurrency: "aud", renewalInterval: "month", trialEndsAt: null,
      currentPeriodEndsAt: "2026-09-20T12:00:00Z", lastPaymentAt: null
    }, ...overrides };
}

const strip = () => within(screen.getByRole("region", { name: "Account overview" }));

it("counts the account in one line, and counts guest access rather than intent", () => {
  render(<DashboardOverview now={now} properties={[
    property("draft", { lifecycle: "draft", mode: "sandbox" }),
    property("second-draft", { lifecycle: "draft", mode: "sandbox" }),
    property("private", { mode: "sandbox" }),
    property("live")
  ]} />);
  expect(strip().getByText(/properties/).closest("p")).toHaveTextContent(/4 properties.*1 live.*2 drafts/);
});

it("names the soonest charge still ahead and sends the rest of the question to its own page", () => {
  render(<DashboardOverview now={now} properties={[
    property("later", { billing: { ...property("x").billing!, currentPeriodEndsAt: "2026-12-01T00:00:00Z" } }),
    property("soonest")
  ]} />);
  expect(strip().getByText(/Next payment/)).toHaveTextContent("Next payment A$15.00 on 20 September 2026.");
  expect(strip().getByRole("link", { name: /All billing/ })).toHaveAttribute("href", "/host/billing");
});

it("says plainly when nothing renews, rather than showing an empty panel", () => {
  render(<DashboardOverview now={now} properties={[property("draft", { lifecycle: "draft", mode: "sandbox" })]} />);
  expect(strip().getByText(/No renewing subscriptions/)).toBeInTheDocument();
});

it("states how many properties need something without repeating what each one needs", () => {
  render(<DashboardOverview now={now} properties={[
    property("failed", { lifecycle: "grace_period" }),
    property("draft", { lifecycle: "draft", mode: "sandbox" }),
    // Private and not a draft: nothing is being asked of it.
    property("settled", { mode: "sandbox" })
  ]} />);
  // The sentences themselves belong on the cards, beside the control that
  // clears them; the strip carries only the count.
  expect(strip().getByText(/need attention/)).toHaveTextContent("2 need attention");
  expect(strip().queryByText(/Review payment/)).not.toBeInTheDocument();
  expect(strip().queryByText(/Continue setup/)).not.toBeInTheDocument();
});

it("puts nothing in the attention slot when every property is settled", () => {
  render(<DashboardOverview now={now} properties={[property("settled", { mode: "sandbox" })]} />);
  expect(strip().queryByText(/attention/)).not.toBeInTheDocument();
});
