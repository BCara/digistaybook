import { lifecycleLabels, modeLabels, type PropertyLifecycle, type PropertyMode } from "../../domain/property";

/**
 * Lifecycle and mode are the two facts a Host needs at a glance on a list of
 * properties, so they are rendered by one component rather than restated per
 * page. Both are server-owned; nothing here is editable. `lifecycle` is
 * optional: a page that is already about one property does not need to repeat
 * its lifecycle beside the title.
 */
export function StatePills({ lifecycle, mode, billingHref }: {
  lifecycle?: PropertyLifecycle;
  mode: PropertyMode;
  billingHref?: string;
}) {
  return (
    <p className="state-pills">
      {lifecycle ? (
        lifecycle === "trialing" && billingHref ? (
          <a className={`state-pill state-pill-link lifecycle-${lifecycle}`} href={billingHref}>
            {lifecycleLabels[lifecycle]}
          </a>
        ) : (
          <span className={`state-pill lifecycle-${lifecycle}`}>{lifecycleLabels[lifecycle] ?? lifecycle}</span>
        )
      ) : null}
      <span className={`state-pill mode-${mode}`}>{modeLabels[mode] ?? mode}</span>
    </p>
  );
}

/** Dates come back as ISO strings; a Host reads them as plain calendar dates. */
export function formatDate(iso: string | null): string {
  if (!iso) return "Not set";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
