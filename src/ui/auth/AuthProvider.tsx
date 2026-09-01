import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { firebaseConfigured } from "../../lib/firebaseConfig";
import { getFirebaseServices } from "../../lib/firebase";

/**
 * `guest` is an anonymous session created for Guest self-service (Terms 4.4).
 * It is a signed-in Firebase user but never a Host, so it must not satisfy any
 * Host authorisation check.
 */
export type AuthStatus = "unconfigured" | "loading" | "signed-out" | "guest" | "host";

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

    void (async () => {
      const services = await getFirebaseServices();
      if (!services || cancelled) return;
      const { onAuthStateChanged } = await import("firebase/auth");
      unsubscribe = onAuthStateChanged(services.auth, (user) => {
        if (cancelled) return;
        if (!user) {
          setState({ status: "signed-out", user: null });
          return;
        }
        setState({ status: user.isAnonymous ? "guest" : "host", user });
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
