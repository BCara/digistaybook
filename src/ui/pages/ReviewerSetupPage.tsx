import { useEffect, useState } from "react";
import { multiFactor, reload, type TotpSecret } from "firebase/auth";
import QRCode from "qrcode-generator";
import { useAuth } from "../auth/AuthProvider";
import { beginReviewerEnrollment, enrollReviewer, generateReviewerSecret, mfaError, reviewerAccess, verifyReviewerEmail, type MfaChallenge } from "../auth/reviewerMfa";
import { AuthenticatorChallenge } from "../auth/AuthenticatorChallenge";
import { signOutHost } from "../auth/hostAuth";
import { navigate } from "../routing";

export function ReviewerSetupPage() {
  const { user } = useAuth();
  const [access, setAccess] = useState<"loading" | "denied" | "allowed" | "error">("loading");
  const [verified, setVerified] = useState(false), [enrolled, setEnrolled] = useState(false);
  const [password, setPassword] = useState(""), [code, setCode] = useState(""), [secret, setSecret] = useState<TotpSecret | null>(null), [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(""), [qr, setQr] = useState("");
  useEffect(() => {
    let active = true;
    setAccess("loading"); setSecret(null); setQr(""); setCode(""); setPassword(""); setChallenge(null);
    if (!user) { setAccess("denied"); return; }
    void (async () => {
      await reload(user); const allowed = await reviewerAccess(user);
      if (active) { setAccess(allowed.reviewer ? "allowed" : "denied"); setVerified(user.emailVerified); setEnrolled(multiFactor(user).enrolledFactors.length > 0); }
    })().catch(() => { if (active) setAccess("error"); });
    return () => { active = false; };
  }, [user]);
  function displaySecret(next: TotpSecret) {
    if (!user?.email) throw new Error("The reviewer email is missing.");
    const image = QRCode(0, "M"); image.addData(next.generateQrCodeUrl(user.email, "DigiStayBook")); image.make();
    setQr(image.createDataURL(6)); setSecret(next);
  }
  async function run(action: () => Promise<void>) {
    if (busy) return; setBusy(true); setNotice("");
    try { await action(); } catch (error) { setNotice(mfaError(error)); } finally { setBusy(false); }
  }
  if (challenge && user) return <AuthenticatorChallenge challenge={challenge} onCancel={() => { setChallenge(null); setPassword(""); }} onComplete={async () => { setChallenge(null); displaySecret(await generateReviewerSecret(user)); }} />;
  if (access !== "allowed" || !user) return <main className="page narrow-page"><h1>Reviewer authenticator setup</h1><p role={access === "error" ? "alert" : undefined}>{access === "loading" ? "Checking reviewer access." : access === "error" ? "Access could not be checked. Refresh and try again." : "This account is not authorised for Safety Review."}</p></main>;
  const google = user.providerData.some(provider => provider.providerId === "google.com");
  return <main className="page narrow-page"><h1>Reviewer authenticator setup</h1><p>Reviewer account: {user.email}</p>
    {notice && <p role="alert">{notice}</p>}
    {!verified ? <><p>Verify your email address before connecting an authenticator.</p><button disabled={busy} onClick={() => void run(async () => { await verifyReviewerEmail(user); setNotice("Verification email sent. Open its link, then check again."); })}>Send verification email</button><button disabled={busy} onClick={() => void run(async () => { await reload(user); setVerified(user.emailVerified); if (!user.emailVerified) setNotice("The email is not verified yet."); })}>I have verified my email</button></>
      : enrolled ? <><p>Your authenticator is connected. Sign out and sign in again using its code to open Safety Review.</p><button disabled={busy} onClick={() => void run(async () => { await signOutHost(); navigate("/host/sign-in?returnTo=operations"); })}>Sign out and sign in with MFA</button><p>If you have lost your authenticator, contact the reviewer administrator for identity-checked recovery.</p><a href="/operations">Open Safety Review</a></>
      : secret ? <><p>In your authenticator app, choose Add account and scan this QR code.</p><img src={qr} alt="Authenticator setup QR code" width={260} height={260} /><p>Or enter this setup key manually:</p><code style={{ overflowWrap: "anywhere" }}>{secret.secretKey}</code><p>Keep this key private. Do not put it in the test report.</p><form onSubmit={event => { event.preventDefault(); void run(async () => { await enrollReviewer(user, secret, code); setSecret(null); setQr(""); setCode(""); setEnrolled(true); }); }}><label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={busy} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} /></label><button disabled={busy || code.length !== 6}>Confirm authenticator</button><button type="button" disabled={busy} onClick={() => { setSecret(null); setQr(""); setCode(""); }}>Cancel setup</button></form></>
      : <><p>Confirm your sign-in, then connect an authenticator app for Safety Review.</p>{!google && <label>Account password<input type="password" autoComplete="current-password" value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>}<button disabled={busy} onClick={() => void run(async () => { const result = await beginReviewerEnrollment(user, password); setPassword(""); if (result.challenge) setChallenge(result.challenge); else if (result.secret) displaySecret(result.secret); })}>{google ? "Confirm Google sign-in and set up authenticator" : "Confirm sign-in and set up authenticator"}</button></>}
  </main>;
}
