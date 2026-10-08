import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
Object.assign(process.env,{GCLOUD_PROJECT:'demo-digistaybook',FUNCTIONS_EMULATOR:'true',LOCAL_TEST_SCREENING:'true',
  FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:9199'});
const require=createRequire(new URL('../functions/package.json',import.meta.url));
require('firebase-admin/app').initializeApp({projectId:'demo-digistaybook'});
const db=require('firebase-admin/firestore').getFirestore();
const storage=require('firebase-admin/storage').getStorage();
const base='http://127.0.0.1:5001/demo-digistaybook/australia-southeast1';
async function login(email) {
  const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'LocalTest-2026!',returnSecureToken:true})});
  assert.equal(r.status,200);return (await r.json()).idToken;
}
async function call(name,data,token,status=200){
  const r=await fetch(`${base}/${name}`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({data})});
  const body=await r.json();assert.equal(r.status,status,JSON.stringify(body));return body.result;
}
const host=await login('host@example.test'),other=await login('host2@example.test'),ops=await login('operations@example.test');
const wall=await call('getPublicWall',{slug:'test-cottage'});
assert.equal(wall.posts.length,3);assert.doesNotMatch(JSON.stringify(wall),/private suggestion|\[safety\]|\[review\]|\[outage\]/i);
const hostQueue=await call('listHostGuestReview',{propertyId:'test-cottage'},host);
assert.equal(hostQueue.feedback.length,1);assert.equal(hostQueue.posts.filter(p=>p.message.includes('[review]')).length,1);
await call('listHostGuestReview',{propertyId:'test-cottage'},other,403);
await call('listSafetyOperations',{queue:'trustSafetyCases'},host,403);
const safety=await call('listSafetyOperations',{queue:'trustSafetyCases'},ops);
const fixtureCases=[];
for(const item of safety.items.filter(item=>item.propertyId==='test-cottage'&&['open','escalated'].includes(item.status))) {
  const review=await call('readSafetyCase',{id:item.id},ops);
  if(/\[(safety|outage)\]/.test(review.message)) fixtureCases.push(review);
}
assert.equal(fixtureCases.filter(item=>item.message.includes('[safety]')).length,2);
assert.equal(fixtureCases.filter(item=>item.message.includes('[outage]')&&item.screeningStatus==='incomplete').length,1);
const anonymous=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})}).then(r=>r.json());
const {guestPolicy}=await import('../functions/lib/guestPolicy.js');
const input={slug:'test-cottage',stayToken:'LocalTestStayToken0001',requestId:randomUUID(),message:'A verification memory',feedback:'',photoCount:1,
  consentAccepted:true,consentVersion:guestPolicy.consentVersion};
const {id}=await call('beginGuestContribution',input,anonymous.idToken);
const bytes=await require('sharp')({create:{width:20,height:20,channels:3,background:'blue'}}).png().toBuffer();
await call('uploadGuestPhoto',{id,index:0,base64:bytes.toString('base64')},anonymous.idToken);
await call('finishGuestContribution',{id},anonymous.idToken);
assert.equal((await db.doc(`guestSubmissions/${id}`).get()).get('status'),'published');
assert.equal((await fetch(`${base}/guestMemoryPhoto?id=${id}&index=0`)).status,200);
await call('changeGuestContribution',{id,action:'delete',revision:1},anonymous.idToken);
assert.equal((await fetch(`${base}/guestMemoryPhoto?id=${id}&index=0`)).status,404);
const {processStorageJob}=await import('../functions/lib/storageDeletion.js');
// Exercise the normal worker after its five-minute settle period in this local assertion.
await processStorageJob('deletionJobs',`guest-${id}`,Date.now()+6*60000);
const job=(await db.doc(`deletionJobs/guest-${id}`).get()).data();assert.equal(job.status,'complete');
for(const target of job.objects)assert.equal((await storage.bucket(target.bucket).file(target.path).exists())[0],false);
await db.doc('localTest/resetProbe').set({verificationOnly:true});
console.log('PASS: three logins, public/private routing, owner isolation, restricted reviewer access, photo delivery and actual local file deletion.');
process.exit(0);
