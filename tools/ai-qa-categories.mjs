import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
Object.assign(process.env,{GCLOUD_PROJECT:'demo-digistaybook',FUNCTIONS_EMULATOR:'true',LOCAL_TEST_SCREENING:'false',FIRESTORE_EMULATOR_HOST:'127.0.0.1:18080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:19099',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:19199'});
const require=createRequire(new URL('../functions/package.json',import.meta.url));
require('firebase-admin/app').initializeApp({projectId:'demo-digistaybook'});
const {getFirestore,Timestamp}=require('firebase-admin/firestore'); const db=getFirestore();
const {processGuestSubmission,deliverFeedback}=await import('../functions/lib/guestContributions.js');
const {memoryTextVerdict,feedbackVerdict,memoryImageVerdict}=await import('../functions/lib/screening.js');
const categories=['Toxic','Derogatory','Violent','Sexual','Insult','Profanity','Death, Harm & Tragedy','Firearms & Weapons','Public Safety','Health','Religion & Belief','Illicit Drugs','War & Conflict','Politics','Finance','Legal'];
const serious=new Set(['Derogatory','Violent','Sexual','Firearms & Weapons']);
const propertyId='ai-category-'+randomUUID();
await db.doc(`properties/${propertyId}`).set({ownerUid:'ai-category-host',name:'AI synthetic category routing',slug:propertyId,mode:'live',lifecycle:'active'});
const results=[];
async function memory(label,verdict,expected,step) {
  const id='ai-cat-'+randomUUID();
  await db.doc(`guestSubmissions/${id}`).set({propertyId,uid:'ai-category-guest',revision:1,status:'pending',message:'Synthetic category fixture',photoCount:0,createdAt:Timestamp.now()});
  await db.doc(`properties/${propertyId}/posts/${id}`).set({message:'Synthetic category fixture',visibility:'processing',revision:1});
  await processGuestSubmission(id,async()=>verdict);
  const data=(await db.doc(`guestSubmissions/${id}`).get()).data();
  assert.equal(data.status,expected);
  const review=(await db.doc(`trustSafetyCases/${id}:1`).get()).data();
  if(expected==='critical') assert.deepEqual(review.categories,verdict.categories);
  else assert.equal(review,undefined);
  const post=(await db.doc(`properties/${propertyId}/posts/${id}`).get()).data();
  if(expected!=='published') assert.notEqual(post.visibility,'visible');
  results.push({step,label,route:'memory',id,propertyId,revision:1,verdict,status:data.status,visibility:post.visibility,caseId:review?`${id}:1`:null,method:'Isolated production verdict functions with injected complete category scores; no real provider call; no actual photo classification.'});
}
for(const [index,name] of categories.entries()) {
  const scores=categories.map(category=>({name:category,confidence:category===name?0.8:0.05}));
  const step=`TP-GUEST-08-S${String(index+1).padStart(2,'0')}`;
  await memory(name,memoryTextVerdict(scores),serious.has(name)?'critical':'standard',step);
  const id='ai-cat-feedback-'+randomUUID();
  await db.doc(`guestSubmissions/${id}`).set({propertyId,kind:'feedback',uid:'ai-category-guest',revision:1,status:'feedback',message:'',feedback:'Synthetic private category fixture',photoCount:0,createdAt:Timestamp.now()});
  await deliverFeedback(id,async()=>feedbackVerdict(scores));
  const data=(await db.doc(`guestSubmissions/${id}`).get()).data();
  const delivered=(await db.doc(`properties/${propertyId}/privateFeedback/${id}`).get()).exists;
  assert.equal(delivered,!serious.has(name));
  const review=(await db.doc(`trustSafetyCases/feedback-${id}`).get()).data();
  if(serious.has(name)) assert.deepEqual(review.categories,[name]); else assert.equal(review,undefined);
  results.push({step,label:name,route:'private feedback',id,propertyId,revision:1,scores,delivered,feedbackStatus:data.feedbackStatus,caseId:review?`feedback-${id}`:null,method:'Complete isolated score fixture; injected production feedback verdict; not Google classification.'});
}
const clear=Object.fromEntries(['adult','violence','medical','racy','spoof'].map(x=>[x,'VERY_UNLIKELY']));
for(const [index,name] of ['adult','violence','medical','racy','spoof'].entries()) {
  for(const likelihood of ['LIKELY','VERY_LIKELY']) {
    const response={...clear,[name]:likelihood};
    await memory(`${name} ${likelihood}`,memoryImageVerdict([response]),['adult','violence'].includes(name)?'critical':['medical','racy'].includes(name)?'standard':'published',`TP-GUEST-09-S${String(index+1).padStart(2,'0')}`);
  }
}
for(const likelihood of ['VERY_UNLIKELY','UNKNOWN']) await memory(likelihood,memoryImageVerdict([Object.fromEntries(Object.keys(clear).map(x=>[x,likelihood]))]),'published','TP-GUEST-09-S06');
fs.writeFileSync('artifacts/qa/2026-10-17/category-results.json',JSON.stringify(results,null,2));
console.log(`PASS: ${results.length} isolated category routes: 16 text categories as memory and feedback, five image signals at two likelihoods, clear and UNKNOWN. Provider classification and image-byte integration remain unverified by this harness.`);
process.exit(0);

