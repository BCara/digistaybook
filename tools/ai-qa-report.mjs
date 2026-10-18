import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
import {installAiTestView} from './ai-qa-joint-view.mjs';

const dir='artifacts/qa/2026-10-17', run='AI-20261017', date='2026-10-17';
const nasDir='//192.168.1.71/nas/projects/DigiStayBook/business-operations';
const evidenceDir='ai-testing-2026-10-17';
const files=['check.log','build.log','functions-build.log','rules.log','browser-observations.md','live-endpoints.json','verify-local-test.log','server-final-results.json','verify-consent-retention-retest.log','verify-public-wall-final.log','verify-guest-contribution-final.log','verify-guest-names-final.log','verify-storage-deletion-final.log','verify-reporting-final.log','verify-incomplete-screening-final.log','verify-screening-budget.log','verify-operations-notify.log','category-results.json','category-routing.log','exact-limits.log','limit-results.json','live-followup.md','live-property.jpg','live-owner-preview.jpg','live-closed-wall.jpg','live-draft-export.zip'];
for(const file of files) if(!fs.existsSync(`${dir}/${file}`)) throw Error(`Missing evidence ${file}`);
const final=JSON.parse(fs.readFileSync(`${dir}/server-final-results.json`));
if(final.length!==6||final.some(x=>x.exit!==0)) throw Error('Backend verification not complete');
if(!fs.readFileSync(`${dir}/rules.log`,'utf8').includes('35 passed')) throw Error('Rules evidence missing');
if(!fs.readFileSync(`${dir}/exact-limits.log`,'utf8').includes('PASS: actual backend')) throw Error('Limits not passed');
const steps=JSON.parse(fs.readFileSync(`${dir}/nas-steps.json`));
const result={run,date,timeZone:'Australia/Sydney',revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source:'Current working tree, including existing uncommitted changes; production is a separately observed release.',steps:{}};
const rec=(status,note,evidence,scope)=>({status,executed:!['blocked','na'].includes(status),date,scope:scope??'Local automated checks; no physical-device claim',note,evidence:Array.isArray(evidence)?evidence:[evidence]});
const groups={
 'TP-PUB-01':['partial','Public/pricing component tests passed. Live browser checks are recorded separately; local public pages were not all re-exercised.','check.log'],
 'TP-PROP-02':['partial','Demo component tests passed; the complete demo submission was exercised on the live public demo. Physical-phone layout remains outstanding.','check.log'],
 'TP-PUB-02':['partial','Privacy-request backend and public-page tests passed. Actual test-site browser request/confirmation was not performed.','verify-reporting-final.log'],
 'TP-ACC-01':['partial','Account UI/auth tests passed; browser-specific results are recorded per step below.','check.log'],
 'TP-ACC-02':['blocked','A real Google OAuth account journey was not available in the isolated emulator. Google sign-in mocks are not provider evidence.','check.log'],
 'TP-ACC-03':['partial','Reset UI/auth tests passed with mocked provider calls. Real inbox receipt, reset-link reuse and 61-minute expiry are unverified.','check.log'],
 'TP-ACC-08':['partial','Account/email-verification tests passed. No real verification email or complete unverified-account checkout was observed.','check.log'],
 'TP-ACC-05':['partial','Reauthentication and verify-before-email-change adapter/UI tests passed. Actual credential changes and email delivery remain unverified.','check.log'],
 'TP-PROP-01':['partial','Property/design/preview tests passed; browser-specific results below. Photo upload through the browser and anonymous preview remain separate.','check.log'],
 'TP-PROP-03':['partial','Property wizard/Billing tests passed, but the Billing suite explicitly expects plans to be offered with no welcome content. Empty-wall gate expectation needs reconciliation; exact empty-property browser journey not executed.','check.log'],
 'TP-PROP-04':['partial','Dashboard, property settings, owner-scoped store and billing-overview tests passed. The checklist’s four named lifecycle fixtures were not all exercised together in a browser.','check.log'],
 'TP-SEC-06':['partial','Real local API/rules owner-isolation checks and property/moderation/billing route tests passed. Exact cross-host browser URL sequence remains unverified.',['rules.log','verify-local-test.log','verify-guest-contribution-final.log']],
 'TP-BILL-01':['partial','Billing quotation, real-date presentation, acknowledgement and country/currency component tests passed. Browser activation was blocked by the explicit local payments-disabled message. No Stripe proof.',['check.log','browser-observations.md']],
 'TP-PROP-05':['blocked','Local Test explicitly disables payments. A configured Stripe test-mode checkout, declined/successful card journey and resulting subscription/webhook were unavailable.','browser-observations.md'],
 'TP-PROP-07':['blocked','No configured promotion code/Stripe checkout was exercised; local payments are disabled. A mocked offer test does not verify free live activation.','browser-observations.md'],
 'TP-BILL-03':['partial','Trial-eligibility and billing adapter tests passed; a real second-property Stripe payment and paid-date record were not exercised.','check.log'],
 'TP-QR-01':['partial','QR/address and QR-page tests passed and the draft QR screen was inspected. Actual print preview, A4 output, arm’s-length phone scan and rescan after rename were not exercised.',['check.log','browser-observations.md']],
 'TP-WALL-03':['partial','Public/in-stay availability tests and local API projection checks passed; public-off behavior is tested separately from stay access. The exact UI switch/private-window sequence and printed scan remain unverified.',['check.log','verify-public-wall-final.log']],
 'TP-GUEST-01':['partial','Local guest lifecycle/backend and text-only browser submission passed. The exact photo-plus-stopwatch/physical-network journey remains incomplete.',['browser-observations.md','verify-guest-contribution-final.log']],
 'TP-GUEST-02':['partial','Consent enforcement and guest-field component/API tests passed; browser observations below.',['check.log','browser-observations.md']],
 'TP-GUEST-03':['partial','Real backend validation/upload checks passed; form/device-specific wording, recovery, HEIC and orientation are separate.',['verify-guest-contribution-final.log','exact-limits.log','limit-results.json']],
 'TP-GUEST-04':['partial','Actual local API edit/rescreen/delete, stale revision and stranger-denial checks passed; UI adapter tests passed. This does not complete the two-physical-phone journey.',['verify-guest-contribution-final.log','check.log']],
 'TP-GUEST-05':['partial','Private feedback was exercised as a separate backend submission, excluded from walls/history, with safety hold/report/release/delete coverage. Complete phone/host-inbox UI journey remains outstanding.',['verify-guest-contribution-final.log','verify-local-test.log']],
 'TP-GUEST-06':['partial','Real backend request deduplication and client lost-response/request-ID reuse tests passed. Physical double tap, flight-mode interruption and visible retry were not exercised.',['verify-guest-contribution-final.log','check.log']],
 'TP-GUEST-07':['partial','Seeded local marker destinations, review-policy enforcement, contact rule and incomplete/restricted safety routes passed. Complete per-fixture guest-browser and operations handover remains incomplete.',['verify-local-test.log','verify-guest-contribution-final.log','verify-incomplete-screening-final.log','category-results.json']],
 'TP-GUEST-08':['pass','All 16 category inputs at 0.800, others 0.050, were evaluated by production verdict functions and persisted through injected memory/feedback processing. Four serious categories held both routes; ordinary categories held memories and delivered feedback. See exact step IDs, property/submission/revision/case IDs in JSON. This is isolated local routing, not Google classification.',['category-results.json','category-routing.log']],
 'TP-GUEST-09':['partial','Five complete SafeSearch signal maps at LIKELY and VERY_LIKELY were injected into production verdict/routing functions and persisted. Clear and UNKNOWN controls passed. This custom harness uses zero-photo records to isolate routing; it does not prove real photo-byte classification. Serious photo-byte access/release tests are separate.',['category-results.json','category-routing.log','verify-guest-contribution-final.log']],
 'TP-RPT-01':['partial','Actual API reporting, hiding, neutral acknowledgement, deduplication and host report listing passed. Exact two-device UI sequence remains unverified.','verify-reporting-final.log'],
 'TP-WALL-01':['partial','Wall order/pinning component tests and actual authenticated moderation API checks passed. Exact named-fixture browser pin/unpin sequence remains unverified.',['check.log','verify-public-wall-final.log']],
 'TP-SCR-03':['partial','Actual local APIs verified owner-only review preference, clear-content holds, unchanged existing holds when disabling review, approval and private photo denial. Outbox creation is distinct from inbox delivery. Exact browser/device coverage remains incomplete.',['verify-guest-contribution-final.log','verify-public-wall-final.log']],
 'TP-SCR-06':['partial','Actual local case/photo access with synthetic MFA claims, audit, unchanged/changed revision release, feedback delivery/deletion, withdrawal and post-resolution denial passed. Real Firebase MFA sign-in and full browser actions remain separate.',['verify-guest-contribution-final.log','verify-reporting-final.log']],
 'TP-SCR-07':['partial','Local APIs verified published-photo delivery, hide/delete denial, private no-store responses, edit/rescreen/stale revision and open-report/safety publication guards. Not every mid-read concurrency variant was injected; full browser views remain incomplete.',['verify-guest-contribution-final.log','verify-public-wall-final.log','rules.log']],
 'TP-SCR-08':['blocked','Requires independently owner/reviewer-labelled approved calibration fixtures, real Google results, agreed sample/acceptance criteria and real Android/iPhone journeys. Isolated routing evidence cannot satisfy this live procedure.','category-results.json'],
 'TP-MOD-08':['partial','Moderation component tests and real local API hide/publish/delete/report/restricted guards passed. Exact named-fixture UI journey/wording remains unverified.',['check.log','verify-public-wall-final.log','verify-guest-contribution-final.log']],
 'TP-RPT-02':['partial','Actual local report dismissal/removal, multi-report restoration guard, ownership and deletion scheduling passed. Exact host browser actions remain unverified.','verify-reporting-final.log'],
 'TP-DASH-01':['partial','Dashboard, property nav, moderation, export and billing/account component tests passed; browser inspected overview, wall editor/phone preview, QR controls and billing-disabled message. Each requested capability still needs its own observed result.',['check.log','browser-observations.md']],
 'TP-EXP-01':['partial','Local API export source returned actual photo bytes and excluded restricted/deleted/private-feedback records. ZIP/HTML escaping adapter tests passed. No complete downloaded ZIP was opened offline in this browser run.',['verify-public-wall-final.log','check.log']],
 'TP-BILL-07':['partial','Billing/grace UI/domain tests passed with controlled fixture data. Actual payment failure, provider state and grace-property phone contribution were not exercised.','check.log'],
 'TP-BILL-08':['partial','Offline-wall and billing component tests passed; API availability gates were exercised. No physical phone recovery/payment journey was performed.',['check.log','verify-public-wall-final.log']],
 'TP-BILL-10':['partial','Cancellation/restore/trial state and dates passed in component/domain/server-adapter tests with mocked Stripe. Local payments are disabled; no provider subscription or future charge was verified.','check.log'],
 'TP-EM-00':['blocked','Local Test disables real email. No actual test-inbox messages, subjects, links or receipt timing were read in this run. Notification logs/outbox entries are not inbox proof.','browser-observations.md'],
 'TP-MOB-01':['blocked','Requires a physical phone sign-in, touch/save and every-page fit check. Desktop browser and component tests do not fulfil the phone steps.','browser-observations.md'],
 'TP-A11Y-03':['partial','Semantic UI/component and mobile-audit tests passed. Complete keyboard-only sign-in/dashboard/submission/moderation, focus order and 200% zoom journeys were not executed.','check.log'],
 'TP-A11Y-02':['partial','Observed Draft/Private and Published/Pending text labels in browser; component tests cover other UI states. Every named billing/upload/moderation state and icon-only action was not inspected.',['browser-observations.md','check.log']],
 'TP-SEC-03':['partial','No staff link observed in inspected home/dashboard/guest navigation; route/reviewer tests and real local ordinary-host API denial passed. See separately observed live signed-out denial.',['browser-observations.md','verify-local-test.log','rules.log']],
 'TP-OPS-01':['blocked','This procedure is labelled Live. No signed-in dedicated live test-host session/property pair was established. Local owner-isolation evidence exists but does not complete live testing.',['rules.log','verify-local-test.log']],
 'TP-OPS-02':['blocked','This procedure requires live quarantine/public object URLs, live host exports and observed withdrawal. Local photo/privacy/API checks passed but are not live proof.',['verify-guest-contribution-final.log','verify-public-wall-final.log']],
 'TP-OPS-03':['blocked','This Live procedure requires a scoped live failure plus authorised MFA reviewer and matched submissions/cases. Injected local failures/retries/releases passed separately.','verify-incomplete-screening-final.log'],
 'TP-OPS-04':['blocked','Live owner-approved fixtures, real provider results and an authorised Firebase-MFA reviewer session are required. Local routing/case guards passed separately.',['category-results.json','verify-guest-contribution-final.log']],
 'TP-OPS-05':['blocked','Requires real Android/iPhone guest, camera-roll/HEIC and weak/interrupted-network journeys. Desktop-local and API evidence does not fulfil the required devices.','browser-observations.md'],
 'TP-OPS-06':['blocked','Requires disposable dedicated live records and verification of actual live bucket objects, audit/retention and any recoverable copies. Only actual emulator-file removal was verified.','verify-storage-deletion-final.log'],
 'TP-OPS-07':['blocked','Requires the owner’s scoped 50c Stripe test configuration, checkout and payment/cancellation evidence. No agreed live configuration/session was available; no charge or cancellation was attempted.','browser-observations.md'],
 'TP-OPS-08':['blocked','Requires live Firebase configuration/reviewer account, authenticator enrolment/sign-in and queue/action/device/recovery evidence. Prior register entries remain historical; they were not treated as current passes.',['check.log','live-endpoints.json']],
 'TP-OPS-09':['partial','Per-category local routing results include originating step, route, property, submission, revision and case references. Serious/incomplete/ordinary routes passed in isolated processing. Complete guest-device/operations-UI pairing and real provider classifications remain outstanding.',['category-results.json','verify-incomplete-screening-final.log','verify-guest-contribution-final.log']],
};
for(const step of steps) {
  const group=groups[step.test]; if(!group) throw Error(`Unreviewed procedure ${step.test}`);
  const local=rec(...group);
  const live=rec('blocked','This exact live journey was not completed. A dedicated ordinary host and private draft were created in the follow-up, but active/paid property fixtures, another host, authorised MFA reviewer, real calibration fixtures, physical devices or other requirements for this step remain unavailable. Read the procedure prerequisites and follow-up evidence. Local checks do not prove this live step.',['browser-observations.md','live-followup.md'],'Live site — required journey not executed');
  if(step.env==='pre') {live.status='na';live.note='This procedure is restricted to the Test site. No production mutation was performed for this step.';live.scope='Live site — out of this procedure’s test-site scope';}
  if(step.env==='live') {local.status='na';local.executed=false;local.note='This procedure specifically requires Live site proof. Supplemental local evidence is linked, but this step is outside the Local Test run. '+local.note;local.scope='Local Test — live-only procedure';}
  if(step.action.includes('Not built yet') && !['TP-ACC-05','TP-ACC-08'].includes(step.test)) {
    local.status='blocked';local.executed=false;local.note='The checklist marks this capability Not built yet. It cannot be checked off as passed. '+local.note;
  }
  result.steps[step.id]={test:step.test,action:step.action,expected:step.expected,local,live};
}
function set(ids,env,status,note,evidence,scope) {
  for(const id of ids.split(/\s+/)) {
    if(!result.steps[id]) throw Error(`Unknown step ${id}`);
    result.steps[id][env]=rec(status,note,evidence,scope??(env==='live'?'Live desktop browser / public signed-out pages':'Local desktop browser'));
  }
}
const browser='browser-observations.md';
set('TP-PUB-01-S01 TP-PUB-01-S02 TP-PUB-01-S03 TP-PUB-01-S04 TP-PUB-01-S05 TP-PUB-01-S06','live','pass','Read live home/pricing and exercised AUD → USD → AUD. AUD A$15/month, A$150/year; USD US$10/month, US$100/year. Shared features/28-day first-property trial, exact tax text and cancellation wording observed; no guaranteed performance claims.',browser);
set('TP-PROP-02-S01 TP-PROP-02-S02 TP-PROP-02-S03','live','pass','Followed home/public demo → stay demo; observed DEMO, host information/essentials/memories and completed a demo message with explicit nothing-sent confirmation.',browser);
set('TP-PROP-02-S04','live','partial','Footer text and home-link destination were observed. Did not click that link or measure visual overlay/position on a physical phone.',browser);
set('TP-PUB-02-S01 TP-PUB-02-S02 TP-PUB-02-S04','live','pass','Opened public form signed out; observed request types, details/email fields and booking-support boundary. Terms draft-2026-08-04 and Privacy draft-2026-10-06 both opened signed out.',browser);
set('TP-ACC-01-S01 TP-ACC-01-S02','live','pass','Live create-account form has optional name, email, password, confirm password, Google button and At least 8 characters text. No account was created.',browser);
set('TP-ACC-01-S01 TP-ACC-01-S02 TP-ACC-01-S05 TP-ACC-01-S06 TP-ACC-01-S07 TP-ACC-01-S08','local','pass','In the isolated browser: inspected form/help; rejected seven-character and mismatched passwords; created a synthetic local host; observed empty dashboard; signed out and back in.',browser);
set('TP-ACC-01-S03 TP-ACC-01-S04','local','blocked','Observed missing marketing checkbox and no Terms/Privacy links next to Create account. These are explicitly labelled Not built yet in the checklist; required capability remains unavailable.',browser);
set('TP-ACC-01-S03 TP-ACC-01-S04','live','blocked','Live form also lacks the requested marketing checkbox and adjacent Terms/Privacy links. Checklist explicitly marks these Not built yet.',browser,'Live browser — capability unavailable');
set('TP-ACC-03-S02 TP-ACC-03-S03 TP-ACC-03-S04','local','blocked','No inbox/reset link or real elapsed 61-minute expiry journey was available. Mocked adapter tests cannot verify provider token reuse/expiry.','check.log');
set('TP-PROP-01-S01 TP-PROP-01-S02','local','pass','Created synthetic property VJm2cE5S2ias8JX0jKjx through all three setup screens with arrival note, Wi-Fi and host note. Dashboard showed Draft/Private; no payment requested.',browser);
set('TP-PROP-01-S04','local','partial','Exercised every current theme: Warm Linen, Editorial, Playful, Journal. Preview and colours changed with text preserved; returned to Warm Linen. Five named legacy choices do not exist, so checklist/theme expectation needs review.',browser);
set('TP-PROP-01-S06','local','pass','Draft QR page explicitly shows Printing is locked / Printing unlocks with an active trial or subscription.',browser);
set('TP-PROP-03-S02','local','partial','The current Billing component test intentionally offers plans without welcome content. This contradicts the checklist’s empty-wall prerequisite; reconcile the product decision before calling the gate passed. Exact empty-property UI flow remains unexecuted.','check.log');
set('TP-QR-01-S02 TP-QR-01-S03','local','blocked','Requires actual A4 paper output and a physical-phone camera scan at arm’s length. No such evidence was collected.',browser);
set('TP-GUEST-01-S01 TP-GUEST-01-S02 TP-GUEST-01-S05 TP-GUEST-01-S06','local','pass','Opened seeded Test Cottage stay link on desktop, observed host information/essentials/prompt, submitted exact clear text and observed Published both on wall and browser history. Closed tab, reopened same stay link and confirmed the same Published memory.',browser);
set('TP-GUEST-01-S03','local','partial','Exact text control A lovely stay; thank you published with consent and host review off. Browser run had no photo; actual photo APIs passed separately. This does not complete the requested photo-progress journey.',[browser,'verify-guest-contribution-final.log']);
set('TP-GUEST-01-S04 TP-GUEST-01-S07','local','blocked','No complete photo-journey stopwatch measurement or physical weak-signal/mobile-data run was collected. Loopback desktop behavior cannot establish those results.',browser);
set('TP-GUEST-02-S01 TP-GUEST-02-S04','local','pass','Unchecked consent blocked submission with exact required message. Form requested no email or phone; name was optional.',browser);
set('TP-GUEST-02-S02','local','partial','Current wording: I agree to the Guest Terms and Privacy Policy, understand that photos undergo automated safety checks, consent to my message and any photos being displayed publicly on this property’s guestbook, and confirm I am 16 or older. Recorded verbatim difference from checklist; wording reconciliation required.',browser);
set('TP-GUEST-03-S01','local','fail','Before file selection, the form displays only Up to 10 photos. It omits the required upfront formats, 5 MiB/file, 25 MiB total, 40 MP and 1,200-character limits. Backend enforcement passed separately.',[browser,'exact-limits.log']);
set('TP-GUEST-03-S07 TP-GUEST-03-S08','local','blocked','Requires separate physical Android/iPhone camera-roll, Files/HEIC selection and orientation observations. No device-specific selection was performed.',browser);
set('TP-GUEST-03-S09 TP-GUEST-03-S10 TP-GUEST-03-S11 TP-GUEST-03-S12 TP-GUEST-03-S13 TP-GUEST-03-S14','local','partial','Exercised actual backend boundary payloads: 1,199/1,200 accepted and 1,201 rejected for memory/feedback; exactly 5 MiB accepted and +1 byte rejected; exactly 25 MiB accumulated and extra JPEG rejected; 40,000,000 pixels accepted and 40,005,000 rejected. Physical-phone form/draft recovery/orientation and every publication/UI text-integrity check remain incomplete.',['exact-limits.log','limit-results.json'],'Local emulator API with generated exact-size fixtures');
set('TP-GUEST-09-S07','local','partial','Incomplete provider-response/parser tests and actual injected local incomplete-scan case/retry/release checks passed. Exact photo-invalid-field guest-browser-to-operations case pairing was not completed.',['check.log','verify-incomplete-screening-final.log']);
set('TP-SCR-03-S07','local','partial','Actual ordinary-hold notification outbox creation was asserted. Real test-host email receipt was not verified; outbox evidence does not establish delivery.','verify-guest-contribution-final.log');
set('TP-DASH-01-S01 TP-DASH-01-S02 TP-DASH-01-S06','local','pass','Inspected created Draft/Private property and next action, QR screen with locked-print reason/guest links, and editor with current themes, writing-prompt selector and phone preview.',browser);
set('TP-SEC-03-S01','local','pass','Inspected local dashboard/property and guest navigation. No staff/operations/admin link was present.',browser);
set('TP-SEC-03-S03','live','pass','Opening live /operations while signed out redirected to sign-in and exposed no queue. Live listSafetyOperations, readSafetyCase and listHostGuestReview all returned HTTP 401.',[browser,'live-endpoints.json']);
set('TP-OPS-08-S07','live','partial','Signed-out operations browser gate and live queue/case/host-review endpoints denied access (HTTP 401). Ordinary-host and authorised-without-completed-MFA live sessions were not exercised.',['live-endpoints.json',browser],'Live read-only negative access checks');
set('TP-OPS-09-S04 TP-OPS-09-S07','local','partial','All text/category routing lines have originating step IDs, property/submission/revision/case references and explicit isolated-fixture scope in category-results.json. Paired physical-device/real-provider runs remain blocked. Shared NAS results record includes every step’s current AI outcome.',['category-results.json','report.json']);

