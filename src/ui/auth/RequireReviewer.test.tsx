import { render, screen } from "@testing-library/react";
import { AuthContext } from "./AuthProvider";
const access = vi.hoisted(() => vi.fn());
vi.mock("./reviewerMfa", () => ({ reviewerAccess: access }));
vi.mock("../../lib/firebaseConfig", () => ({ firebaseConfig: { projectId: "digistaybook-cbert" }, firebaseConfigured: true }));
import { RequireReviewer } from "./RequireReviewer";
const user = { getIdTokenResult: async () => ({ claims: { localTestOperations: true } }) } as any;
it.each([
  [{ reviewer: false, mfa: true }, "An authorised reviewer account is required."],
  [{ reviewer: true, mfa: false }, "Your reviewer account needs an authenticator sign-in before opening restricted cases."],
  [{ reviewer: true, mfa: true }, "Restricted queue"]
])("gates operations using both the role and second-factor session", async (result, expected) => {
  access.mockResolvedValue(result);
  render(<AuthContext.Provider value={{ status: "host", user }}><RequireReviewer><p>Restricted queue</p></RequireReviewer></AuthContext.Provider>);
  expect(await screen.findByText(expected)).toBeInTheDocument();
  if (!result.reviewer || !result.mfa) expect(screen.queryByText("Restricted queue")).not.toBeInTheDocument();
});
