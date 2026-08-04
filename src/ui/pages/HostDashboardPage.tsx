import { firebaseConfigured } from "../../lib/firebaseConfig";

export function HostDashboardPage() {
  if (!firebaseConfigured) {
    return <div className="page narrow-page"><p className="eyebrow">Protected host area</p><h1>Dashboard unavailable</h1><div className="notice"><strong>No Firebase environment is configured.</strong><p>The implementation deliberately fails closed instead of providing a local authentication bypass.</p></div></div>;
  }
  return <div className="page"><p className="eyebrow">Host control centre</p><h1>Your properties</h1><section className="feature-grid"><article><h2>Property setup</h2><p>Configure identity, foundational posts, house guidance and sandbox appearance.</p></article><article><h2>Moderation</h2><p>Review hidden posts, privacy requests and restricted escalation states.</p></article><article><h2>Billing</h2><p>View the server-owned subscription state and lifecycle dates.</p></article></section></div>;
}