// Authorised live test account and relevant Gmail follow-up. Preserve initial failures.
const follow='live-followup.md', liveScope='Live desktop browser / dedicated ordinary test host';
const liveSet=(ids,status,note,evidence=follow)=>set(ids,'live',status,note,evidence,liveScope);
liveSet('TP-ACC-01-S01 TP-ACC-01-S02','pass','Live signup form and 8-character hint observed. Dedicated alias account was then attempted; see S07 for its failed signup journey.');
liveSet('TP-ACC-01-S05','pass','Seven-character password refused: Choose a password of at least 8 characters.');
liveSet('TP-ACC-01-S06','pass','Mismatched passwords refused: Both passwords need to match.');
liveSet('TP-ACC-01-S07','fail','Valid signup reported an authentication network error, but retry said account already exists. Subsequent sign-in recovered the account and empty dashboard. Recovery does not satisfy the expected direct signup-to-dashboard journey; name was blank. Root cause unconfirmed.');
liveSet('TP-ACC-01-S08','pass','Explicit sign-out returned home; signing in with the same email/password restored the dashboard and persisted draft.');
liveSet('TP-ACC-03-S01 TP-EM-00-S01','pass','Forgot your password? showed the neutral acknowledgement. Gmail Inbox receipt within five minutes: Reset your password for DigiStayBook, from noreply@digistaybook-cbert.firebaseapp.com to the dedicated alias, 17 October 10:52 AM Sydney.');
liveSet('TP-ACC-03-S02','blocked','Reset email received. Actual password entry/change requires the user to complete the browser flow; no credential change performed.');
liveSet('TP-ACC-03-S03','blocked','Used-link rejection depends on completing a password reset; reset was not completed.');
liveSet('TP-ACC-03-S04','blocked','No separate reset link was aged for 61 minutes and tested.');
liveSet('TP-ACC-03-S05','pass','nobody@example.com returned exactly the same Check your inbox / If that address belongs to a host account acknowledgement as the real test alias.');
result.steps['TP-ACC-05-S01'].live.note='Test-site-only procedure. Supplemental live check: Account settings exposes password and verify-before-email-change controls. See live-followup.md.';
for(const id of ['TP-ACC-05-S02','TP-ACC-05-S03']) result.steps[id].live.note='Test-site-only procedure. Supplemental live controls inspected; no credential change submitted. Actual password/email changes require user browser handoff. See live-followup.md.';
// These procedures are Test-site-only: retain N/A for Live, adding supplemental observations.
result.steps['TP-ACC-08-S01'].live.note='Test-site-only procedure. Supplemental live check: no automatic signup message found; manual verification request delivered to Gmail and its action succeeded. This does not clear the Test-site procedure. See live-followup.md.';
result.steps['TP-ACC-08-S02'].live.note='Test-site-only procedure. Supplemental live check reached plan selection while unverified without an email warning; stopped before subscription acknowledgement. A later checkout gate was not tested. See live-followup.md.';
liveSet('TP-PROP-01-S01 TP-PROP-01-S02','pass','Three-step wizard created AI QA Cottage 2026-10-17 with synthetic arrival note and Wi-Fi guidance, no payment prompt. Dashboard shows DRAFT / PRIVATE; reopening preserved content.');
liveSet('TP-PROP-01-S03','partial','Cover PNG and host JPEG project-logo fixtures each showed Uploading then rendered in editor/phone preview without payment. Not actual personal photographs, camera-roll or orientation proof.',['live-followup.md','live-owner-preview.jpg']);
liveSet('TP-PROP-01-S04','partial','All four current themes (Warm Linen, Editorial, Playful, Journal) changed the preview while retaining words/images, with no paywall. Returned to Warm Linen. Five legacy checklist names require reconciliation.');
liveSet('TP-PROP-01-S05','blocked','Mosaic/Spotlight layout controls absent; checklist labels this Not built yet.');
liveSet('TP-PROP-01-S06','pass','QR page explicitly shows Printing is locked / Printing unlocks with an active trial or subscription.');
liveSet('TP-PROP-01-S07','pass','Owner guest-wall preview shows PREVIEW / Not published yet / Only you can see this. Guests get a closed notice.',['live-followup.md','live-owner-preview.jpg']);
liveSet('TP-PROP-01-S08','partial','After explicit sign-out and reload, the exact guest link shows This guestbook isn’t open to visitors and no private content. Separate private-window process was not available.',['live-followup.md','live-closed-wall.jpg']);
liveSet('TP-BILL-01-S01','partial','Publish defaults to Billed in Australia. Not right? reveals Where will you be billed? and Australia selected; country selector exists but is not automatically the initial question.');
liveSet('TP-BILL-01-S02 TP-BILL-01-S03','pass','Monthly is A$15.00; disclosure and unchecked acknowledgement show charge on 14 November 2026, matching public pricing and the 28-day trial.');
liveSet('TP-BILL-01-S04','partial','Start free trial remained disabled while acknowledgement was unchecked. No activation click/commitment was made; disabled control prevents continuation.');
liveSet('TP-BILL-01-S05','pass','Annual disclosure and unchecked acknowledgement show A$150.00 on 14 November 2026, annual automatic renewal and cancellation wording.');
liveSet('TP-BILL-01-S06','fail','Full visible property billing page, including annual disclosure, contains no GST/tax-inclusion statement. Separate public-pricing tax text does not satisfy this page check.');
liveSet('TP-BILL-01-S07','pass','Back to the property returned to the unchanged private draft. No Stripe checkout, payment method or charge was initiated.');
liveSet('TP-DASH-01-S01','pass','Dashboard shows the sole test property as DRAFT PRIVATE, one draft / zero live, and Publish/Manage next steps.');
liveSet('TP-DASH-01-S02','partial','Guest-link copy control and QR artwork present. Print is correctly locked for this draft; activated print workflow remains untested.');
liveSet('TP-DASH-01-S03','blocked','No Download QR or Email QR controls observed; marked Not built yet.');
liveSet('TP-DASH-01-S04','partial','Moderation opened with Memories 0 and All caught up / no reports needing attention. Populated live memory/report fixtures unavailable on the draft.');
liveSet('TP-DASH-01-S05','pass','Separate Private feedback tab opened, says Replies aren’t supported, No feedback yet, with no reply button.');
liveSet('TP-DASH-01-S06','pass','Design page shows theme selector, suggested/custom Writing prompt choices and phone preview.');
liveSet('TP-DASH-01-S07','partial','Billing offers draft activation plans. No active subscription exists to inspect cancellation/next-payment controls.');
liveSet('TP-DASH-01-S08','blocked','No paid invoices/card history available for the draft; checklist labels capability Not built yet.');
liveSet('TP-DASH-01-S09','pass','Export control downloaded ZIP part 1 with zero memories. ZIP CRC valid; messages.json, README.txt and property-named index.html present.',['live-followup.md','live-draft-export.zip']);
liveSet('TP-DASH-01-S10','partial','Password change exists in Account settings; no sign-out-of-other-devices control observed.');
result.steps['TP-EXP-01-S01'].live.note='Test-site-only populated Seaside Cottage procedure. Supplemental live empty-draft ZIP downloaded and inspected, with correct property and HTML/JSON structure; does not complete this fixture-specific procedure. See live-followup.md and live-draft-export.zip.';
liveSet('TP-EM-00-S02','blocked','No account-ready message arrived; checklist explicitly labels that email Not built yet. Manual verification and password-reset emails did arrive.');
liveSet('TP-EM-00-S07','partial','Read verification and reset messages: correct product/account, one action URL and no advertising. Verification action worked. Reset action was not completed; emails use a plain URL rather than a styled button.');
liveSet('TP-SEC-03-S02','pass','Signed-in ordinary test host opening /operations sees Safety Review access / An authorised reviewer account is required, with no queues/data.');
liveSet('TP-OPS-08-S07','partial','Signed-out live endpoints returned 401 and browser required sign-in. Ordinary test host is denied by reviewer gate. Authorised-but-incomplete-MFA session remains untested.');

