import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { reviewerAccess } from "./reviewerMfa";
import { firebaseConfig } from "../../lib/firebaseConfig";

export function RequireReviewer({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [access, setAccess] = useState<"checking" | "denied" | "setup" | "ready" | "error">("checking");
  useEffect(() => {
    let active = true; setAccess("checking");
    if (!user) { setAccess("denied"); return; }
    void (async () => {
      const { reviewer, mfa } = await reviewerAccess(user);
      const token = await user.getIdTokenResult();
      const simulated = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true" && firebaseConfig.projectId === "demo-digistaybook" && token.claims.localTestOperations === true;
      if (active) setAccess(!reviewer ? "denied" : mfa || simulated ? "ready" : "setup");
    })().catch(() => { if (active) setAccess("error"); });
    return () => { active = false; };
  }, [user]);
  if (access === "ready") return <>{children}</>;
  return <main className="page narrow-page"><h1>Safety Review access</h1>
    {access === "checking" ? <p role="status">Checking reviewer sign-in.</p> : access === "setup" ? <><p>Your reviewer account needs an authenticator sign-in before opening restricted cases.</p><a className="btn btn-primary" href="/operations/setup">Set up or use your authenticator</a></> : <p role={access === "error" ? "alert" : undefined}>{access === "error" ? "Your reviewer access could not be checked. Refresh and try again." : "An authorised reviewer account is required."}</p>}
  </main>;
}
