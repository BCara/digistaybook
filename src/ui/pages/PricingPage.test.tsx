import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { PricingPage } from "./PricingPage";
import { AuthContext, type AuthState } from "../auth/AuthProvider";
import { includedFeatures, publishedRate } from "../../domain/pricing";

const detectBillingCountry = vi.fn<() => "AU" | "US" | null>(() => "US");
vi.mock("../host/billingCountry", () => ({ detectBillingCountry: () => detectBillingCountry() }));

function renderPage(state?: AuthState, children: ReactNode = <PricingPage />) {
  if (!state) return render(children);
  return render(<AuthContext.Provider value={state}>{children}</AuthContext.Provider>);
}

const hostSession = {
  status: "host",
  user: { email: "host@example.com", displayName: "" }
} as unknown as AuthState;

beforeEach(() => detectBillingCountry.mockReturnValue("US"));

describe("the pricing page", () => {
  it("quotes the published rate card rather than a figure of its own", () => {
    renderPage();
    // The amounts are not written here either: the test reads the same rate
    // card the page does, so this asserts the wiring and `pricing.test.ts`
    // asserts the numbers against the server.
    expect(screen.getByText("US$10")).toBeInTheDocument();
    expect(screen.getByText("US$100")).toBeInTheDocument();
    expect(publishedRate("monthly", "usd")).toBe(1000);
  });

  it("names which dollar, and lets a reader change it", () => {
    renderPage();
    expect(screen.getByText("US$10")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "AUD" }));
    expect(screen.getByText("A$15")).toBeInTheDocument();
    expect(screen.getByText("A$150")).toBeInTheDocument();
    expect(screen.queryByText("US$10")).not.toBeInTheDocument();
  });

  it("opens in the currency the browser's own region implies", () => {
    detectBillingCountry.mockReturnValue("AU");
    renderPage();
    expect(screen.getByRole("radio", { name: "AUD" })).toBeChecked();
    expect(screen.getByText("A$15")).toBeInTheDocument();
  });

  it("falls back to USD for a reader outside the countries we serve", () => {
    detectBillingCountry.mockReturnValue(null);
    renderPage();
    expect(screen.getByRole("radio", { name: "USD" })).toBeChecked();
  });

  // The badge used to be hand-typed beside two hand-typed prices. It is now
  // derived from them, so a rate change cannot leave the claim behind.
  it("derives the annual saving from the two rates", () => {
    renderPage();
    expect(screen.getByText("Two months free")).toBeInTheDocument();
    expect(screen.getByText(/That is US\$20 less than twelve months at the monthly rate\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "AUD" }));
    expect(screen.getByText(/That is A\$30 less than twelve months at the monthly rate\./)).toBeInTheDocument();
  });

  // BOP §6.3.4: the trial callout, the tax callout, the per-property note, the
  // single unified checklist and the cancellation link all belong on this page.
  it("carries the terms the plan fixes word for word", () => {
    renderPage();
    expect(
      screen.getByText("Create your account and add your first property to activate your 28-day free trial.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "DigiStayBook may be deductible as a business expense. Eligibility depends on your circumstances and business use; seek tax advice."
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Billing is per property\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cancellation & Billing Policy/ })).toHaveAttribute("href", "/terms");
  });

  it("lists one checklist, because both plans are the same platform", () => {
    renderPage();
    const list = within(screen.getByRole("heading", { name: "Included in both plans" }).parentElement!);
    for (const feature of includedFeatures) expect(list.getByText(feature)).toBeInTheDocument();
  });

  it("sends a visitor to sign-up", () => {
    renderPage();
    for (const link of screen.getAllByRole("link", { name: "Create free account" })) {
      expect(link).toHaveAttribute("href", "/host/sign-up");
    }
    expect(screen.getByRole("link", { name: "Host sign in" })).toBeInTheDocument();
  });

  // §6.3.4's conditional action: a Host who already holds an account is not
  // sold one, and is not routed through sign-up to add their next property.
  it("sends a signed-in host straight to the work", () => {
    renderPage(hostSession);
    for (const link of screen.getAllByRole("link", { name: "Add a property" })) {
      expect(link).toHaveAttribute("href", "/host#add-property");
    }
    expect(screen.queryByRole("link", { name: "Create free account" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to your dashboard" })).toHaveAttribute("href", "/host");
  });
});
