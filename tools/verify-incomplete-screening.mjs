import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
Object.assign(process.env,{GCLOUD_PROJECT:'demo-digistaybook',FUNCTIONS_EMULATOR:'true',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:9199'});
const require=createRequire(new URL('../functions/package.json',import.meta.url));
require('firebase-admin/app').initializeApp({projectId:'demo-digistaybook'});
const {getFirestore,Timestamp}=require('firebase-admin/firestore');const db=getFirestore();
const {processGuestSubmission,deliverFeedback}=await import('../functions/lib/guestContributions.js');
const {readSafetyCase,listSafetyOperations,resolveSafetyCase}=await import('../functions/lib/reporting.js');
const {ScreeningBudgetReached}=await import('../functions/lib/screeningBudget.js');
const prefix='incomplete-'+randomUUID(),propertyId=prefix;
const ops={uid:'verification-ops',token:{admin:true,firebase:{sign_in_second_factor:'phone'}}};
try {
await db.doc(`properties/${propertyId}`).set({ownerUid:'verification-host',name:'Synthetic verification',slug:prefix,mode:'live',lifecycle:'active'});
const seeds=[['missing',async()=>({outcome:'unavailable'}),'incomplete_result'],['failure',async()=>{throw new Error('Timeout with private text not copied');},'provider_error'],['budget',async()=>{throw new ScreeningBudgetReached();},'daily_allowance_reached']];
for(const [suffix,scan,reason] of seeds){
  const id=prefix+'-'+suffix;
  await db.doc(`guestSubmissions/${id}`).set({propertyId,status:'pending',revision:1,message:'Ordinary synthetic memory',photoCount:0,createdAt:Timestamp.now()});
  await processGuestSubmission(id,scan);
  const submission=await db.doc(`guestSubmissions/${id}`).get();assert.equal(submission.get('safetyCaseOpen'),true);
  assert.equal(submission.get('status'),'critical');
  const review=await readSafetyCase.run({data:{id:id+':1'},auth:ops});
  assert.equal(review.source,'incomplete_screening');assert.equal(review.screeningStatus,'incomplete');assert.equal(review.screeningIncompleteReason,reason);
  assert.deepEqual(review.categories,['Screening incomplete']);
  await processGuestSubmission(id,async()=>({outcome:'clear'}));assert.equal((await db.doc(`guestSubmissions/${id}`).get()).get('status'),'critical');
  await assert.rejects(readSafetyCase.run({data:{id:id+':1'},auth:{uid:'verification-host',token:{}}}));
  await resolveSafetyCase.run({data:{id:id+':1',action:'release'},auth:ops});
  assert.equal((await db.doc(`guestSubmissions/${id}`).get()).get('status'),'standard');
  assert.equal((await db.doc(`properties/${propertyId}/posts/${id}`).get()).get('visibility'),'hidden_pending_review');
}
for(const [suffix,scan,reason] of [['feedback-error',async()=>{throw new Error('Provider failed');},'provider_error'],['feedback-budget',async()=>{throw new ScreeningBudgetReached();},'daily_allowance_reached']]){
  const id=prefix+'-'+suffix;
  await db.doc(`guestSubmissions/${id}`).set({propertyId,kind:'feedback',status:'feedback',revision:1,feedback:'Synthetic private feedback',createdAt:Timestamp.now()});
  await deliverFeedback(id,scan);
  assert.equal((await db.doc(`guestSubmissions/${id}`).get()).get('feedbackStatus'),'held');
  assert.equal((await db.doc(`properties/${propertyId}/privateFeedback/${id}`).get()).exists,false);
  const review=await readSafetyCase.run({data:{id:'feedback-'+id},auth:ops});assert.equal(review.screeningIncompleteReason,reason);
  await deliverFeedback(id,async()=>({verdict:'deliver'}));assert.equal((await db.doc(`properties/${propertyId}/privateFeedback/${id}`).get()).exists,false);
  await resolveSafetyCase.run({data:{id:'feedback-'+id,action:'release'},auth:ops});
  assert.equal((await db.doc(`properties/${propertyId}/privateFeedback/${id}`).get()).get('message'),'Synthetic private feedback');
}
const page=await listSafetyOperations.run({data:{queue:'trustSafetyCases'},auth:ops});
assert.ok(page.items.some(item=>item.id.startsWith(prefix)&&item.screeningStatus==='incomplete'));
console.log('PASS: incomplete results, provider exceptions and allowance exhaustion create tagged restricted cases; no retry bypass; authorised memory/feedback release and host-access denial.');
} finally {
  // Remove only records owned by this random synthetic property; preserve other test data.
  for (const collection of ['guestSubmissions','trustSafetyCases','moderationAudit','notificationOutbox']) {
    const records=await db.collection(collection).where('propertyId','==',propertyId).get();
    for (const record of records.docs) await record.ref.delete();
  }
  await db.recursiveDelete(db.doc(`properties/${propertyId}`));
}
process.exit(0);