const count=env=>Object.values(result.steps).reduce((a,r)=>(a[r[env].status]++,a),{pass:0,fail:0,partial:0,blocked:0,na:0});
result.counts={local:count('local'),live:count('live')};
result.gates={typecheck:'passed',appBuild:'passed',functionsBuild:'passed',unitTests:{passed:719,failed:1,skipped:1},rulesTests:{passed:35},serverChecks:final,categoryRoutes:44};
result.findings=[
 {id:'AI-F01',status:'fail',step:'TP-GUEST-03-S01',text:'Required upfront upload/text-limit information is absent; server boundary enforcement passes.'},
 {id:'AI-F02',status:'needs review',step:'TP-PROP-01-S04',text:'Five legacy theme names in checklist differ from the four current themes; all current theme changes worked.'},
 {id:'AI-F03',status:'needs review',step:'TP-GUEST-02-S02',text:'Consent quote differs from current wording; actual wording recorded.'},
 {id:'AI-F04',status:'failed automated gate',step:'Automated suite',text:'src/domain/publicWall.test.ts expects hostNotes from the default public projection. Current publicWall implementation includes hostNotes only for stay view. Assertion failed (expected one note, received none); reconcile intended view and test expectation before clearing gate.'},
 {id:'AI-F05',status:'needs review',step:'TP-PROP-03-S02',text:'Checklist expects an empty-wall content gate; current Billing test deliberately offers plans without welcome content. Product/checklist decision requires reconciliation.'},
 {id:'AI-F06',status:'fail',step:'TP-ACC-01-S07',text:'Live valid signup reported failure after creating the identity; retry said account exists. Sign-in recovered the account, but the direct signup journey failed and the supplied display name was blank. Root cause unconfirmed.'},
 {id:'AI-F07',status:'fail',step:'TP-BILL-01-S06',text:'Live property billing page has no visible GST/tax-inclusion disclosure. Public-pricing disclosure exists separately.'},
 {id:'AI-F08',status:'needs review',step:'TP-ACC-08-S01',text:'Supplemental live check: signup did not send a verification email automatically. Manual Account request delivered to Gmail and verification worked. Test-site-only checklist gate remains separate.'}
];
fs.writeFileSync(`${dir}/report.json`,JSON.stringify(result,null,2));
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const labels={pass:'Pass',fail:'Fail',partial:'Partial — needs review',blocked:'Blocked / not completed',na:'Not applicable to this environment'};
const link=f=>`${evidenceDir}/${encodeURIComponent(f)}`;
const render=(record,env,id)=>`<div class="ai-env-${env} ai-step-record" data-ai-environment="${env}" data-ai-status="${record.status}"><label class="ai-tested"><input type="checkbox" disabled${record.executed?' checked':''}> ${record.executed?'Tested with AI':'AI reviewed — not completed'}</label><strong class="ai-outcome ai-${record.status}">${labels[record.status]}</strong><span class="ai-date">${record.executed?'Tested':'Reviewed'} ${date} · ${esc(record.scope)}</span><p>${esc(record.note)}</p><details class="ai-evidence"><summary>AI evidence</summary>${record.evidence.map(f=>`<a href="${link(f)}">${esc(f)}</a>`).join(' · ')}<p>Run ${run} · ${id}</p></details></div>`;
function enhance(html) {
  const dom=new JSDOM(html), doc=dom.window.document;
  if(doc.getElementById('ai-run-summary')) throw Error('AI run already installed; preserve and explicitly update rather than duplicating');
  const style=doc.createElement('style');style.id='ai-run-styles';style.textContent=`.ai-step-record{border-top:1px solid #c9c1b5;margin-top:12px;padding-top:10px;min-width:230px}.ai-tested{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:650}.ai-outcome{display:block;margin:5px 0}.ai-pass{color:#22633f}.ai-fail{color:#a32929}.ai-partial{color:#775514}.ai-blocked{color:#555}.ai-date{display:block;font-size:11px;color:#555}.ai-step-record p{font-size:12px;line-height:1.45;margin:6px 0}.ai-evidence summary{cursor:pointer;font-size:12px}.ai-evidence a{font-size:11px;overflow-wrap:anywhere}html[data-test-environment=local] .ai-env-live,html[data-test-environment=live] .ai-env-local{display:none}#ai-run-summary{border:2px solid #b4472a;background:#fff9ee;padding:18px;margin:20px 0}#ai-run-summary h2{font-size:22px;margin:0 0 8px}.ai-summary-counts{font-weight:700}.ai-register-status{font-weight:bold}@media print{.ai-evidence{display:block}.ai-step-record{break-inside:avoid}}`;
  doc.head.append(style);
  const summary=doc.createElement('section');summary.id='ai-run-summary';
  summary.innerHTML=`<h2>AI testing record · 17 October 2026</h2><p>Every NAS step has an AI assessment below. A checked <strong>Tested with AI</strong> box means work was executed in the stated scope; read its Pass, Fail or Partial result. Blocked checks remain unchecked. Local and Live are separate; use the existing environment selector. These records are saved inside this HTML on the NAS and travel with it. Human Mobile/Desktop results and dates keep their existing meaning.</p>${['local','live'].map(env=>`<div class="ai-env-${env}"><p class="ai-summary-counts">${env==='local'?'Local':'Live'}: ${result.counts[env].pass} pass · ${result.counts[env].fail} fail · ${result.counts[env].partial} partial · ${result.counts[env].blocked} blocked / not completed · ${result.counts[env].na} outside this environment (${steps.length} NAS steps)</p></div>`).join('')}<p>Typecheck and both builds passed. Automated suite: 719 passed, 1 failed, 1 skipped. Security rules: 35 passed. Six final backend suites, consent retention, screening budget and notification checks passed. Category routing: 44 isolated cases. Physical-device journeys, real Google classification/calibration, live authenticated reviewer journeys and payments remain outstanding. A dedicated live ordinary host and private draft were created. Verification and password-reset emails reached the Zablantools Gmail inbox; the verification link worked. Password changes require user handoff.</p><p><a href="${link('report.json')}">All per-step results (JSON)</a> · <a href="${link('browser-observations.md')}">Browser observations</a> · <a href="${link('live-followup.md')}">Live account and inbox follow-up</a> · <a href="#shared-test-register">Shared results register</a></p><details open><summary>Faults and expectations needing review</summary><ul>${result.findings.map(f=>`<li><strong>${esc(f.id)} · ${esc(f.status)}</strong> — ${f.step.startsWith('TP-')?`<a href="#${f.step}">${f.step}</a>`:esc(f.step)}: ${esc(f.text)}</li>`).join('')}</ul></details><p>Partial does not count as a passed procedure. AI results are separate from the existing human progress totals. Evidence is a sibling folder named ${evidenceDir}. Prior shared-register entries are retained as history.</p>`;
  const anchor=doc.getElementById('index');if(!anchor) throw Error('Missing document index');anchor.before(summary);
  for(const row of doc.querySelectorAll('tr[data-step-id]')) {
    const entry=result.steps[row.dataset.stepId];if(!entry) throw Error(`No assessment ${row.dataset.stepId}`);
    const cell=row.querySelector('.step-evidence-cell'); if(!cell) throw Error('Missing evidence cell');
    cell.insertAdjacentHTML('beforeend',render(entry.local,'local',row.dataset.stepId)+render(entry.live,'live',row.dataset.stepId));
  }
  const shared=doc.querySelector('#shared-test-results tbody');if(!shared) throw Error('Missing shared register');
  for(const test of doc.querySelectorAll('details.test')) {
    const included=[...test.querySelectorAll('tr[data-step-id]')].map(row=>row.dataset.stepId), tr=doc.createElement('tr');tr.dataset.run=run;
    const stats=env=>{const c={pass:0,fail:0,partial:0,blocked:0,na:0};for(const id of included)c[result.steps[id][env].status]++;return `${env}: ${c.pass} pass, ${c.fail} fail, ${c.partial} partial, ${c.blocked} blocked, ${c.na} not applicable`;};
    const faults=result.findings.filter(f=>f.step.startsWith(test.id));
    tr.innerHTML=`<td>${run} / ${date} / AI</td><td>Local automated + desktop browser; Live public and dedicated ordinary-host browser/API; relevant Gmail receipt verified. Physical mobile pending.</td><td><a href="#${test.id}">${test.id}</a><br>${included.length} steps</td><td class="ai-register-status">${stats('local')}<br>${stats('live')}</td><td>Each step’s expected result above</td><td>${faults.length?faults.map(f=>esc(f.id+': '+f.text)).join('<br>'):'Read each step’s permanent AI result for executed scope and outstanding requirements.'}</td><td><a href="${link('report.json')}">Per-step evidence register</a></td><td>Owner / engineering / device tester: complete blocked and partial scopes; resolve recorded faults.</td><td>Current run; no future retest implied.</td>`;
    shared.append(tr);
  }
  const embedded=doc.createElement('script');embedded.type='application/json';embedded.id='ai-run-results';embedded.textContent=JSON.stringify(result).replaceAll('<','\\u003c');doc.body.append(embedded);
  installAiTestView(doc);
  return dom.serialize();
}

