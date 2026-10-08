import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const names=['DIGISTAYBOOK_BUSINESS_AND_OPERATING_PLAN.html','DIGISTAYBOOK_TEST_PROCEDURES.html','DIGISTAYBOOK_DEVELOPER_AND_LAUNCH_CHECKLIST.html'];
const roots=['docs/handbook',String.raw`\\192.168.1.71\nas\projects\DigiStayBook\business-operations`];
const note=`<!-- local-test-setup:start --><div class="panel"><h3>Local Test — 5 October 2026</h3><p>There are two environments: local <strong>Test</strong> and live <strong>Production</strong>. Run <code>npm run test:local</code> in the DigiStayBook project folder. Open <a href="http://127.0.0.1:5181/__test">the local accounts and walkthrough guide</a>. It lists the three accounts, guest links, screening markers and save/reset commands. All Test accounts use <code>LocalTest-2026!</code>.</p><p>Test uses <code>demo-digistaybook</code> with local Auth, Firestore, Storage and Functions. The launcher uses isolated generated Functions files and dummy secrets; production configuration is not copied. Screening is simulated, payments are disabled and notification records remain in the local outbox rather than sending real email. Operations uses an explicit local reviewer simulation; it does not prove real MFA.</p><p>Begin with the host/guest walkthrough. Payment, real email, real Google classification, hosted App Check and production recovery checks are deferred and must be recorded as not exercised. Use the computer running Test: phone access is not configured because all endpoints bind to loopback. Save runs every 30 seconds and on Ctrl+C; the next start imports that snapshot. Reset replaces only the local demo data.</p></div><!-- local-test-setup:end -->`;
await mkdir('.local-test/document-backups',{recursive:true});
for(const root of roots) for(const name of names) {
  const path=root+'/'+name;
  let before;try{before=await readFile(path,'utf8');}catch(e){if(root.startsWith('docs'))throw e;console.log('NAS unavailable:',name);continue;}
  let after=before.replace(/<!-- local-test-setup:start -->[\s\S]*?<!-- local-test-setup:end -->/,'');
  if(name.includes('BUSINESS')) {
    const start=after.indexOf('<h3 id="environments">'),end=after.indexOf('<h3 id="quality">',start);
    if(start<0||end<0)throw new Error('Environment section missing');
    after=after.slice(0,start)+`<h3 id="environments">6.5 Environments</h3><p>Two environments are used. Feature development and hands-on testing share the local Test environment; there is no separate staging or preview project.</p><div class="table-wrap"><table><thead><tr><th>Environment</th><th>Purpose</th><th>Data boundary</th><th>Authority</th></tr></thead><tbody><tr><td>Test (local)</td><td>Feature work, automated checks and the owner/tester walkthrough.</td><td>demo-digistaybook Firebase emulators only; synthetic data and test photos. Simulated screening; no live payments or real emails.</td><td>Local maintainer; no cloud deployment.</td></tr><tr><td>Production</td><td>Live customer service and separately authorised, scoped real-service verification.</td><td>digistaybook-cbert; real customer data and providers. Test fixtures and local reviewer simulation never grant production access.</td><td>Deliberate release by authorised maintainers.</td></tr></tbody></table></div>${note}<p>Passing local Test does not prove real provider classification, App Check enforcement, MFA, payment/email delivery, deployment or cloud deletion/recovery. Those checks remain separately recorded before wider release. Draft legal approval is not changed by local testing.</p>\n\n`+after.slice(end);
  } else if(name.includes('TEST_PROCEDURES')) {
    after=after.replace('<h3 class="sub">Words used here</h3>',note+'\n<h3 class="sub">Words used here</h3>');
    after=after.replace('A practice copy. No real money or customers, so break whatever you like. Do all 38 checks.','Local practice copy. Start with the linked walkthrough; record hosted-provider, payment and email checks as not exercised locally.');
  } else {
    after=after.replace('<h3 class="sub">A.1 · Environment</h3>',note+'\n<h3 class="sub">A.1 · Environment</h3>');
    after=after.replace(/<li><strong>Test site:<\/strong>[\s\S]*?<\/li>/,'<li><strong>Test site:</strong> run <code>npm run test:local</code>; use the accounts and links in the local walkthrough above. There is no separate preview Firebase project.</li>');
    after=after.replace(/<li>Screening is not connected[\s\S]*?<\/li>/,'<li>Local Test simulates clear, host-review, restricted-safety and outage outcomes. Production uses Google providers; local fixture results are not calibration evidence.</li>');
    after=after.replace('A provider failure delivers feedback; it does not publish a memory.','An incomplete provider check routes the item to restricted safety review tagged Screening incomplete, with the reason visible to the reviewer. Feedback stays undelivered and memories unpublished until authorised review.');
    after=after.replace('No email is sent except Firebase’s own password-reset message. TP-EM-00 in the guide records which emails arrive.','Local Test sends no real email. Inspect notificationOutbox in the emulator viewer for queued notices; emulator password-reset links appear locally. Real receipt is a separate Production check.');
  }
  if(createHash('sha256').update(await readFile(path,'utf8')).digest('hex')!==createHash('sha256').update(before).digest('hex'))throw new Error('Document changed during preparation');
  await copyFile(path,`.local-test/document-backups/${root.startsWith('docs')?'local':'nas'}-${name}`);
  await writeFile(path,after);
  if(await readFile(path,'utf8')!==after)throw new Error('Document save mismatch');
  console.log('Updated:',path);
}
