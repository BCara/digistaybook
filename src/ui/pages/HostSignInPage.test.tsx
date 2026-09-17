import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthContext, type AuthState } from "../auth/AuthProvider";
import { HostSignInPage } from "./HostSignInPage";

vi.mock("../../lib/firebaseConfig", () => ({
  firebaseConfig: {},
  firebaseConfigured: true
}));

const signInWithEmail = vi.fn();
const createHostAccount = vi.fn();
const signInWithGoogle = vi.fn();
const sendHostPasswordReset = vi.fn();
const signOutHost = vi.fn();

vi.mock("../auth/hostAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../auth/hostAuth")>()),
  createHostAccount: (...args: unknown[]) => createHostAccount(...args),
  signInWithEmail: (...args: unknown[]) => signInWithEmail(...args),
  signInWithGoogle: (...args: unknown[]) => signInWithGoogle(...args),
  sendHostPasswordReset: (...args: unknown[]) => sendHostPasswordReset(...args),
  signOutHost: (...args: unknown[]) => signOutHost(...args)
}));

// The page hands the dashboard to the router rather than reloading the
// document, so that is what these tests watch.
const navigate = vi.fn();
vi.mock("../routing", () => ({ navigate: (...args: unknown[]) => navigate(...args) }));

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, pathname: "/host/sign-in" }
  });
});

function renderPage(state: AuthState = { status: "signed-out", user: null }) {
  return render(
    <AuthContext.Provider value={state}>
      <HostSignInPage />
    </AuthContext.Provider>
  );
}

function renderSignUp(state: AuthState = { status: "signed-out", user: null }) {
  return render(
    <AuthContext.Provider value={state}>
      <HostSignInPage initialMode="create" />
    </AuthContext.Provider>
  );
}

const confirmField = () => screen.getByLabelText("Confirm password");
const createButton = () => screen.getByRole("button", { name: "Create account" });

const emailField = () => screen.getByLabelText("Email");
const passwordField = () => screen.getByLabelText("Password");
const submit = () => screen.getByRole("button", { name: "Sign in" });

describe("host sign-in", () => {
  it("recovers from a rejected Google startup instead of leaving the page busy", async () => {
    signInWithGoogle.mockRejectedValueOnce(new Error("SDK startup failed"));
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in could not start");
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    expect(submit()).toBeEnabled();
    expect(navigate).not.toHaveBeenCalled();
  });
  it("signs a host in and sends them to the dashboard", async () => {
    signInWithEmail.mockResolvedValue({ status: "success" });
    renderPage();

    fireEvent.change(emailField(), { target: { value: "host@example.com" } });
    fireEvent.change(passwordField(), { target: { value: "correct horse" } });
    fireEvent.click(submit());

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/host"));
    expect(signInWithEmail).toHaveBeenCalledWith("host@example.com", "correct horse");
  });

  it("shows the failure reason and stays put when credentials are rejected", async () => {
    signInWithEmail.mockResolvedValue({
      status: "error",
      message: "That email address and password do not match a host account."
    });
    renderPage();

    fireEvent.change(emailField(), { target: { value: "host@example.com" } });
    fireEvent.change(passwordField(), { target: { value: "wrong" } });
    fireEvent.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent(/do not match a host account/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("validates locally before calling Firebase", () => {
    renderPage();
    fireEvent.click(submit());
    expect(screen.getByRole("alert")).toHaveTextContent(/enter your email address and password/i);
    expect(signInWithEmail).not.toHaveBeenCalled();
  });

  it("stays silent when the Google popup is dismissed", async () => {
    signInWithGoogle.mockResolvedValue({ status: "cancelled" });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("requires an email address before sending a reset link", async () => {
    sendHostPasswordReset.mockResolvedValue({ status: "success" });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Forgot your password?" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/enter your email address first/i);
    expect(sendHostPasswordReset).not.toHaveBeenCalled();

    fireEvent.change(emailField(), { target: { value: "host@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Forgot your password?" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/password reset email is on its way/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("offers the dashboard instead of the form to an established host session", () => {
    renderPage({ status: "host", user: null });
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to your dashboard" })).toHaveAttribute("href", "/host");
  });

  it("still offers the form to an anonymous guest wall session", () => {
    renderPage({ status: "guest", user: null });
    expect(emailField()).toBeEnabled();
  });
});

describe("host account creation", () => {
  it("creates an account and sends the new host to the dashboard", async () => {
    createHostAccount.mockResolvedValue({ status: "success" });
    renderSignUp();

    fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: "Ada" } });
    fireEvent.change(emailField(), { target: { value: "new@example.com" } });
    fireEvent.change(passwordField(), { target: { value: "correct horse" } });
    fireEvent.change(confirmField(), { target: { value: "correct horse" } });
    fireEvent.click(createButton());

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/host"));
    expect(createHostAccount).toHaveBeenCalledWith("new@example.com", "correct horse", "Ada");
  });

  it("validates locally before creating anything", () => {
    renderSignUp();

    fireEvent.change(emailField(), { target: { value: "new@example.com" } });
    fireEvent.change(passwordField(), { target: { value: "short" } });
    fireEvent.change(confirmField(), { target: { value: "shore" } });
    fireEvent.click(createButton());

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/Both passwords need to match/i)).toBeInTheDocument();
    expect(createHostAccount).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("tells a returning host their address is already registered", async () => {
    createHostAccount.mockResolvedValue({
      status: "error",
      message: "An account already exists for that email address. Sign in instead, or reset your password."
    });
    renderSignUp();

    fireEvent.change(emailField(), { target: { value: "host@example.com" } });
    fireEvent.change(passwordField(), { target: { value: "correct horse" } });
    fireEvent.change(confirmField(), { target: { value: "correct horse" } });
    fireEvent.click(createButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/account already exists/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("switches between creating an account and signing in without leaving the page", () => {
    renderPage();
    expect(screen.queryByLabelText("Confirm password")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create a host account" }));
    expect(confirmField()).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Forgot your password?" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign in instead" }));
    expect(screen.queryByLabelText("Confirm password")).not.toBeInTheDocument();
    expect(submit()).toBeInTheDocument();
  });

  it("offers Google on both halves of the page", () => {
    const { unmount } = renderPage();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    unmount();

    renderSignUp();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  });

  it("tells hosts that guests never need an account", () => {
    renderSignUp();
    expect(screen.getByText(/Guests never need an account/i)).toBeInTheDocument();
    expect(screen.getByText(/anonymous guest session/i)).toBeInTheDocument();
  });
});
