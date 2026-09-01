import { AppShell } from "./ui/AppShell";
import { AuthProvider } from "./ui/auth/AuthProvider";
import { RequireHost } from "./ui/auth/RequireHost";
import { LandingPage } from "./ui/pages/LandingPage";
import { GuestWallPage } from "./ui/pages/GuestWallPage";
import { StayWallPage } from "./ui/pages/StayWallPage";
import { HostSignInPage } from "./ui/pages/HostSignInPage";
import { HostDashboardPage } from "./ui/pages/HostDashboardPage";
import { PrivacySafetyPage } from "./ui/pages/PrivacySafetyPage";
import { LegalDraftPage } from "./ui/pages/LegalDraftPage";
import { NotFoundPage } from "./ui/pages/NotFoundPage";

function resolvePage(pathname: string) {
  if (pathname === "/") return <LandingPage />;
  if (pathname.startsWith("/wall/")) return <GuestWallPage propertySlug={pathname.slice("/wall/".length) || "property"} />;
  if (pathname.startsWith("/stay/")) return <StayWallPage propertySlug={pathname.slice("/stay/".length) || "property"} />;
  if (pathname === "/host/sign-in") return <HostSignInPage />;
  if (pathname === "/host")
    return (
      <RequireHost>
        <HostDashboardPage />
      </RequireHost>
    );
  if (pathname === "/privacy-safety") return <PrivacySafetyPage />;
  if (pathname === "/terms") return <LegalDraftPage kind="terms" />;
  if (pathname === "/privacy") return <LegalDraftPage kind="privacy" />;
  return <NotFoundPage />;
}

export function App() {
  return (
    <AuthProvider>
      <AppShell>{resolvePage(window.location.pathname)}</AppShell>
    </AuthProvider>
  );
}
