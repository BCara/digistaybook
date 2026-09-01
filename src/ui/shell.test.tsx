import { fireEvent, render, screen, within } from "@testing-library/react";
import { AppShell } from "./AppShell";
import { LandingPage } from "./pages/LandingPage";

describe("shell and landing presentation", () => {
  it("exposes primary navigation through an accessible mobile disclosure", () => {
    render(<AppShell>page</AppShell>);
    const toggle = screen.getByRole("button", { name: "Menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "primary-navigation");

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("aria-expanded", "true");

    const primary = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(primary).getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/#pricing");
  });

  it("keeps the landing page inside the approved marketing wording", () => {
    render(<LandingPage />);
    expect(
      screen.getAllByText(/may encourage guests to share more positive feedback on their official booking platform/i)
    ).not.toHaveLength(0);
    expect(screen.getByText(/never asks guests for a rating/i)).toBeInTheDocument();
    expect(screen.getByText(/Create your account and add your first property to activate your 28-day free trial\./i)).toBeInTheDocument();
    expect(
      screen.getByText(
        "DigiStayBook may be deductible as a business expense. Eligibility depends on your circumstances and business use; seek tax advice."
      )
    ).toBeInTheDocument();
  });
});
