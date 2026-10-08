import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const root = process.cwd();
const nas = String.raw`\\192.168.1.71\nas\projects\DigiStayBook\business-operations\DigiStayBook-review-pack.html`;
const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const original = fs.readFileSync(nas);
const expected = process.argv[2];
if (!expected || digest(original).toLowerCase() !== expected.toLowerCase()) throw new Error("NAS changed since inspection; preserve the new edits before retrying.");
let html = original.toString("utf8");
const row = /<tr><td>Decision<\/td>[\s\S]*?<\/tr>/g;
if ([...html.matchAll(row)].length !== 1) throw new Error("Expected exactly one decision row.");
const memory = "Clear content automatically appears on the wall if ‘Review content before publication’ is off.<br>Clear content waits for host review if that switch is on.<br>Less serious flags go to host review.<br>Serious text or photo flags go to restricted safety review.<br>Screening pending: keep unpublished until the check completes.";
const feedback = "Clear content and ordinary complaints are sent privately to the host.<br>Serious text flags go to restricted safety review before host delivery.<br>Screening pending: keep undelivered until the check completes.";
html = html.replace(row, `<tr><td>Decision</td><td>${memory}</td><td>${feedback}</td></tr>`);
html = html.replace("Publish to the public guestbook after all required checks pass", "Publish after all required checks pass if host review is off; otherwise wait for host approval");
html = html.replace("a serious text flag; the host cannot approve it", "a serious text or photo flag; the host cannot approve it");
html = html.replace("Version 2 aligns the memory and private-feedback screening labels and adds automatic restricted safety routing for serious memory text flags. These changes are in the local source; this update does not deploy them.", "The 5 October release adds the host review switch, automatic restricted safety routing for serious text/photos, and audited memory-case review controls. The release record below distinguishes deployment evidence from calibration and live guest journeys.");
html = html.replace("The 5 October screening changes are local source changes; deployment and live-flow proof remain required.", "The 5 October screening changes are deployed; calibration and live guest-flow proof remain required.");
html = html.replace("Review version 2", "Review version 3");
html = html.replace("135 Functions tests passed and Functions build passed.", "606 tests passed (1 skipped); typecheck, client build and Functions build passed.");
html = html.replace("These are local checks; provider calibration, deployment and live guest proof remain separate.", "These are local checks; the release record below confirms deployment. Provider calibration and live guest proof remain separate.");
html = html.replace("<h2>How to use this pack</h2>", "<p><strong>HTML release supplement:</strong> this HTML includes the 5 October deployment update. The companion PDF/ZIP and their source snapshots remain review version 2 until regenerated; use the release record below for the current routing and controls.</p><h2>How to use this pack</h2>");
html = html.replace(/<section id="screening-release-2026-10-05">[\s\S]*?<\/section>/, "");
const oldPolicy = "This update adds automatic safety routing for memory text only. Current photo flags still go to host review. Automatic serious-image routing remains an open decision requiring image examples and calibration. There is no automatic rejection. Clear private feedback and feedback flagged for the host both reach the private inbox; feedback has no publication approval step. Memory safety cases are recorded in the restricted queue, but the operations case-opening and resolution controls currently support private feedback only. Complete and test the memory-case review controls before opening intake.";
html = html.replace(oldPolicy, "Serious text and photo flags now open restricted safety cases. Operations with MFA can open and resolve memory cases, with audited message/photo access. Release sends an unchanged memory to host review; a changed message returns for fresh screening. Deletion hides the memory and queues both photo copies for removal. No automatic rejection occurs. Representative provider calibration and live journeys remain required.");
html = html.replace("Serious memory text flags now use the same restricted safety rules as feedback in local source. Complete the memory-case opening/resolution controls, which currently support private feedback only. Verify deployment, host approval denial, operations MFA and case access. Photo flags still use host review: define and calibrate serious-image routing before claiming comprehensive critical handling.", "Serious text/photos route to restricted safety review. Memory-case controls and host approval denial are tested locally and deployed. Verify production reviewer MFA/staffing and calibrate representative text/photos; do not claim comprehensive detection.");
html = html.replace("Local code now withholds feedback on provider failure.", "Deployed code now withholds feedback on provider failure.");
const record = fs.readFileSync(path.join(root, "docs/guest-screening-routing-2026-10-05.md"), "utf8");
const escaped = record.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const section = `<section id="screening-release-2026-10-05"><h2>5 October screening release: steps and evidence</h2><pre style="white-space:pre-wrap;font:inherit">${escaped}</pre></section>`;
html = html.replace("</body>", `${section}</body>`);
if (digest(fs.readFileSync(nas)) !== digest(original)) throw new Error("NAS changed during preparation; copy stopped.");
const backup = nas.replace(/\.html$/, `-before-release-${Date.now()}.html`);
fs.writeFileSync(backup, original, { flag: "wx" });
fs.writeFileSync(nas, html, "utf8");
const local = path.join(root, "docs/legal-review/reviewer-pack-2026-10-02/DigiStayBook-review-pack.html");
fs.writeFileSync(local, html, "utf8");
if (digest(fs.readFileSync(nas)) !== digest(fs.readFileSync(local))) throw new Error("NAS copy verification failed.");
// The older PDF/ZIP remain labelled version 2 until separately regenerated.
const pack = path.dirname(local), manifest = path.join(pack, "SHA256SUMS.txt");
if (fs.existsSync(manifest)) {
  const lines = fs.readFileSync(manifest, "utf8").split("\n").map(line => line.endsWith("  DigiStayBook-review-pack.html") ? `${digest(fs.readFileSync(local))}  DigiStayBook-review-pack.html` : line);
  fs.writeFileSync(manifest, lines.join("\n"), "utf8");
}
console.log(JSON.stringify({ nasUpdated: true, preservedOriginal: backup, sha256: digest(fs.readFileSync(nas)) }));
