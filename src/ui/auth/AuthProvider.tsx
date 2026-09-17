import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { firebaseConfigured } from "../../lib/firebaseConfig";
import { getFirebaseAuth } from "../../lib/firebase";

/**
 * `guest` is an anonymous session created for Guest self-service (Terms 4.4).
 * It is a signed-in Firebase user but never a Host, so it must not satisfy any
 * Host authorisation check.
 */
export type AuthStatus = "unconfigured" | "loading" | "error" | "signed-out" | "guest" | "host";

export type AuthState = {
  status: AuthStatus;
  user: import("firebase/auth").User | null;
};

const initialState: AuthState = {
  status: firebaseConfigured ? "loading" : "unconfigured",
  user: null
};

// The default value is deliberately non-granting: a component rendered outside
// the provider fails closed rather than assuming Host access.
export const AuthContext = createContext<AuthState>(initialState);

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    if (!firebaseConfigured) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const fail = () => { if (!cancelled) setState({ status: "error", user: null }); };
    const timeout = window.setTimeout(fail, 15000);

    void (async () => {
      const services = await getFirebaseAuth();
      if (!services || cancelled) return;
      const { onAuthStateChanged } = await import("firebase/auth");
      if (cancelled) return;
      unsubscribe = onAuthStateChanged(services.auth, (user) => {
        if (cancelled) return;
        window.clearTimeout(timeout);
        if (!user) {
          setState({ status: "signed-out", user: null });
          return;
        }
        setState({ status: user.isAnonymous ? "guest" : "host", user });
      }, fail);
    })().catch(fail);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      unsubscribe?.();
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
