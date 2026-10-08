import fs from 'node:fs';
import assert from 'node:assert/strict';
const paths=['docs/handbook/DIGISTAYBOOK_TEST_PROCEDURES.html',String.raw`\\192.168.1.71\nas\projects\DigiStayBook\business-operations\DIGISTAYBOOK_TEST_PROCEDURES.html`];
const status='<p><strong>Current status — 6 October 2026:</strong> Identity Platform and authenticator MFA are enabled in production. The enrolment and sign-in challenge screens are deployed. Reviewer permission is assigned to clb.bertram@gmail.com, caralbertram@gmail.com, jjbdunleavy@gmail.com and codebertcreations@gmail.com. Each person must still sign in with their own Google account and enrol their own authenticator. A disposable account passed live Firebase MFA verification and was deleted. Real reviewer and mobile journeys remain pending; this procedure is not yet fully passed.</p><p><strong>Reviewer setup:</strong> open <a href="https://digistaybook-cbert.web.app/operations" target="_blank" rel="noopener">Safety Review</a>, choose <strong>Continue with Google</strong> using the exact approved email, then follow <strong>Set up authenticator</strong>. At <a href="https://digistaybook-cbert.web.app/operations/setup" target="_blank" rel="noopener">authenticator setup</a>, confirm the displayed email and verify it if requested. Choose <strong>Confirm Google sign-in and set up authenticator</strong>. In your authenticator app, add an account and scan the QR code (or enter the manual setup key). Enter its six-digit code and confirm. Sign out and sign in again; use a newly generated code for the sign-in challenge. Confirm Safety Review opens and record Mobile/Desktop coverage below. Keep QR codes, setup keys and codes out of this document.</p><p><strong>Lost authenticator:</strong> contact the project administrator for identity-checked factor reset and session revocation, then repeat enrolment. Recovery must be tested on a disposable account before S10/S11 pass. Follow <a href="https://firebase.google.com/docs/auth/web/totp-mfa" target="_blank" rel="noopener">Firebase authenticator-app MFA documentation</a>.</p>';
const rows=[
 ['MFA-20261006 / AI','Local source / automated; no physical-device claim','TP-LIVE-08-S03/S04/S07','Pass (automated scope)','Enrolment/challenge and access controls work','Full check passed: 643 tests, one skipped; typecheck and both builds passed','reviewer-mfa-release-2026-10-06.md','Implemented / AI','Human device checks pending'],
 ['MFA-20261006 / AI','Production configuration / API','TP-LIVE-08-S01/S02','S01 pass; S02 partial','MFA enabled; four approved accounts authorised','Identity Platform and TOTP enabled; four reviewer roles assigned. Personal email verification and factors pending.','reviewer-mfa-release-2026-10-06.md','Provisioned / AI','Each reviewer to sign in and enrol'],
 ['MFA-20261006 / AI','Live Hosting / desktop browser','TP-LIVE-08-S03/S04; TP-SEC-03-S03','Pass (deployment / signed-out gate)','New screens served; signed-out review access denied','Release HTML matched; /operations redirected to sign-in; no queue displayed','Asset index-B61fgl1M.js','Deployed / AI','Mobile and authenticated UI pending'],
 ['MFA-20261006 / AI','Live Firebase / SDK; no physical device','TP-LIVE-08-S05/S06','Initial automated attempt failed','A fresh valid code completes sign-in','Test reused enrolment code immediately during sign-in; Firebase rejected it. Enrolment failure was initially inferred incorrectly.','tools/verify-live-reviewer-mfa.mjs','Test helper corrected / AI','Retest below passed'],
 ['MFA-20261006 / AI','Live Firebase / SDK; no physical device','TP-LIVE-08-S05/S06; sign-out portion S10','Pass (provider scope)','Enrolment, mandatory challenge, rejection and fresh-code sign-in','Disposable account passed all checks; second-factor claim verified; account deleted and absence verified. No reviewer privileges used.','tools/verify-live-reviewer-mfa.mjs','Verified / AI','Real reviewer Google/UI/device checks pending'],
 ['MFA-20261006 / AI','Live / Mobile and Desktop pending','TP-LIVE-08-S02/S05/S08-S12','Pending','Each reviewer enrols and verifies live review actions/recovery','Personal factors, Google linking, reviewer queue/actions, recovery and device coverage not yet executed','TP-LIVE-08 steps','Reviewers / project administrator','Do not mark complete procedure passed']
].map(c=>'<tr data-run="MFA-20261006">'+c.map(s=>'<td>'+s.replaceAll('&','&amp;').replaceAll('<','&lt;')+'</td>').join('')+'</tr>').join('');
for(const path of paths){
 let html=fs.readFileSync(path,'utf8');
 assert.ok(html.includes('id="TP-LIVE-08"'));
 const start=html.indexOf('<p><strong>Current status:',html.indexOf('id="TP-LIVE-08"'));
 const end=html.indexOf('<div class="step-table-scroll">',start);
 assert.ok(start>=0&&end>start,'MFA status block missing');
 html=html.slice(0,start)+status+html.slice(end);
 html=html.replace(/<tr data-placeholder="true">[\s\S]*?<\/tr>/,'');
 if(!html.includes('data-run="MFA-20261006"'))html=html.replace('<!-- shared-test-results:end -->',rows+'<!-- shared-test-results:end -->');
 const before=fs.readFileSync(path,'utf8');
 assert.equal((html.match(/data-step-id=/g)||[]).length,(before.match(/data-step-id=/g)||[]).length,'Step IDs must be preserved');
 fs.writeFileSync(path,html);
 assert.equal(fs.readFileSync(path,'utf8'),html);
 console.log('Updated MFA instructions and shared results: '+path);
}
fs.copyFileSync('docs/reviewer-mfa-release-2026-10-06.md',String.raw`\\192.168.1.71\nas\projects\DigiStayBook\business-operations\reviewer-mfa-release-2026-10-06.md`);
