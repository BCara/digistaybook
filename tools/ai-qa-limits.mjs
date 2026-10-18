import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
Object.assign(process.env,{GCLOUD_PROJECT:'demo-digistaybook',FUNCTIONS_EMULATOR:'true',LOCAL_TEST_SCREENING:'false',FIRESTORE_EMULATOR_HOST:'127.0.0.1:18080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:19099',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:19199'});
const require=createRequire(new URL('../functions/package.json',import.meta.url));
require('firebase-admin/app').initializeApp({projectId:'demo-digistaybook'});
const db=require('firebase-admin/firestore').getFirestore(), sharp=require('sharp');
const {guestPolicy}=await import('../functions/lib/guestPolicy.js');
const {processGuestSubmission}=await import('../functions/lib/guestContributions.js');
const base='http://127.0.0.1:15001/demo-digistaybook/australia-southeast1';
const propertyId='ai-limits-'+randomUUID().slice(0,24),stayToken=randomUUID().replaceAll('-','').slice(0,22);
await db.doc(`properties/${propertyId}`).set({ownerUid:'ai-limits-host',slug:propertyId,name:'Synthetic exact limits',mode:'live',lifecycle:'active',stayToken});
const identity=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})}).then(r=>r.json());
assert.ok(identity.idToken);
const results=[];
async function call(name,data,status=200) {
  const response=await fetch(`${base}/${name}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${identity.idToken}`},body:JSON.stringify({data}),signal:AbortSignal.timeout(120000)});
  const body=await response.json();assert.equal(response.status,status,`${name}: ${JSON.stringify(body)}`);return body.result??body.error;
}
const input=()=>({slug:propertyId,stayToken,requestId:randomUUID(),message:'A synthetic memory',photoCount:0,consentAccepted:true,consentVersion:guestPolicy.consentVersion});
for(const size of [1199,1200,1201]) for(const route of ['memory','feedback']) {
  const data={...input(),...(route==='feedback'?{message:'',feedback:'a'.repeat(size)}:{message:'a'.repeat(size)})};
  const result=await call('beginGuestContribution',data,size>1200?400:200);
  if(size<=1200) {
    await call('finishGuestContribution',{id:result.id});
    if(route==='memory') {
      // The unavailable provider opens a case; inspect stored text without claiming publication.
      assert.equal((await db.doc(`guestSubmissions/${result.id}`).get()).get('message').length,size);
    } else assert.equal((await db.doc(`properties/${propertyId}/privateFeedback/${result.id}`).get()).get('message').length,size);
  }
  results.push({step:route==='memory'?'TP-GUEST-03-S12':'TP-GUEST-03-S13',route,characters:size,status:size>1200?400:200,id:result.id??null,scope:'backend only; phone form and displayed truncation not exercised'});
}
const jpeg=await sharp({create:{width:50,height:50,channels:3,background:'blue'}}).jpeg().toBuffer();
const pad=size=>Buffer.concat([jpeg,Buffer.alloc(size-jpeg.length)]);
async function begin(count){return (await call('beginGuestContribution',{...input(),photoCount:count})).id;}
const fiveMiB=5*1024*1024;
for(const size of [fiveMiB,fiveMiB+1]) {
  const id=await begin(1);await call('uploadGuestPhoto',{id,index:0,base64:pad(size).toString('base64')},size>fiveMiB?400:200);
  results.push({step:'TP-GUEST-03-S09',bytes:size,status:size>fiveMiB?400:200,id,scope:'actual valid JPEG payload, padded to exact byte count; backend upload'});
}
const totalId=await begin(6);
for(let i=0;i<5;i++) await call('uploadGuestPhoto',{id:totalId,index:i,base64:pad(fiveMiB).toString('base64')});
assert.equal((await db.doc(`guestSubmissions/${totalId}`).get()).get('bytes'),25*1024*1024);
await call('uploadGuestPhoto',{id:totalId,index:5,base64:jpeg.toString('base64')},400);
results.push({step:'TP-GUEST-03-S10',id:totalId,acceptedBytes:25*1024*1024,additionalBytes:jpeg.length,additionalStatus:400,scope:'actual five JPEG uploads total exactly 25 MiB; additional permitted JPEG refused; submission not completed because declared six slots'});
for(const width of [8000,8001]) {
  const height=5000, bytes=await sharp({create:{width,height,channels:3,background:'green'}}).jpeg({quality:40}).toBuffer();assert.ok(bytes.length<fiveMiB);
  const id=await begin(1);await call('uploadGuestPhoto',{id,index:0,base64:bytes.toString('base64')},width===8000?200:400);
  results.push({step:'TP-GUEST-03-S11',id,width,height,pixels:width*height,bytes:bytes.length,status:width===8000?200:400,scope:'actual generated JPEG decoded by backend; physical orientation/UI recovery not exercised'});
}
fs.writeFileSync('artifacts/qa/2026-10-17/limit-results.json',JSON.stringify({propertyId,results},null,2));
console.log('PASS: actual backend 1199/1200/1201-character memory and feedback, exact 5 MiB/per-file rejection, exact 25 MiB/total rejection, exact 40 MP/over-pixel rejection. Device/form/full photo publication remains separate.');
process.exit(0);
