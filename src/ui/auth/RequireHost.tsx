import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";

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
export function RequireHost({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "host") return <>{children}</>;

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

  return (
    <Blocked title="Sign in to continue">
      <div className="notice">
        <strong>This area is limited to signed-in hosts.</strong>
        <p>
          {status === "guest"
            ? "A guest wall session does not grant host access. Sign in with your host account to continue."
            : "Sign in with your host account to reach your dashboard."}
        </p>
      </div>
      <div className="actions">
        <a className="btn" href="/host/sign-in">Go to host sign-in</a>
        <a className="btn btn-secondary" href="/">Back to home</a>
      </div>
    </Blocked>
  );
}
