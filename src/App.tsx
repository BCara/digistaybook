import { embeddedWallSlug, stayRoute } from "./domain/wallAddress";
import { AppShell } from "./ui/AppShell";
import { useLinkNavigation, useLocation } from "./ui/routing";
import { AuthProvider } from "./ui/auth/AuthProvider";
import { RequireHost } from "./ui/auth/RequireHost";
import { LandingPage } from "./ui/pages/LandingPage";
import { PricingPage } from "./ui/pages/PricingPage";
import { GuestWallPage } from "./ui/pages/GuestWallPage";
import { StayWallPage } from "./ui/pages/StayWallPage";
import { HostSignInPage } from "./ui/pages/HostSignInPage";
import { HostDashboardPage } from "./ui/pages/HostDashboardPage";
import { HostModerationPage } from "./ui/pages/HostModerationPage";
import { HostFeedbackPage } from "./ui/pages/HostFeedbackPage";
import { HostExportPage } from "./ui/pages/HostExportPage";
import { HostBillingPage } from "./ui/pages/HostBillingPage";
import { HostBillingOverviewPage } from "./ui/pages/HostBillingOverviewPage";
import { HostPropertySettingsPage } from "./ui/pages/HostPropertySettingsPage";
import { HostQrPage } from "./ui/pages/HostQrPage";
import { HostWallDesignPage } from "./ui/pages/HostWallDesignPage";
import { PrivacySafetyPage } from "./ui/pages/PrivacySafetyPage";
import { SafetyOperationsPage } from "./ui/pages/SafetyOperationsPage";
import { LegalDraftPage } from "./ui/pages/LegalDraftPage";
import { NotFoundPage } from "./ui/pages/NotFoundPage";
import { DEMO_SLUG } from "./ui/wall/demoWall";

function resolvePage(pathname: string) {
  if (pathname === "/") return <LandingPage />;
  if (pathname === "/pricing") return <PricingPage />;
  if (pathname.startsWith("/wall/")) return <GuestWallPage propertySlug={pathname.slice("/wall/".length) || "property"} />;
  if (pathname.startsWith("/stay/")) {
    // The guestbook link carries the token as its own segment, so the address
    // is read rather than sliced: what a guest holds is a slug and a secret,
    // and a link missing the second is the public wall, not a broken page.
    const stay = stayRoute(pathname);
    return <StayWallPage propertySlug={stay?.slug || "property"} stayToken={stay?.token ?? null} />;
  }
  if (pathname === "/host/sign-in") return <HostSignInPage />;
  if (pathname === "/host/sign-up") return <HostSignInPage initialMode="create" />;
  if (pathname === "/host")
    return (
      <RequireHost>
        <HostDashboardPage />
      </RequireHost>
    );
  // Account billing, above the per-property routes: what a Host owes across
  // every property is a different question from what one property costs, and
  // only the first of the two can be answered without naming a property.
  if (pathname === "/host/billing")
    return (
      <RequireHost>
        <HostBillingOverviewPage />
      </RequireHost>
    );
  if (pathname.startsWith("/host/property/")) {
    // A property is the wall laid out as a guest meets it — which is the
    // property's own address, because it is where a Host does the work — plus
    // the public wall behind the shared link, the walls it is served on,
    // moderation, which is a different job from writing the wall, billing,
    // which decides whether any of it is served at all, and the settings,
    // which change what the property is rather than what its walls say.
    const [propertyId, section] = pathname.slice("/host/property/".length).split("/");
    if (propertyId && section === "export") return <RequireHost><HostExportPage key={propertyId} propertyId={propertyId} /></RequireHost>;
    if (propertyId && section === "feedback") return <RequireHost><HostFeedbackPage propertyId={propertyId} /></RequireHost>;
    if (propertyId && !section)
      return (
        <RequireHost>
          <HostWallDesignPage propertyId={propertyId} />
        </RequireHost>
      );
    if (propertyId && section === "public")
      return (
        <RequireHost>
          <HostWallDesignPage propertyId={propertyId} view="public" />
        </RequireHost>
      );
    if (propertyId && section === "settings")
      return (
        <RequireHost>
          <HostPropertySettingsPage propertyId={propertyId} />
        </RequireHost>
      );
    if (propertyId && section === "qr")
      return (
        <RequireHost>
          <HostQrPage propertyId={propertyId} />
        </RequireHost>
      );
    if (propertyId && section === "moderation")
      return (
        <RequireHost>
          <HostModerationPage key={propertyId} propertyId={propertyId} />
        </RequireHost>
      );
    if (propertyId && section === "billing")
      return (
        <RequireHost>
          <HostBillingPage propertyId={propertyId} />
        </RequireHost>
      );
  }
  if (pathname === "/privacy-safety") return <PrivacySafetyPage />;
  if (pathname === "/operations") return <RequireHost><SafetyOperationsPage /></RequireHost>;
  if (pathname === "/terms") return <LegalDraftPage kind="terms" />;
  if (pathname === "/privacy") return <LegalDraftPage kind="privacy" />;
  return <NotFoundPage />;
}

export function App() {
  // Navigation is client-side (see ui/routing): the page changes without the
  // session, the Firebase SDK and every open Firestore connection being thrown
  // away and rebuilt.
  const location = useLocation();
  useLinkNavigation(location);
  // Handbook §6.3.1: a guest never enters host or acquisition navigation.
  // The two guest addresses are matched apart rather than by one pattern wide
  // enough for both: only the in-stay address carries a second segment, and a
  // public wall address with something after it is not a wall.
  const stay = stayRoute(location.pathname);
  const publicWall = /^\/wall\/([^/]+)$/.exec(location.pathname);
  const guestSlug = stay?.slug ?? publicWall?.[1];
  if (guestSlug && guestSlug !== DEMO_SLUG) return <AuthProvider>{resolvePage(location.pathname)}</AuthProvider>;

  // A wall inside a Host's own website is not our page with a frame around
  // it: the site header, the site footer and the demo ribbon are our furniture
  // in someone else's room, so the embedded route renders the wall alone. The
  // attribution link stays, because on a Host's own site it is the point.
  const embedded = embeddedWallSlug(location.pathname);
  if (embedded) {
    return (
      <AuthProvider>
        <GuestWallPage propertySlug={embedded} embedded />
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <AppShell>{resolvePage(location.pathname)}</AppShell>
    </AuthProvider>
  );
}
