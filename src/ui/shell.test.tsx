import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { AppShell } from "./AppShell";
import { AuthContext, type AuthState } from "./auth/AuthProvider";
import { LandingPage } from "./pages/LandingPage";
import { useLocation } from "./routing";

const signOutHost = vi.fn(() => Promise.resolve());
vi.mock("./auth/hostAuth", () => ({ signOutHost: () => signOutHost() }));

function renderShell(state: AuthState, children: ReactNode = "page") {
  return render(
    <AuthContext.Provider value={state}>
      <AppShell>{children}</AppShell>
    </AuthContext.Provider>
  );
}

const hostSession = {
  status: "host",
  user: { email: "host@example.com", displayName: "" }
} as unknown as AuthState;

describe("shell and landing presentation", () => {
  it.each(["How it works", "Pricing"])("closes the menu after selecting %s", name => {
    renderShell({ status: "signed-out", user: null });
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("link", { name }));
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on a page click without swallowing the clicked action", () => {
    const action = vi.fn();
    renderShell({ status: "signed-out", user: null }, <button onClick={action}>Page action</button>);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Page action" }));
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes host menu actions and supports Escape and the Close toggle", () => {
    renderShell(hostSession);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });
  it("exposes primary navigation through an accessible mobile disclosure", () => {
    render(<AppShell>page</AppShell>);
    const toggle = screen.getByRole("button", { name: "Menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "primary-navigation");

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute("aria-expanded", "true");

    const primary = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(primary).getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
  });

  it("swaps the header for a signed-in host", async () => {
    renderShell(hostSession);

    const header = within(screen.getByRole("banner"));
    const primary = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(primary).getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/host");
    expect(within(primary).getByRole("link", { name: "Account" })).toHaveAttribute("href", "/host/account");
    expect(within(primary).queryByRole("link", { name: "Pricing" })).not.toBeInTheDocument();
    expect(within(primary).queryByRole("link", { name: "Privacy & Safety" })).not.toBeInTheDocument();
    expect(header.getByRole("link", { name: "Add property" })).toHaveAttribute("href", "/host#add-property");
    expect(header.queryByRole("link", { name: "Host sign in" })).not.toBeInTheDocument();
    expect(header.getByText("host@example.com")).toBeInTheDocument();

    fireEvent.click(header.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(signOutHost).toHaveBeenCalled());
  });

  it("keeps the visitor header for an anonymous guest wall session", () => {
    renderShell({ status: "guest", user: null } as unknown as AuthState);
    const header = within(screen.getByRole("banner"));
    expect(header.getByRole("link", { name: "Host sign in" })).toBeInTheDocument();
    expect(header.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("holds back the sign-in call to action while the session is resolving", () => {
    renderShell({ status: "loading", user: null } as unknown as AuthState);
    const header = within(screen.getByRole("banner"));
    expect(header.queryByRole("link", { name: "Host sign in" })).not.toBeInTheDocument();
    expect(header.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("redirects an existing host session and updates the mounted router without adding history", () => {
    window.history.replaceState(null, "", "/");
    const historyLength = window.history.length;
    function HomeRoute() {
      const location = useLocation();
      return location.pathname === "/host" ? <h1>Dashboard destination</h1> : <LandingPage />;
    }
    renderShell(hostSession, <HomeRoute />);
    expect(screen.getByRole("heading", { name: "Dashboard destination" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/host");
    expect(window.history.length).toBe(historyLength);
    expect(screen.queryByText(/your rental never had/i)).not.toBeInTheDocument();
  });

  it("waits for session restoration before redirecting to the dashboard", () => {
    window.history.replaceState(null, "", "/");
    const { rerender } = render(<AuthContext.Provider value={{ status: "loading", user: null }}><LandingPage /></AuthContext.Provider>);
    expect(screen.getByRole("status")).toHaveTextContent("Checking your session");
    expect(screen.queryByText(/your rental never had/i)).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    rerender(<AuthContext.Provider value={hostSession}><LandingPage /></AuthContext.Provider>);
    expect(window.location.pathname).toBe("/host");
  });

  it.each(["signed-out", "guest", "unconfigured"] as const)("keeps the home page for %s sessions", status => {
    window.history.replaceState(null, "", "/");
    renderShell({ status, user: null }, <LandingPage />);
    expect(screen.getByRole("heading", { name: /your rental never had/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("keeps the landing page inside the approved marketing wording", () => {
    renderShell({ status: "signed-out", user: null }, <LandingPage />);
    expect(
      screen.getAllByText(/may encourage guests to share more positive feedback on their official booking platform/i)
    ).not.toHaveLength(0);
    expect(screen.getByText(/never asks guests for a rating/i)).toBeInTheDocument();
    expect(screen.getByText(/Create your account and add your first property to activate your 28-day free trial\./i)).toBeInTheDocument();
  });

  // BOP §6.3.3 wants "a concise pricing prompt" here and §6.3.4 wants the terms
  // on a page of their own. The tax callout, the cancellation link and the
  // unified checklist moved to /pricing, and this holds them there: two pages
  // both reciting the billing terms is how the two versions start to differ.
  it("sends the reader to /pricing for the terms rather than reciting them", () => {
    renderShell({ status: "signed-out", user: null }, <LandingPage />);
    expect(
      screen.getByRole("link", { name: /See everything included, and the billing terms/i })
    ).toHaveAttribute("href", "/pricing");
    expect(screen.queryByText(/may be deductible as a business expense/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Cancellation & Billing Policy/i })).not.toBeInTheDocument();
  });
});
