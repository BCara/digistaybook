import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
Object.assign(process.env,{GCLOUD_PROJECT:'demo-digistaybook',FUNCTIONS_EMULATOR:'true',FIRESTORE_EMULATOR_HOST:process.env.FIRESTORE_EMULATOR_HOST??'127.0.0.1:8080'});
const {initializeApp}=await import('../functions/node_modules/firebase-admin/lib/app/index.js');
const {getFirestore,Timestamp}=await import('../functions/node_modules/firebase-admin/lib/firestore/index.js');
initializeApp({projectId:'demo-digistaybook'});
const {announceNewOperationsItems}=await import('../functions/lib/operationsNotify.js');
const db=getFirestore(),start=Date.now(),prefix='notify-'+randomUUID();
const at=ms=>Timestamp.fromMillis(start+ms);
await db.doc('operationsNotifyState/newItems').delete();
try {
await db.doc(`deletionJobs/${prefix}-old`).set({propertyId:'p',status:'needs_attention',failureCode:'attempt_limit',createdAt:at(-86400000)});
assert.equal(await announceNewOperationsItems(start),null,'first sweep only sets the starting point');
await db.doc(`trustSafetyCases/${prefix}-case`).set({kind:'guest_memory',status:'open',message:'Private guest words',createdAt:at(1000)});
await db.doc(`operationsAlerts/${prefix}-alert`).set({kind:'screening_failed',status:'pending',createdAt:at(2000)});
await db.doc(`contentReports/${prefix}-dup`).set({reason:'spam',status:'duplicate',createdAt:at(3000)});
const summary=await announceNewOperationsItems(start+5*60000);
assert.deepEqual(summary,{newCount:2,queues:'1 safety cases, 1 alerts',kinds:'guest memory, screening failed'});
assert.doesNotMatch(JSON.stringify(summary),/Private guest words/);
assert.equal(await announceNewOperationsItems(start+10*60000),null,'items are announced once');
await db.doc(`deletionJobs/${prefix}-job`).set({propertyId:'p',status:'held',holdReason:'safety_review_required',createdAt:at(0)});
assert.deepEqual(await announceNewOperationsItems(start+15*60000),{newCount:1,queues:'1 stuck photo deletions',kinds:'deletion held: safety review required'});
assert.equal(await announceNewOperationsItems(start+20*60000),null,'a stuck job is announced once');
await db.doc(`deletionJobs/${prefix}-job`).update({status:'needs_attention',failureCode:'attempt_limit'});
assert.deepEqual(await announceNewOperationsItems(start+25*60000),{newCount:1,queues:'1 stuck photo deletions',kinds:'deletion needs attention: attempt limit'});
} finally {
for(const path of [`deletionJobs/${prefix}-old`,`deletionJobs/${prefix}-job`,`trustSafetyCases/${prefix}-case`,`operationsAlerts/${prefix}-alert`,`contentReports/${prefix}-dup`]) await db.doc(path).delete();
await db.doc('operationsNotifyState/newItems').delete();
}
console.log('PASS: new safety items are announced once, by count and kind only; duplicates and the existing backlog are not announced; stuck photo deletions are announced once per stuck state.');
