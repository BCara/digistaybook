import { render, screen } from "@testing-library/react";
import { AuthContext, type AuthState } from "./AuthProvider";
import { RequireHost } from "./RequireHost";
import { LandingPage } from "../pages/LandingPage";
import { useLocation } from "../routing";

function renderGuard(state: AuthState) {
  return render(
    <AuthContext.Provider value={state}>
      <RequireHost>
        <p>Protected host content</p>
      </RequireHost>
    </AuthContext.Provider>
  );
}

const protectedContent = () => screen.queryByText("Protected host content");

describe("host route boundary", () => {
  it("renders the protected tree only for a signed-in host", () => {
    renderGuard({ status: "host", user: null });
    expect(protectedContent()).toBeInTheDocument();
  });

  it.each(["guest", "signed-out"] as const)("returns a %s visitor from the dashboard to the home page", status => {
    window.history.replaceState(null, "", "/host");
    const historyLength = window.history.length;
    function Routes() {
      const location = useLocation();
      return location.pathname === "/" ? <LandingPage /> : <RequireHost><p>Protected host content</p></RequireHost>;
    }
    render(<AuthContext.Provider value={{ status, user: null }}><Routes /></AuthContext.Provider>);
    expect(protectedContent()).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(window.history.length).toBe(historyLength);
    expect(screen.getByRole("heading", { name: /your rental never had/i })).toBeInTheDocument();
    expect(screen.queryByText("Sign in to continue")).not.toBeInTheDocument();
  });

  it("returns home when an open dashboard session signs out", () => {
    window.history.replaceState(null, "", "/host");
    const { rerender } = renderGuard({ status: "host", user: null });
    expect(protectedContent()).toBeInTheDocument();
    rerender(<AuthContext.Provider value={{ status: "signed-out", user: null }}><RequireHost><p>Protected host content</p></RequireHost></AuthContext.Provider>);
    expect(protectedContent()).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("refuses access while the session is still resolving", () => {
    renderGuard({ status: "loading", user: null });
    expect(protectedContent()).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/confirming host access/i);
  });

  it("fails closed with no Firebase environment configured", () => {
    renderGuard({ status: "unconfigured", user: null });
    expect(protectedContent()).not.toBeInTheDocument();
    expect(screen.getByText(/fails closed instead of providing a local authentication bypass/i)).toBeInTheDocument();
  });

  it("defaults to a non-granting state outside the provider", () => {
    render(
      <RequireHost>
        <p>Protected host content</p>
      </RequireHost>
    );
    expect(protectedContent()).not.toBeInTheDocument();
  });
});
