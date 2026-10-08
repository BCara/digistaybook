import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { AuthenticatorChallenge } from "../auth/AuthenticatorChallenge";
import { passwordMinimumLength, sendHostPasswordReset } from "../auth/hostAuth";
import {
  accountError, changeHostPassword, confirmHostPassword, refreshHostAccount,
  requestHostEmailChange, saveHostName, verifyHostEmail
} from "../auth/hostAccount";
import type { MfaChallenge } from "../auth/reviewerMfa";

type Notice = { tone: "success" | "error"; message: string };
type Change = { kind: "email"; value: string } | { kind: "password"; value: string };

export function HostAccountPage() {
  const { status, user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.displayName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const pending = useRef<Change | null>(null);

  useEffect(() => {
    setName(user?.displayName ?? ""); setEmail(user?.email ?? "");
    setEmailPassword(""); setCurrentPassword(""); setNewPassword(""); setConfirmation("");
    setChallenge(null); pending.current = null; setPendingEmail(""); setNotice(null);
    return () => { pending.current = null; };
  }, [user?.uid]);

  if (status !== "host" || !user || user.isAnonymous) return null;
  const host = user;
  const passwordAccount = host.providerData.some(provider => provider.providerId === "password");
  const googleAccount = host.providerData.some(provider => provider.providerId === "google.com");

  function clearPasswords() {
    setEmailPassword(""); setCurrentPassword(""); setNewPassword(""); setConfirmation("");
  }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setNotice(null);
    try { await action(); }
    catch (error) { setNotice({ tone: "error", message: accountError(error) }); }
    finally { setBusy(false); }
  }
  async function applyChange(change: Change) {
    if (change.kind === "email") {
      await requestHostEmailChange(host, change.value);
      setPendingEmail(change.value);
      setNotice({ tone: "success", message: `Verification link sent to ${change.value}. Your sign-in email stays ${host.email} until you open that link.` });
    } else {
      await changeHostPassword(host, change.value);
      setNotice({ tone: "success", message: "Your password has been changed." });
    }
  }
  async function secureChange(change: Change, password: string) {
    await run(async () => {
      try {
        const next = await confirmHostPassword(host, password);
        if (next) { pending.current = change; setChallenge(next); }
        else await applyChange(change);
      } finally { clearPasswords(); }
    });
  }
  function submitEmail(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!address || !address.includes("@") || address.startsWith("@") || address.endsWith("@")) {
      setNotice({ tone: "error", message: "Enter a valid email address." }); return;
    }
    if (address.toLowerCase() === host.email?.toLowerCase()) {
      setNotice({ tone: "error", message: "Enter a different email address." }); return;
    }
    void secureChange({ kind: "email", value: address }, emailPassword);
  }
  function submitPassword(event: FormEvent) {
    event.preventDefault();
    const message = newPassword.length < passwordMinimumLength
      ? `Choose a password of at least ${passwordMinimumLength} characters.`
      : newPassword !== confirmation ? "Both new passwords need to match."
      : newPassword === currentPassword ? "Choose a password different from your current password." : "";
    if (message) { setNotice({ tone: "error", message }); return; }
    void secureChange({ kind: "password", value: newPassword }, currentPassword);
  }

  if (challenge) return <AuthenticatorChallenge challenge={challenge}
    onCancel={() => { pending.current = null; setChallenge(null); clearPasswords(); setNotice({ tone: "error", message: "Confirmation cancelled. No account change was made." }); }}
    onComplete={async () => {
      const change = pending.current; pending.current = null; setChallenge(null);
      if (change) await run(() => applyChange(change));
    }} />;

  return <div className="page narrow-page account-page">
    <p className="eyebrow">Host account</p>
    <h1>Account settings</h1>
    <p className="lede">Manage your details and how you sign in. This account covers all your properties.</p>
    {notice && <div className="notice" role={notice.tone === "error" ? "alert" : "status"}>{notice.message}</div>}

    <section className="account-section" aria-labelledby="account-profile">
      <h2 id="account-profile">Your details</h2>
      <form className="stacked-form" onSubmit={event => {
        event.preventDefault(); void run(async () => {
          await saveHostName(host, name); refreshUser?.();
          setNotice({ tone: "success", message: "Your name has been saved." });
        });
      }}>
        <label htmlFor="account-name">Your name <span className="label-optional">Optional</span></label>
        <input id="account-name" autoComplete="name" maxLength={80} value={name} disabled={busy} onChange={event => setName(event.target.value)} />
        <button className="btn btn-primary" disabled={busy}>Save name</button>
      </form>
    </section>

    <section className="account-section" aria-labelledby="account-email">
      <h2 id="account-email">Sign-in email</h2>
      <p className="account-address">{host.email}</p>
      {passwordAccount ? <>
        <p className="field-hint">{host.emailVerified ? "Email verified." : "Email not verified yet."}</p>
        {!host.emailVerified && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run(async () => {
          await verifyHostEmail(host); setNotice({ tone: "success", message: "Verification email sent. Open its link, then refresh your account details." });
        })}>Send verification email</button>}
        <form className="stacked-form" onSubmit={submitEmail}>
          <label htmlFor="account-new-email">New email address</label>
          <input id="account-new-email" type="email" autoComplete="email" required value={email} disabled={busy} onChange={event => setEmail(event.target.value)} />
          <label htmlFor="account-email-password">Current password to change email</label>
          <input id="account-email-password" type="password" autoComplete="current-password" required value={emailPassword} disabled={busy} onChange={event => setEmailPassword(event.target.value)} />
          <p className="field-hint">We’ll send a verification link to the new address before changing your sign-in email.</p>
          <button className="btn btn-primary" disabled={busy}>Verify new email</button>
        </form>
        {pendingEmail && <p className="field-hint">Awaiting verification of {pendingEmail}.</p>}
      </> : <p>Your email and sign-in are managed through your Google account.</p>}
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void run(async () => {
        await refreshHostAccount(host); refreshUser?.(); setEmail(host.email ?? "");
        if (pendingEmail === host.email) setPendingEmail("");
        setNotice({ tone: "success", message: "Account details refreshed." });
      })}>Refresh account details</button>
    </section>

    <section className="account-section" aria-labelledby="account-password">
      <h2 id="account-password">Password</h2>
      {passwordAccount ? <>
        <form className="stacked-form" onSubmit={submitPassword}>
          <label htmlFor="account-current-password">Current password</label>
          <input id="account-current-password" type="password" autoComplete="current-password" required value={currentPassword} disabled={busy} onChange={event => setCurrentPassword(event.target.value)} />
          <label htmlFor="account-new-password">New password</label>
          <input id="account-new-password" type="password" autoComplete="new-password" minLength={passwordMinimumLength} required value={newPassword} disabled={busy} onChange={event => setNewPassword(event.target.value)} />
          <p className="field-hint">At least {passwordMinimumLength} characters.</p>
          <label htmlFor="account-confirm-password">Confirm new password</label>
          <input id="account-confirm-password" type="password" autoComplete="new-password" required value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} />
          <button className="btn btn-primary" disabled={busy}>Change password</button>
        </form>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void run(async () => {
          const result = await sendHostPasswordReset(host.email ?? "");
          if (result.status !== "success") throw new Error(result.status === "error" ? result.message : "The reset email could not be sent.");
          setNotice({ tone: "success", message: "Password reset email requested. Check your inbox for the reset link." });
        })}>Send password reset email</button>
      </> : <p>You sign in with Google, so there is no separate DigiStayBook password.</p>}
      {googleAccount && <p><a className="text-link" href="https://myaccount.google.com/" target="_blank" rel="noopener noreferrer">Manage your Google account</a></p>}
    </section>
    <a className="text-link" href="/host">Back to your dashboard</a>
  </div>;
}
