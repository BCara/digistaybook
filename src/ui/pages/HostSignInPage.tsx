import { useState, type FormEvent } from "react";
import { firebaseConfigured } from "../../lib/firebaseConfig";
import { useAuth } from "../auth/AuthProvider";
import {
  createHostAccount,
  passwordMinimumLength,
  sendHostPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutHost,
  validateNewHostCredentials,
  type CredentialProblem,
  type SignInOutcome
} from "../auth/hostAuth";
import { navigate } from "../routing";

type Feedback = { tone: "error" | "success"; message: string } | null;

/**
 * One page carries both halves of Host access (`DSB-BOP-P6-003`): Google, and
 * standard email and password creation or entry. Both land on the dashboard.
 */
export type HostAccessMode = "sign-in" | "create";

/** Where a host lands once a session is established. */
const DASHBOARD = "/host";

function goToDashboard() {
  // Client-side, so the dashboard does not have to boot the SDK and resolve
  // the session a second time immediately after this page just did both.
  if (typeof window !== "undefined") navigate(DASHBOARD);
}

function problemFor(problems: CredentialProblem[], field: CredentialProblem["field"]) {
  return problems.find((problem) => problem.field === field)?.message;
}

export function HostSignInPage({ initialMode = "sign-in" }: { initialMode?: HostAccessMode } = {}) {
  const { status } = useAuth();
  const [mode, setMode] = useState<HostAccessMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState<null | "email" | "google" | "reset" | "create">(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [problems, setProblems] = useState<CredentialProblem[]>([]);

  const busy = pending !== null;
  const creating = mode === "create";

  // An anonymous Guest wall session is signed in but is never a Host, so the
  // form stays available to it rather than being treated as an active session.
  if (status === "host") {
    return (
      <div className="page narrow-page">
        <p className="eyebrow">Host access</p>
        <h1>You are signed in</h1>
        <p className="lede">Your host session is active on this device.</p>
        <div className="actions">
          <a className="btn btn-primary" href={DASHBOARD}>Go to your dashboard</a>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              void signOutHost();
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  function switchMode(next: HostAccessMode) {
    setMode(next);
    setFeedback(null);
    setProblems([]);
    setPassword("");
    setConfirmPassword("");
  }

  async function run(
    kind: "email" | "google" | "reset" | "create",
    action: () => Promise<SignInOutcome>
  ) {
    setPending(kind);
    setFeedback(null);
    let outcome: SignInOutcome;
    try {
      outcome = await action();
    } catch {
      setFeedback({ tone: "error", message: "Sign-in could not start. Check your connection and try again. If this continues, refresh the page." });
      return;
    } finally {
      setPending(null);
    }
    if (outcome.status === "cancelled") return;
    if (outcome.status === "error") {
      setFeedback({ tone: "error", message: outcome.message });
      return;
    }
    if (kind === "reset") {
      setFeedback({
        tone: "success",
        message: "If that address belongs to a host account, a password reset email is on its way."
      });
      return;
    }
    goToDashboard();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (creating) {
      const found = validateNewHostCredentials({ email, password, confirmPassword });
      setProblems(found);
      setFeedback(null);
      if (found.length > 0) return;
      void run("create", () => createHostAccount(email, password, displayName));
      return;
    }

    setProblems([]);
    if (!email.trim() || !password) {
      setFeedback({ tone: "error", message: "Enter your email address and password to continue." });
      return;
    }
    void run("email", () => signInWithEmail(email, password));
  }

  function onReset() {
    if (busy) return;
    if (!email.trim()) {
      setFeedback({ tone: "error", message: "Enter your email address first, then request a reset link." });
      return;
    }
    void run("reset", () => sendHostPasswordReset(email));
  }

  return (
    <div className="page narrow-page">
      <p className="eyebrow">Host access</p>
      <h1>{creating ? "Create your host account" : "Sign in to manage your properties"}</h1>
      <p className="lede">
        {creating
          ? "One account covers every property you host. You are not asked to name a property or to pay at this stage."
          : "One dashboard for every property you host: walls, pinned house guidance, moderation and billing state."}
      </p>

      {!firebaseConfigured && (
        <div className="notice">
          <strong>Local configuration required.</strong>
          <p>Host authentication remains closed until a Firebase environment is configured. No development bypass grants dashboard access.</p>
        </div>
      )}

      {feedback && (
        <div className="notice" role="alert">
          <strong>
            {feedback.tone === "success"
              ? "Check your inbox."
              : creating
                ? "We could not create your account."
                : "We could not sign you in."}
          </strong>
          <p>{feedback.message}</p>
        </div>
      )}

      <form className="stacked-form" onSubmit={onSubmit} noValidate>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          disabled={!firebaseConfigured || busy}
          onClick={() => void run("google", signInWithGoogle)}
        >
          {pending === "google" ? "Opening Google…" : "Continue with Google"}
        </button>
        <p className="field-hint">
          {creating ? "or create an account with your email address" : "or use your email address"}
        </p>

        {creating && (
          <>
            <label htmlFor="display-name">
              Your name<span className="label-optional">Optional</span>
            </label>
            <input
              id="display-name"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={!firebaseConfigured || busy}
            />
          </>
        )}

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          aria-describedby={creating ? "email-hint" : undefined}
          aria-invalid={problemFor(problems, "email") ? true : undefined}
          onChange={(event) => setEmail(event.target.value)}
          disabled={!firebaseConfigured || busy}
        />
        {creating && (
          <p className="field-hint" id="email-hint">
            {problemFor(problems, "email") ?? "You will use this address to sign in."}
          </p>
        )}

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete={creating ? "new-password" : "current-password"}
          value={password}
          aria-describedby={creating ? "password-hint" : undefined}
          aria-invalid={problemFor(problems, "password") ? true : undefined}
          onChange={(event) => setPassword(event.target.value)}
          disabled={!firebaseConfigured || busy}
        />
        {creating && (
          <p className="field-hint" id="password-hint">
            {problemFor(problems, "password") ?? `At least ${passwordMinimumLength} characters.`}
          </p>
        )}

        {creating && (
          <>
            <label htmlFor="confirm-password">Confirm password</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              aria-describedby="confirm-hint"
              aria-invalid={problemFor(problems, "confirm") ? true : undefined}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={!firebaseConfigured || busy}
            />
            <p className="field-hint" id="confirm-hint">
              {problemFor(problems, "confirm") ?? "Type the same password again."}
            </p>
          </>
        )}

        <button type="submit" disabled={!firebaseConfigured || busy}>
          {creating
            ? pending === "create"
              ? "Creating your account…"
              : "Create account"
            : pending === "email"
              ? "Signing in…"
              : "Sign in"}
        </button>

        {!creating && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={!firebaseConfigured || busy}
            onClick={onReset}
          >
            {pending === "reset" ? "Sending reset link…" : "Forgot your password?"}
          </button>
        )}
      </form>

      <p className="field-hint" style={{ marginTop: "18px" }}>
        {creating ? (
          <>
            Already have an account?{" "}
            <button type="button" className="text-link link-button" onClick={() => switchMode("sign-in")}>
              Sign in instead
            </button>
            .
          </>
        ) : (
          <>
            New here?{" "}
            <button type="button" className="text-link link-button" onClick={() => switchMode("create")}>
              Create a host account
            </button>{" "}
            or <a className="text-link" href="/pricing">see what a DigiStayBook property includes</a>.
          </>
        )}
      </p>

      <p className="field-hint access-note">
        Guests never need an account. Adding a memory to a wall uses an anonymous guest session, which is
        separate from host access and never reaches this dashboard.
      </p>
    </div>
  );
}
