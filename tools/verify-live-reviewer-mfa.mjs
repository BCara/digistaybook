import fs from 'node:fs';
import {randomUUID, randomBytes, createHmac} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {initializeApp, deleteApp} from 'firebase/app';
import {getAuth, signInWithEmailAndPassword, signOut, multiFactor, TotpMultiFactorGenerator, getMultiFactorResolver} from 'firebase/auth';
const project='digistaybook-cbert';
const env=fs.readFileSync('tmp/reviewer-mfa-hosting-release/.env.local','utf8');
const apiKey=env.match(/^VITE_FIREBASE_API_KEY=(.+)$/m)?.[1].trim().replace(/^['"]|['"]$/g,'');
if(!apiKey)throw Error('Production public Firebase configuration is missing');
const token=execFileSync('cmd.exe',['/d','/s','/c','gcloud auth print-access-token'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
async function admin(path,body){
  const res=await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${project}/${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'X-Goog-User-Project':project,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await res.json();if(!res.ok)throw Error(`Scoped test-account operation failed: HTTP ${res.status}`);return data;
}
let clockOffset=0;
function otp(factor,time=Date.now()+clockOffset){
  const secret=factor.secretKey;
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret.toUpperCase().replace(/=+$/,'')){assert.ok(alphabet.includes(c),'Invalid base32 character');bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');}
  const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(time/(Number(factor.codeIntervalSeconds)*1000))));
  const hash=createHmac(factor.hashingAlgorithm.toLowerCase().replace('-',''),Buffer.from(bytes)).update(counter).digest(),offset=hash.at(-1)&15;
  return ((hash.readUInt32BE(offset)&0x7fffffff)%10**factor.codeLength).toString().padStart(factor.codeLength,'0');
}
assert.equal(otp({secretKey:'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',hashingAlgorithm:'SHA1',codeLength:8,codeIntervalSeconds:30},59000),'94287082');
const email=`mfa-verification-${randomUUID()}@example.test`,password=randomBytes(24).toString('base64url');
const app=initializeApp({apiKey,projectId:project,authDomain:project+'.firebaseapp.com'},'scoped-mfa-verification');
let uid;
try{
  uid=(await admin('accounts',{email,password,emailVerified:true})).localId;
  const auth=getAuth(app),first=await signInWithEmailAndPassword(auth,email,password);
  const issued=(await first.user.getIdTokenResult()).claims.iat;
  console.log(JSON.stringify({firebaseIssuedAtOffsetSeconds:Number(issued)-Math.floor(Date.now()/1000)}));
  const secret=await TotpMultiFactorGenerator.generateSecret(await multiFactor(first.user).getSession());
  const clock=await fetch('https://www.googleapis.com/discovery/v1/apis');clockOffset=Date.parse(clock.headers.get('date'))-Date.now();
  console.log(JSON.stringify({hashingAlgorithm:secret.hashingAlgorithm,codeLength:secret.codeLength,interval:secret.codeIntervalSeconds,clockOffsetSeconds:Math.round(clockOffset/1000)}));
  let enrolled=false;
  for(const intervalOffset of [0,-1,1]){
    try{
      await multiFactor(first.user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(secret,otp(secret,Date.now()+clockOffset+intervalOffset*30000)),'Disposable verification factor');
      enrolled=true;console.log(JSON.stringify({enrollmentIntervalOffset:intervalOffset}));break;
    }catch(error){if(error.code!=='auth/invalid-verification-code')throw error;}
  }
  assert.equal(enrolled,true,'Valid code rejected across adjacent intervals');
  await signOut(auth);
  let resolver;
  try{await signInWithEmailAndPassword(auth,email,password);throw Error('Second factor was not requested');}
  catch(error){assert.equal(error.code,'auth/multi-factor-auth-required');resolver=getMultiFactorResolver(auth,error);}
  const factor=resolver.hints.find(f=>f.factorId==='totp');assert.ok(factor);
  let rejected=false;
  try{await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(factor.uid,'not-a-code'));}catch{rejected=true;}
  assert.equal(rejected,true);assert.equal(auth.currentUser,null);
  // Firebase rejects reuse of the enrolment code. Use a fresh authenticator interval.
  await new Promise(resolve=>setTimeout(resolve,30000-((Date.now()+clockOffset)%30000)+1500));
  const result=await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(factor.uid,otp(secret)));
  const claims=(await result.user.getIdTokenResult()).claims;
  assert.equal(claims.firebase.sign_in_second_factor,'totp');assert.notEqual(claims.admin,true);
  await signOut(auth);assert.equal(auth.currentUser,null);
  console.log('PASS: live Firebase TOTP enrolment, mandatory second-factor challenge, invalid-code rejection, valid-code sign-in and second-factor claim. Synthetic account has no reviewer privileges.');
}catch(error){console.error('Live MFA verification failed:',error.code??'verification-error');process.exitCode=1;}
finally{
  if(uid){await admin('accounts:delete',{localId:uid});assert.equal((await admin('accounts:lookup',{localId:[uid]})).users?.length??0,0);console.log('Disposable authentication account removed and absence verified.');}
  await deleteApp(app);
}
