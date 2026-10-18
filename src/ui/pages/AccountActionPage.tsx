import { useEffect, useState, type FormEvent } from "react";
import { applyActionCode, checkActionCode, confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase";
import { passwordMinimumLength, sendHostPasswordReset } from "../auth/hostAuth";
import { accountError } from "../auth/hostAccount";

export function AccountActionPage({ kind }: { kind: "resetPassword" | "verifyEmail" }) {
  const code = new URLSearchParams(window.location.search).get("oobCode") ?? "";
  const reset = kind === "resetPassword";
  const [stage, setStage] = useState<"checking" | "ready" | "invalid" | "done">(code ? "checking" : "invalid");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!code) return;
    let current = true;
    void (async () => {
      const services = await getFirebaseAuth();
      if (!services) throw new Error("Unavailable");
      if (reset) {
        const address = await verifyPasswordResetCode(services.auth, code);
        if (current) setEmail(address);
      } else {
        const action = await checkActionCode(services.auth, code);
        if (action.operation !== "VERIFY_EMAIL") throw new Error("Invalid verification link");
      }
      if (current) setStage("ready");
    })().catch(() => { if (current) setStage("invalid"); });
    return () => { current = false; };
  }, [code, reset]);

  async function complete(event: FormEvent) {
    event.preventDefault(); setMessage("");
    if (reset && (password.length < passwordMinimumLength || password !== confirmation)) {
      setMessage(`Use at least ${passwordMinimumLength} characters and make sure both passwords match.`); return;
    }
    setBusy(true);
    try {
      const services = await getFirebaseAuth();
      if (!services) throw new Error("The service is unavailable. Please try again.");
      if (reset) await confirmPasswordReset(services.auth, code, password);
      else await applyActionCode(services.auth, code);
      setPassword(""); setConfirmation(""); setStage("done");
      window.history.replaceState(null, "", window.location.pathname);
    } catch (error) {
      if (["auth/expired-action-code", "auth/invalid-action-code"].includes((error as { code?: string }).code ?? "")) setStage("invalid");
      else setMessage(accountError(error));
    } finally { setBusy(false); }
  }

  async function resend(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await sendHostPasswordReset(email);
      setMessage(result.status === "error" ? result.message : "If that address belongs to a host account, a reset email is on its way.");
    } finally { setBusy(false); }
  }

  return <div className="page narrow-page">
    <p className="eyebrow">Your DigiStayBook account</p>
    <h1>{stage === "done" ? reset ? "Password updated" : "Email verified"
      : stage === "invalid" ? "This link is no longer valid"
        : reset ? "Reset your password" : "Verify your email"}</h1>
    {stage === "checking" && <p role="status">Checking your link…</p>}
    {stage === "ready" && <>
      <p>{reset ? `Choose a new password for ${email}.` : "Confirm your email address using the button below."}</p>
      <form className="stacked-form" onSubmit={complete}>
        {reset && <>
          <label htmlFor="new-password">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" minLength={passwordMinimumLength} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />
          <p className="field-hint">At least {passwordMinimumLength} characters.</p>
          <label htmlFor="confirm-new-password">Confirm new password</label>
          <input id="confirm-new-password" type="password" autoComplete="new-password" minLength={passwordMinimumLength} required value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} />
        </>}
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : reset ? "Update password" : "Verify email"}</button>
      </form>
    </>}
    {stage === "done" && <><p>{reset ? "Your new password is ready. You can now sign in." : "Your email address is confirmed. Return to your account to continue."}</p><a className="btn btn-primary" href="/host/sign-in">Continue to sign in</a></>}
    {stage === "invalid" && <>
      <p>The link may have expired or already been used. Request a new one to continue.</p>
      {reset ? <form className="stacked-form" onSubmit={resend}>
        <label htmlFor="reset-email">Email</label><input id="reset-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} />
        <button className="btn btn-primary" disabled={busy}>{busy ? "Requesting…" : "Request a new reset link"}</button>
      </form> : <a className="btn btn-primary" href="/host/account">Sign in to request another verification email</a>}
    </>}
    {message && <p className="notice" role="alert">{message}</p>}
  </div>;
}
