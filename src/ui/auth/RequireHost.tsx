import { useEffect, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { navigate } from "../routing";

function Blocked({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page narrow-page">
      <p className="eyebrow">Protected host area</p>
      <h1>{title}</h1>
      {children}
    </div>
  );
}

/**
 * Host-only route boundary. Only a non-anonymous, signed-in session renders the
 * protected tree; every other state (including an anonymous Guest session) is
 * refused without a development bypass.
 */
export function RequireHost({ children, signInPath = "/" }: { children: ReactNode; signInPath?: string }) {
  const { status } = useAuth();
  useEffect(() => {
    if (status === "signed-out" || status === "guest") navigate(signInPath, { replace: true });
  }, [status, signInPath]);

  if (status === "host") return <>{children}</>;

  if (status === "error") return <Blocked title="Your session couldn't load">
    <p role="alert">Check your connection and try again.</p>
    <button className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button>
  </Blocked>;

  if (status === "unconfigured") {
    return (
      <Blocked title="Dashboard unavailable">
        <div className="notice">
          <strong>No Firebase environment is configured.</strong>
          <p>The implementation deliberately fails closed instead of providing a local authentication bypass.</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/">Back to home</a>
        </div>
      </Blocked>
    );
  }

  if (status === "loading") {
    return (
      <Blocked title="Checking your session">
        <p className="lede" role="status">Confirming host access.</p>
      </Blocked>
    );
  }

  return null;
}
