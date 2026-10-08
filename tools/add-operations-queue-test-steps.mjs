import fs from 'node:fs';
import assert from 'node:assert/strict';
const paths=['docs/handbook/DIGISTAYBOOK_TEST_PROCEDURES.html',String.raw`\\192.168.1.71\nas\projects\DigiStayBook\business-operations\DIGISTAYBOOK_TEST_PROCEDURES.html`];
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const checks=[
 ['Content reports','Select Content reports and refresh. Using a disposable test memory, submit a clearly labelled test report through the guest reporting flow, then refresh and locate its exact report reference.','The queue loads without an access error. The test report appears with its reference and status. Restricted report text and photos are absent from the overview. Record creation and queue-load results separately if either is blocked.'],
 ['Privacy requests','Select Privacy requests and refresh. Submit a clearly labelled synthetic privacy request through Privacy & Safety using the test contact address, then locate its exact request reference.','The queue loads and the test request appears with reference, status and any applicable review deadline. Do not treat a received request as completed deletion. Record the request ID and receipt/queue evidence.'],
 ['Safety cases','Select Safety cases and refresh. Locate a disposable held memory or private-feedback case from the screening tests, and a screening-incomplete case where available. Open the case; use the existing release/delete tests for decisions.','The queue loads with the expected case references and statuses. Opening permitted case content is audited. Incomplete screening has its reason tagged; content stays private until the approved route permits publication or delivery. Record missing fixtures or unsupported live tagging as pending/faults.'],
 ['Alerts','Select Alerts and refresh. Ask engineering to identify a controlled test alert or create one through the relevant test-only overdue/deadline scenario, then locate its exact reference. Do not age real customer cases to generate an alert.','The queue loads. The known test alert appears with reference, kind and status. Empty queues show No items in this queue. If no test alert exists, queue loading can pass while alert creation/visibility remains pending.'],
 ['Deletion jobs','Select Deletion jobs and refresh. Delete a disposable test memory with uploaded photos using TP-LIVE-06, then identify the exact deletion-job reference and refresh after the worker runs.','The queue loads and the expected job/status is visible. Verify each targeted storage object separately under TP-LIVE-06; a listed or completed job alone is not proof that files were deleted. Record job ID, timestamps and actual object evidence.'],
 ['Consent deletion reviews','Select Consent deletion reviews and refresh. Identify a disposable consent-review fixture through the retention tests. Click Check consent retention; verify its exact consent path, status and available deadline/action/evidence. If manual deletion is due, use only the authorised disposable fixture and recheck afterward.','The queue loads and the known review appears. The expanded review points to the correct consent record; after authorised deletion, rechecking reflects the actual record state. Do not delete a real guest consent record for this test or claim long-term expiry is automated. If no fixture exists, mark that portion pending.']
];
const rows=checks.map(([label,action,expected],i)=>{
 const id=`TP-LIVE-08-S${String(i+13).padStart(2,'0')}`;
 const marks=[['pass','step-result step-pass','data-result','Pass'],['fail','step-result step-fail','data-result','Fail'],['mobile','step-device step-mobile','data-device','Tested on mobile'],['desktop','step-device step-desktop','data-device','Tested on desktop']].map(([value,cls,attr,name])=>`<td class="step-mark"><input type="checkbox" class="${cls}" ${attr}="${value}" aria-label="${name} ${id}"></td>`).join('');
 return `<tr id="${id}" data-step-id="${id}"><td class="step-id">${id}</td><td><strong>${escape(label)}:</strong> ${escape(action)}</td><td class="exp">${escape(expected)}</td>${marks}</tr>`;
}).join('');
for(const path of paths){
 let html=fs.readFileSync(path,'utf8');
 const start=html.indexOf('<details class="test" id="TP-LIVE-08"');assert.ok(start>=0);
 const end=html.indexOf('</details>',start);assert.ok(end>start);
 if(!html.includes('data-step-id="TP-LIVE-08-S13"')){
  const tableEnd=html.indexOf('</tbody></table>',start);assert.ok(tableEnd<end&&tableEnd>start);
  html=html.slice(0,tableEnd)+rows+html.slice(tableEnd);
  fs.writeFileSync(path,html);
 }
 const saved=fs.readFileSync(path,'utf8');
 const ids=[...saved.matchAll(/data-step-id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate step IDs');
 for(let i=13;i<=18;i++){
  const id=`TP-LIVE-08-S${i}`;const match=saved.match(new RegExp(`<tr[^>]*data-step-id="${id}"[\\s\\S]*?</tr>`));assert.ok(match);
  for(const name of ['step-pass','step-fail','step-mobile','step-desktop'])assert.ok(match[0].includes(name));
 }
 console.log('Verified six queue steps and result/device columns: '+path);
}
