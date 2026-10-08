import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const complete = vi.hoisted(() => vi.fn());
vi.mock("./reviewerMfa", () => ({ completeMfa: complete, mfaError: () => "That code was not accepted." }));
import { AuthenticatorChallenge } from "./AuthenticatorChallenge";
beforeEach(() => complete.mockReset());
it("keeps a rejected challenge open and only completes after verification", async () => {
  const done = vi.fn(); complete.mockRejectedValueOnce(new Error("invalid")).mockResolvedValueOnce({});
  render(<AuthenticatorChallenge challenge={{} as any} onComplete={done} onCancel={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "123456" } }); fireEvent.click(screen.getByText("Verify code"));
  expect(await screen.findByRole("alert")).toHaveTextContent("not accepted"); expect(done).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Verify code")); await waitFor(() => expect(done).toHaveBeenCalledOnce());
});
it("cancels without completing MFA", () => {
  const cancel = vi.fn(); render(<AuthenticatorChallenge challenge={{} as any} onComplete={vi.fn()} onCancel={cancel} />);
  fireEvent.click(screen.getByText("Cancel sign-in")); expect(cancel).toHaveBeenCalledOnce(); expect(complete).not.toHaveBeenCalled();
});
