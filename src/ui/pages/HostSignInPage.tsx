import { firebaseConfigured } from "../../lib/firebaseConfig";

export function HostSignInPage() {
  return (
    <div className="page narrow-page">
      <p className="eyebrow">Host access</p>
      <h1>Sign in to manage your properties</h1>
      <p className="lede">
        One dashboard for every property you host: walls, pinned house guidance, moderation and billing state.
      </p>

      <div className="notice">
        <strong>{firebaseConfigured ? "Authentication configuration detected." : "Local configuration required."}</strong>
        <p>Host authentication remains closed until a Firebase environment is configured. No development bypass grants dashboard access.</p>
      </div>

      <form className="stacked-form">
        <button type="button" className="btn btn-secondary btn-block" disabled>Continue with Google</button>
        <p className="field-hint">or use your email address</p>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" disabled={!firebaseConfigured} />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" disabled={!firebaseConfigured} />
        <button type="button" disabled>Sign in</button>
      </form>

      <p className="field-hint" style={{ marginTop: "18px" }}>
        New here? <a className="text-link" href="/#pricing">See what a DigiStayBook property includes</a>.
      </p>
    </div>
  );
}
