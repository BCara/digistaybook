import { firebaseConfigured } from "../../lib/firebaseConfig";

export function HostSignInPage() {
  return (
    <div className="page narrow-page">
      <p className="eyebrow">Host access</p><h1>Sign in to manage your properties</h1>
      <div className="notice"><strong>{firebaseConfigured ? "Authentication configuration detected." : "Local configuration required."}</strong><p>Host authentication remains closed until a Firebase environment is configured. No development bypass grants dashboard access.</p></div>
      <form className="stacked-form"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" disabled={!firebaseConfigured} /><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" disabled={!firebaseConfigured} /><button type="button" disabled>Sign in</button></form>
    </div>
  );
}
