import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../functions/package.json', import.meta.url));const {initializeApp}=require('firebase-admin/app');const {getFirestore}=require('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:18180';process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:19199';initializeApp({projectId:'demo-digistaybook'});
const authBase='http://127.0.0.1:19199/identitytoolkit.googleapis.com/v1/accounts:';
async function auth(action,body){const r=await fetch(authBase+action+'?key=demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const c=await r.json();assert(r.ok,JSON.stringify(c));return c;}
async function call(name,data,token){const r=await fetch(`http://127.0.0.1:15101/demo-digistaybook/australia-southeast1/${name}`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({data})});return {status:r.status,body:await r.json()};}
const email='auth-email-check@example.test';const account=await auth('signUp',{email,password:'local-example-password',returnSecureToken:true});
const reset=await call('sendPasswordReset',{email,requestId:crypto.randomUUID()});assert.equal(reset.status,200,JSON.stringify(reset.body));
let records=await getFirestore().collection('authEmailRequests').get();const resetRow=records.docs.find(d=>d.get('kind')==='resetPassword');assert.equal(resetRow.get('status'),'emulated');const resetLink=new URL(resetRow.get('link'));assert.equal(resetLink.pathname,'/reset-password');
const resetCode=resetLink.searchParams.get('oobCode');assert.equal((await auth('resetPassword',{oobCode:resetCode})).email,email);await auth('resetPassword',{oobCode:resetCode,newPassword:'local-replacement-password'});
const signed=await auth('signInWithPassword',{email,password:'local-replacement-password',returnSecureToken:true});
const unauthorised=await call('sendAccountVerification',{requestId:crypto.randomUUID()});assert.equal(unauthorised.status,401);
const verifying=await auth('signUp',{email:'verify-auth-email-check@example.test',password:'local-verification-password',returnSecureToken:true});
const verify=await call('sendAccountVerification',{email:'forged@example.test',requestId:crypto.randomUUID()},verifying.idToken);assert.equal(verify.status,200,JSON.stringify(verify.body));
records=await getFirestore().collection('authEmailRequests').get();const verifyRow=records.docs.find(d=>d.get('kind')==='verifyEmail');assert.equal(verifyRow.get('status'),'emulated');const verifyLink=new URL(verifyRow.get('link'));assert.equal(verifyLink.pathname,'/verify-email');
await auth('update',{oobCode:verifyLink.searchParams.get('oobCode')});
const refreshed=await auth('signInWithPassword',{email:'verify-auth-email-check@example.test',password:'local-verification-password',returnSecureToken:true});const lookup=await auth('lookup',{idToken:refreshed.idToken});assert.equal(lookup.users[0].emailVerified,true);
console.log('PASS: branded reset and verification links, Firebase code validation, password reset, deliberate email verification, unauthenticated denial and forged-recipient protection. No real email sent.');



