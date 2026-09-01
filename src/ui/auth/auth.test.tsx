import { render, screen } from "@testing-library/react";
import { AuthContext, type AuthState } from "./AuthProvider";
import { RequireHost } from "./RequireHost";

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

  it("refuses an anonymous Guest wall session", () => {
    renderGuard({ status: "guest", user: null });
    expect(protectedContent()).not.toBeInTheDocument();
    expect(screen.getByText(/guest wall session does not grant host access/i)).toBeInTheDocument();
  });

  it("refuses a signed-out visitor and points at host sign-in", () => {
    renderGuard({ status: "signed-out", user: null });
    expect(protectedContent()).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to host sign-in" })).toHaveAttribute("href", "/host/sign-in");
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
