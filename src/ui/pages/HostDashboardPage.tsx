import { firebaseConfigured } from "../../lib/firebaseConfig";
import { Icon } from "../Brand";

const panels = [
  {
    icon: "manual" as const,
    title: "Property setup",
    body: "Configure identity, foundational posts, house guidance and sandbox appearance."
  },
  {
    icon: "shield" as const,
    title: "Moderation",
    body: "Review hidden posts, privacy requests and restricted escalation states."
  },
  {
    icon: "dashboard" as const,
    title: "Billing",
    body: "View the server-owned subscription state and lifecycle dates."
  }
];

export function HostDashboardPage() {
  if (!firebaseConfigured) {
    return (
      <div className="page narrow-page">
        <p className="eyebrow">Protected host area</p>
        <h1>Dashboard unavailable</h1>
        <div className="notice">
          <strong>No Firebase environment is configured.</strong>
          <p>The implementation deliberately fails closed instead of providing a local authentication bypass.</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/">Back to home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <p className="eyebrow">Host control centre</p>
      <h1>Your properties</h1>
      <p className="lede">Curate walls, pin house guidance and track activation state across every property.</p>
      <section className="feature-grid" style={{ marginTop: "32px" }}>
        {panels.map((panel) => (
          <article key={panel.title}>
            <Icon name={panel.icon} />
            <h2>{panel.title}</h2>
            <p>{panel.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
