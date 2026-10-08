import { readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const nas = String.raw`\\192.168.1.71\nas\projects\DigiStayBook\business-operations\DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html`;
const local = "docs/handbook/DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html";
const rows = JSON.parse(await readFile("docs/stored-data-inventory-2026-10-05.json", "utf8"));
const escape = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const sha = value => createHash("sha256").update(value).digest("hex");
if (rows.length !== 38 || rows.some(row => row.length !== 5 || row.some(cell => typeof cell !== "string" || !cell))) throw new Error("Incomplete inventory");
const section = `<!-- stored-data-inventory:start -->
        <section id="stored-data-inventory" aria-labelledby="stored-data-inventory-title">
          <h4 id="stored-data-inventory-title">Stored data, retention rules and current deletion setup</h4>
          <p><strong>Checked 5 October 2026 (Australia/Sydney).</strong> This single inventory combines the proposed retention schedule with the data stores found in current application source and the checked cloud configuration. Retention, cancellation, deletion and backup rules are proposed policy; the current-setup column records implementation and evidence. It distinguishes automatic deletion, partial cleanup, email reminders followed by manual deletion, and work not implemented or not verified. A deployed worker or configured expiry is not proof that every deletion deadline has been met.</p>
          <p><strong>Storage locations:</strong> all Firestore paths below are in the project's default database, <code>nam5</code>, a <a href="https://firebase.google.com/docs/firestore/locations">United States multi-region location</a>. The two guest-photo buckets are in Sydney; the default host-media bucket is <code>US-CENTRAL1</code>. These facts do not establish Australian storage for Authentication, logs, Stripe, email, browser copies or provider processing.</p>
          <p><strong>How to read the current-setup column:</strong> <em>Automatic configured/deployed</em> identifies a live control, with any proof limits stated. <em>Partial</em> means some content or state is handled but complete expiry/copy removal is missing. <em>Reminder + manual deletion</em> requires the operator to act. <em>Not implemented</em> means no corresponding process was found in inspected source/live configuration. <em>Not verified</em> means supplier or production evidence is still missing. A period marked <em>not specified</em> needs a decision; it must not be presented as an approved promise.</p>
          <p><strong>Scope and evidence:</strong> this covers the 38 application, supplier, recovery, client and supporting data categories identified below. It is not an exhaustive supplier/account audit. No production guest record contents, secret values or payment details were read to prepare it. Current source contains uncommitted work; source presence does not prove deployment, particularly for separate billing/email changes. Keep legal approval, source inspection, live configuration, emulator proof, real deletion completion and backup removal distinct.</p>
          <p id="stored-data-inventory-help">Scroll inside the table to read all rows and columns. You can also focus the table and use the arrow keys.</p>
          <div class="table-wrap stored-data-inventory-table" role="region" aria-label="Stored data inventory" aria-describedby="stored-data-inventory-help" tabindex="0">
            <table>
              <caption>Stored data, retention and deletion status — 5 October 2026</caption>
              <thead><tr><th scope="col">Data / what is stored</th><th scope="col">Where it is stored</th><th scope="col">Proposed retention and cancellation rules</th><th scope="col">Deletion method, proposed deadlines and backup expiry</th><th scope="col">Current setup and verification limits</th></tr></thead>
              <tbody>${rows.map(row => `<tr><th scope="row">${escape(row[0])}</th>${row.slice(1).map(cell => `<td>${escape(cell).replace(/\n/g, "<br>")}</td>`).join("")}</tr>`).join("\n")}</tbody>
            </table>
          </div>
          <p><strong>Immediate gaps to reconcile:</strong> property deletion currently marks state rather than purging the property and its descendants; private feedback/session/queue/review-metadata periods are not separately settled; no general draft/dormant/rejected-content/case/audit expiry exists; the report rate-limit document uses a 48-hour expiry although its cooldown is 24 hours; logs are configured for 30 and 400 days rather than one uniform draft period; and recovery/restore controls need their own proof.</p>
          <p><strong>Consent operation:</strong> the chosen process is automatic reminders and manual deletion. The hourly review checks up to 100 consent records and 100 existing review records per run using persistent cursors; larger sets are covered over multiple runs. At 9am Sydney it reassesses due entries and emits a notification only if some remain due. The email lists the first two exact paths/deadlines and links to the complete private review list. An operator checks the current eligibility and any external/unrecorded dispute or hold, deletes only the named consent record and rechecks its absence. Open linked reviews, recorded holds and unfinished photo removal block eligibility; missing evidence needs investigation. Reminder/recheck metadata itself has no agreed expiry yet. Inbox receipt and production manual/backup deletion are not confirmed.</p>
          <p><strong>Expiry is not instant physical deletion:</strong> the three active Firestore <a href="https://firebase.google.com/docs/firestore/ttl">TTL policies</a> apply only to <code>reportDuplicates</code>, <code>reportRateLimits</code> and <code>reportWallLimits</code>. TTL deletion is asynchronous, typically within 24 hours after expiry, without an exact-deadline guarantee. Seven-day bucket soft delete means a removed file can remain recoverable during that period. Neither a tombstone, a hidden wall, an expired restriction nor an absent active object establishes backup removal.</p>
          <p><strong>Evidence record:</strong> current source checked: guestContributions, propertyCreation, reporting, storageDeletion, consentRetention, screening/retry/budget/diagnostics, billing/webhook/cancellation, host auth/media/export/cache code, and Firestore/Storage rules. Filtered metadata is recorded in <code>storage-retention-live-evidence-2026-10-05.json</code> beside this NAS handbook; it includes database location/PITR, active TTL fields, bucket regions/recovery/lifecycle rules, log retention, backup schedules and enabled scheduler configuration. Artifact Registry cleanup was also inspected (30 days). Consent's photo-completion status was aligned with the worker's <code>complete</code> value and verified in the emulator before redeploying the two consent functions. Consent email receipt, provider retention, production deadlines and recovery operations remain independent checks.</p>
        </section>
<!-- stored-data-inventory:end -->`;
const style = `<!-- stored-data-inventory-style:start --><style>
  .stored-data-inventory-table { max-height: 75vh; overflow: auto; }
  .stored-data-inventory-table:focus-visible { outline: 3px solid #2b70a9; outline-offset: 2px; }
  .stored-data-inventory-table table { min-width: 1180px; table-layout: fixed; }
  .stored-data-inventory-table thead th { position: sticky; top: 0; z-index: 2; background: #e7eef7; }
  .stored-data-inventory-table th, .stored-data-inventory-table td { overflow-wrap: anywhere; }
  .stored-data-inventory-table thead th:nth-child(1) { width: 14%; }
  .stored-data-inventory-table thead th:nth-child(2) { width: 22%; }
  .stored-data-inventory-table thead th:nth-child(3) { width: 20%; }
  .stored-data-inventory-table thead th:nth-child(4) { width: 19%; }
  .stored-data-inventory-table thead th:nth-child(5) { width: 25%; }
  .stored-data-inventory-table tbody th { position: static; background: #f8fafc; font-weight: 700; }
  .stored-data-inventory-table caption { padding: 12px; text-align: left; font-weight: 700; }
  @media print { .stored-data-inventory-table { max-height: none; overflow: visible; } .stored-data-inventory-table table { min-width: 0; } .stored-data-inventory-table thead { display: table-header-group; } .stored-data-inventory-table thead th { position: static; } }
</style><!-- stored-data-inventory-style:end -->`;
const outdated = 'None of this schedule is implemented. There is no retention engine, no scheduled deletion job, no deletion manifest, no content-free audit event and no backup-expiry control. Every date in the table above is a commitment the product cannot currently keep, and several of them are stated to customers in the draft Privacy Policy.';
const current = 'The schedule is only partly implemented. Queued photo removal, three report-control TTL policies and consent reminders for manual deletion are configured/deployed; those controls do not establish a complete retention engine or proof of every production deadline. Draft/dormant expiry, remaining record/case/audit expiry, scoped hold governance and complete backup/restore controls remain outstanding. Use the combined inventory in this section before relying on a retention promise.';
function update(input) {
  let value = input.replace(outdated, current);
  value = value.replace('See the current stored-data inventory below before relying on a retention promise.', 'Use the combined inventory in this section before relying on a retention promise.');
  value = value.replace(/<!-- stored-data-inventory:start -->[\s\S]*?<!-- stored-data-inventory:end -->/, "");
  const boundary = value.indexOf('<h3 id="retention-deletion-backups">');
  const next = value.indexOf('<h3 id="privacy-security">', boundary);
  if (boundary < 0 || next < 0) throw new Error("Cannot locate retention section boundary");
  const prefix = value.slice(0, boundary);
  let retention = value.slice(boundary, next);
  retention = retention.replace(/<div class="table-wrap">\s*<table>[\s\S]*?<\/table>\s*<\/div>/, section);
  if (!retention.includes('id="stored-data-inventory"')) {
    retention = retention.replace('<p><strong>What deletion means.', section + '\n<p><strong>What deletion means.');
  }
  retention = retention.replace('5.10 Retention, deletion and backups', '5.10 Stored data, retention, deletion and backups');
  retention = retention.replace('The periods below are the recommended operational defaults.', 'The periods in the combined inventory below are proposed operational defaults pending approval.');
  value = prefix + retention + value.slice(next);
  value = value.replace(/\s*<li><a href="#stored-data-inventory">[^<]*<\/a><\/li>/, '');
  value = value.replace('5.10 Retention, deletion and backups</a>', '5.10 Stored data, retention, deletion and backups</a>');
  value = value.replaceAll('5.8, 5.10.1, 5.12', '5.8, 5.10, 5.12');
  value = value.replace(/<!-- stored-data-inventory-style:start -->[\s\S]*?<!-- stored-data-inventory-style:end -->/, "");
  value = value.replace('</head>', `${style}\n</head>`);
  value = value.replace(/<tr><td>A-05<\/td><td>5\.10<\/td>[\s\S]*?<\/tr>/, '<tr><td>A-05</td><td>5.10</td><td>Complete remaining retention schedules, record/case/audit expiry, scoped holds, deletion manifests and backup/restore controls. Queued media deletion, report-control TTLs and manual-consent reminders are already configured/deployed.</td><td>Verify each current control and remaining policy promise using the stored-data inventory; deployment is not production deadline or backup-removal proof.</td></tr>');
  if (value.includes(outdated)) throw new Error("Outdated blanket claim remains");
  if ((value.match(/id="stored-data-inventory"/g) ?? []).length !== 1 || (value.match(/href="#retention-deletion-backups"/g) ?? []).length < 1) throw new Error("Inventory navigation is missing/duplicated");
  return value;
}
const records = await Promise.all([nas, local].map(async path => ({path, before: await readFile(path,"utf8")})));
for (const record of records) record.after = update(record.before);
for (const record of records) if (sha(await readFile(record.path,"utf8")) !== sha(record.before)) throw new Error(`${record.path} changed during preparation`);
for (const record of records) {
  await copyFile(record.path, record.path.replace(/\.html$/, `-before-inventory-${Date.now()}.html`));
  await writeFile(record.path, record.after, "utf8");
  if (sha(await readFile(record.path,"utf8")) !== sha(record.after)) throw new Error("Saved content differs");
}
const evidence = await readFile("docs/storage-retention-live-evidence-2026-10-05.json");
await writeFile(String.raw`\\192.168.1.71\nas\projects\DigiStayBook\business-operations\storage-retention-live-evidence-2026-10-05.json`, evidence);
console.log(JSON.stringify({rows: rows.length, nasSha256: sha(records[0].after), localSha256: sha(records[1].after), preservedIndependentLocalEdits: true}));