fs.mkdirSync(`${nasDir}/${evidenceDir}`,{recursive:true});
for(const file of files.concat('report.json')) fs.copyFileSync(`${dir}/${file}`,`${nasDir}/${evidenceDir}/${file}`);
for(const [name,target] of [['nas',`${nasDir}/DIGISTAYBOOK_TEST_PROCEDURES.html`],['local','docs/handbook/DIGISTAYBOOK_TEST_PROCEDURES.html']]) {
  const before=fs.readFileSync(`${dir}/${name}-before.html`,'utf8');
  if(fs.readFileSync(target,'utf8')!==before && fs.readFileSync(target,'utf8')!==fs.readFileSync(`${dir}/${name}-after.html`,'utf8')) throw Error(`${name} changed since snapshot; refusing to overwrite another edit`);
  const enhanced=enhance(before);fs.writeFileSync(`${dir}/${name}-after.html`,enhanced);
  if(name==='nas' && !fs.existsSync(`${nasDir}/${evidenceDir}/DIGISTAYBOOK_TEST_PROCEDURES.before.html`)) fs.copyFileSync(target,`${nasDir}/${evidenceDir}/DIGISTAYBOOK_TEST_PROCEDURES.before.html`);
  fs.writeFileSync(target,enhanced);
  if(crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==crypto.createHash('sha256').update(enhanced).digest('hex')) throw Error(`${name} write verification failed`);
  console.log(`${name}: saved ${new JSDOM(enhanced).window.document.querySelectorAll('tr[data-step-id]').length} permanent AI step records`);
}
// Mirror the sibling evidence folder for local-file use, without changing the procedures' differing coverage.
fs.mkdirSync(`docs/handbook/${evidenceDir}`,{recursive:true});
for(const file of files.concat('report.json'))fs.copyFileSync(`${dir}/${file}`,`docs/handbook/${evidenceDir}/${file}`);
console.log(JSON.stringify(result.counts));
