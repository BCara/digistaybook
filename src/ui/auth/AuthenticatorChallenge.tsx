import { useState, type FormEvent } from "react";
import { completeMfa, mfaError, type MfaChallenge } from "./reviewerMfa";

export function AuthenticatorChallenge({ challenge, onComplete, onCancel }: {
  challenge: MfaChallenge; onComplete: () => void | Promise<void>; onCancel: () => void;
}) {
  const [code, setCode] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try { await completeMfa(challenge, code); setCode(""); await onComplete(); }
    catch (failure) { setError(mfaError(failure)); }
    finally { setBusy(false); }
  }
  return <form onSubmit={event => void submit(event)} className="page narrow-page">
    <h1>Enter your authenticator code</h1>
    <p>Open the authenticator app you connected to DigiStayBook and enter its current six-digit code.</p>
    <label>Authenticator code<input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} disabled={busy} /></label>
    {error && <p role="alert">{error}</p>}
    <div className="actions"><button className="btn btn-primary" disabled={busy || code.length !== 6}>Verify code</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>Cancel sign-in</button></div>
  </form>;
}
