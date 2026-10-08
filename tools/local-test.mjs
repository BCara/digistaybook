import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, cp, symlink, access, readdir, open, rm, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const project = 'demo-digistaybook';
const password = 'LocalTest-2026!';
const base = `http://127.0.0.1:5001/${project}/australia-southeast1`;
const firebaseCli = resolve('node_modules/firebase-tools/lib/bin/firebase.js');
const localEnv = { ...process.env, GCLOUD_PROJECT: project, GOOGLE_CLOUD_PROJECT: project,
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199', FUNCTIONS_EMULATOR: 'true', LOCAL_TEST_SCREENING: 'true',
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --use-system-ca`.trim() };
delete localEnv.GOOGLE_APPLICATION_CREDENTIALS;
delete localEnv.NODE_TLS_REJECT_UNAUTHORIZED;
function run(args, options = {}) {
  const child = spawn(process.execPath, args, { stdio: 'inherit', env: localEnv, ...options });
  return child;
}
async function completed(child) {
  await new Promise((ok, fail) => { child.once('error', fail); child.once('exit', code => code === 0 ? ok() : fail(new Error(`Process exited ${code}`))); });
}
async function exists(path) { try { await access(path); return true; } catch { return false; } }
async function ready() {
  const response = await fetch(`http://127.0.0.1:4400/emulators`, {signal: AbortSignal.timeout(2000)});
  const hub = await response.json();
  for (const [name, port] of Object.entries({auth:9099,firestore:8080,storage:9199,functions:5001})) {
    if (hub[name]?.port !== port || !['127.0.0.1','localhost','::1'].includes(hub[name]?.host)) throw new Error('Unexpected emulator configuration');
  }
  const health = await fetch(`${base}/health`, {signal: AbortSignal.timeout(5000)});
  if (!health.ok) throw new Error('demo-digistaybook Functions are not ready');
}
async function admin() {
  await ready();
  Object.assign(process.env, localEnv);
  const require = createRequire(new URL('../functions/package.json', import.meta.url));
  const {initializeApp,getApps} = require('firebase-admin/app');
  if (!getApps().length) initializeApp({projectId:project,storageBucket:`${project}.firebasestorage.app`});
  return { auth:require('firebase-admin/auth').getAuth(), db:require('firebase-admin/firestore').getFirestore(),
    storage:require('firebase-admin/storage').getStorage(), Timestamp:require('firebase-admin/firestore').Timestamp, sharp:require('sharp') };
}
async function call(name,data,token) {
  const response = await fetch(`${base}/${name}`, {method:'POST',headers:{'Content-Type':'application/json',...(token ? {Authorization:`Bearer ${token}`} : {})},body:JSON.stringify({data}),signal:AbortSignal.timeout(120000)});
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(`${name}: ${JSON.stringify(body)}`);
  return body.result;
}
async function seed() {
  const {auth,db,Timestamp,sharp} = await admin();
  if ((await db.doc('localTest/setup').get()).exists) { console.log('Existing Test data preserved. Use test:local:reset for a fresh walkthrough.'); return; }
  for (const [uid,email,name,ops] of [
    ['test-host','host@example.test','Test Host',false],
    ['test-host-two','host2@example.test','Second Host',false],
    ['test-operations','operations@example.test','Test Operations',true]
  ]) {
    try { await auth.getUser(uid); await auth.updateUser(uid,{email,password,displayName:name,emailVerified:true}); }
    catch (e) { if(e.code !== 'auth/user-not-found') throw e; await auth.createUser({uid,email,password,displayName:name,emailVerified:true}); }
    await auth.setCustomUserClaims(uid,ops ? {admin:true,localTestOperations:true} : {});
    await db.doc(`users/${uid}`).set({email,displayName:name,createdAt:Timestamp.now()});
  }
  for (const [id,owner,name,lifecycle] of [
    ['test-cottage','test-host','Test Cottage','active'],
    ['test-draft','test-host','Draft Cottage','draft'],
    ['test-other','test-host-two','Second Host Cottage','active']
  ]) {
    await db.doc(`properties/${id}`).set({ownerUid:owner,name,slug:id,mode:lifecycle === 'draft' ? 'sandbox' : 'live',lifecycle,
      foundationalPostCount:3,stayToken:'LocalTestStayToken0001',createdAt:Timestamp.now(),updatedAt:Timestamp.now(),
      profile:{location:'Local test property',welcome:'Welcome to our test cottage.',hosts:'Test Host',guestPrompt:'Share a memory from your test stay.',
        stayHeading:'Your stay',stayWelcome:'All details here are invented.',facts:[{term:'Wi-Fi',detail:'TestNetwork',note:'Password: invented-only'}],theme:'classic'}});
    await db.doc(`slugReservations/${id}`).set({propertyId:id,ownerUid:owner,createdAt:Timestamp.now()});
  }
  const guest = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})}).then(r=>r.json());
  const {guestPolicy} = await import('../functions/lib/guestPolicy.js');
  const photo = await sharp({create:{width:480,height:320,channels:3,background:'#c8e4df'}}).webp().toBuffer();
  for (const [message,kind,hasPhoto] of [
    ['A lovely invented weekend at Test Cottage.','memory',true],
    ['The garden was a great place to relax.','memory',false],
    ['We enjoyed our test stay.','memory',false],
    ['[review] Example waiting for the host.','memory',false],
    ['[safety] Harmless example of restricted review.','memory',true],
    ['[outage] Example waiting for screening.','memory',false],
    ['A private suggestion: add another towel.','feedback',false],
    ['[safety] Harmless held private feedback.','feedback',false]
  ]) {
    const data = {slug:'test-cottage',stayToken:'LocalTestStayToken0001',requestId:randomUUID(),photoCount:hasPhoto ? 1 : 0,message:'',feedback:'',
      ...(kind === 'feedback' ? {feedback:message} : {message,displayName:'Test Guest',consentAccepted:true,consentVersion:guestPolicy.consentVersion})};
    const {id} = await call('beginGuestContribution',data,guest.idToken);
    if (hasPhoto) await call('uploadGuestPhoto',{id,index:0,base64:photo.toString('base64')},guest.idToken);
    await call('finishGuestContribution',{id},guest.idToken);
  }
  await db.doc('localTest/setup').set({version:1,seededAt:Timestamp.now()});
  console.log('Seeded two hosts, operations reviewer, three properties and eight guest scenarios. Password: '+password);
}
async function locked(action) {
  await mkdir('.local-test',{recursive:true});
  let lock;
  for(let i=0;i<100;i++) {
    try{lock=await open('.local-test/maintenance.lock','wx');break;}
    catch(e){
      if(e.code!=='EEXIST')throw e;
      const pid=Number(await readFile('.local-test/maintenance.lock','utf8').catch(()=>''));
      if(Number.isInteger(pid)&&pid>0) {
        try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH'){await rm('.local-test/maintenance.lock',{force:true});continue;}}
      }
      await delay(200);
    }
  }
  if(!lock)throw new Error('Another local save/reset is still running; try again shortly');
  await lock.writeFile(String(process.pid));
  try{return await action();}finally{await lock.close();await rm('.local-test/maintenance.lock');}
}
async function save() { return locked(saveUnlocked); }
async function saveUnlocked() {
  await ready();
  const prior = new Set(await readdir('.'));
  const destination = resolve(`.local-test/snapshots/${Date.now()}-${randomUUID()}`);
  await mkdir(destination,{recursive:true});
  const response = await fetch('http://127.0.0.1:4400/_admin/export',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({path:destination,initiatedBy:'cli',targets:['auth','firestore','storage']}),signal:AbortSignal.timeout(60000)});
  if (!response.ok) {
    // Windows can prevent the Firebase CLI's final directory rename although
    // all three exports succeeded. Copy only this request's complete export.
    const created = (await readdir('.')).filter(name=>!prior.has(name)&&/^firebase-export-\d+[A-Za-z0-9]+$/.test(name));
    if(created.length !== 1) throw new Error('Export failed; could not identify one complete recovery snapshot');
    const source=resolve(created[0]);
    const metadata=JSON.parse(await readFile(source+'/firebase-export-metadata.json','utf8'));
    if(!metadata.auth||!metadata.firestore||!metadata.storage) throw new Error('Incomplete emulator export');
    await cp(source,destination,{recursive:true});
  }
  const metadata=JSON.parse(await readFile(destination+'/firebase-export-metadata.json','utf8'));
  if(!metadata.auth||!metadata.firestore||!metadata.storage) throw new Error('Incomplete saved snapshot');
  await writeFile('.local-test/latest.json',JSON.stringify({project,path:destination,savedAt:new Date().toISOString()}));
  // Keep three recovery snapshots. Validate every absolute target before deletion.
  const root=resolve('.local-test/snapshots');
  const snapshots=(await readdir(root)).filter(name=>/^\d+-[a-f0-9-]{36}$/.test(name)).sort();
  for(const name of snapshots.slice(0,-3)) {
    const target=resolve(root,name);
    if(!target.startsWith(root+'\\')&&!target.startsWith(root+'/'))throw new Error('Snapshot outside Test directory');
    if((await lstat(target)).isSymbolicLink())throw new Error('Refusing linked snapshot cleanup');
    await rm(target,{recursive:true});
  }
  console.log('Saved local Test accounts, records and photos.');
}
async function reset() { return locked(resetUnlocked); }
async function resetUnlocked() {
  const {storage} = await admin();
  // Only these two known demo buckets are eligible for local reset.
  for (const bucket of [`${project}.firebasestorage.app`,`${project}-published.firebasestorage.app`]) {
    const [files] = await storage.bucket(bucket).getFiles();
    for (const file of files) await file.delete({ignoreNotFound:true});
  }
  for (const url of [`http://127.0.0.1:8080/emulator/v1/projects/${project}/databases/(default)/documents`,
    `http://127.0.0.1:9099/emulator/v1/projects/${project}/accounts`]) {
    const response = await fetch(url,{method:'DELETE'}); if(!response.ok) throw new Error(`Reset failed: ${response.status}`);
  }
  await seed(); await saveUnlocked();
  console.log('Test reset complete. Sign out and back in; clear site data for fresh anonymous guest sessions.');
}
async function workers() { return locked(workersUnlocked); }
async function workersUnlocked() {
  await admin();
  const {retryPendingScreening} = await import('../functions/lib/screeningRetry.js');
  const {runStorageDeletionSweep} = await import('../functions/lib/storageDeletion.js');
  await retryPendingScreening.run({}); await runStorageDeletionSweep();
}
async function start() {
  for (const port of [5181,4400,9099,8080,9199,5001,4000]) {
    await new Promise((ok,fail)=>{
      const probe=createServer();
      probe.once('error',()=>fail(new Error(`Port ${port} is already in use. Stop that session first.`)));
      probe.listen(port,'127.0.0.1',()=>probe.close(ok));
    });
  }
  await completed(run(['functions/node_modules/typescript/bin/tsc','--project','functions/tsconfig.json']));
  await mkdir('.local-test/functions',{recursive:true});
  await cp('functions/lib','.local-test/functions/lib',{recursive:true});
  await cp('functions/package.json','.local-test/functions/package.json');
  if (!await exists('.local-test/functions/node_modules')) await symlink(resolve('functions/node_modules'),resolve('.local-test/functions/node_modules'),'junction');
  await writeFile('.local-test/functions/.env.local','STRIPE_PRICE_MONTHLY=price_local_disabled\nSTRIPE_PRICE_ANNUAL=price_local_disabled\nAPP_URL=http://127.0.0.1:5181\nLOCAL_TEST_SCREENING=true\n');
  await writeFile('.local-test/functions/.secret.local','STRIPE_RESTRICTED_KEY=rk_test_local_disabled\nSTRIPE_WEBHOOK_SECRET=whsec_local_disabled\nREPORT_HASH_KEY=local-only-report-key\n');
  await cp('.env.emulator','.env.emulator.local');
  const args=[firebaseCli,'emulators:start','--project',project,'--config','firebase.test.json','--only','auth,firestore,storage,functions'];
  if(await exists('.local-test/latest.json')) {
    const snapshot=JSON.parse(await readFile('.local-test/latest.json','utf8'));
    const path=resolve(snapshot.path),root=resolve('.local-test/snapshots');
    if(snapshot.project!==project || !path.startsWith(root+'/') && !path.startsWith(root+'\\')) throw new Error('Invalid Test snapshot path');
    args.push('--import',path);
  }
  const emulator=run(args); let web; let stopping=false; let timer;
  const stop = async () => {
    if(stopping) return; stopping=true; clearInterval(timer);
    try { await save(); } catch(e) { console.error('Automatic save failed; last saved snapshot remains:',e.message); }
    web?.kill(); emulator.kill(); process.exit(0);
  };
  process.on('SIGINT',stop); process.on('SIGTERM',stop);
  try {
    let online=false;
    for(let i=0;i<120;i++) {
      if(emulator.exitCode !== null) throw new Error('Emulators stopped during startup');
      try { await ready(); online=true; break; } catch { await delay(1000); }
    }
    if(!online) throw new Error('Local Functions did not become ready');
    await seed();
    const frontendEnv={...localEnv};
    for(const key of Object.keys(frontendEnv)) if(key.startsWith('VITE_')) delete frontendEnv[key];
    web=run(['node_modules/vite/bin/vite.js','--mode','emulator','--host','127.0.0.1','--port','5181','--strictPort'],{env:frontendEnv});
    console.log('\nTEST READY: http://127.0.0.1:5181/__test\nCtrl+C saves and stops. Periodic save and local workers run every 30 seconds.');
    let busy=false;
    timer=setInterval(async()=>{if(busy||stopping)return;busy=true;try{await workers();await save();}catch(e){console.error('Local maintenance:',e.message);}finally{busy=false;}},30000);
    for(const child of [emulator,web]) child.once('exit',()=>{if(!stopping){stopping=true;clearInterval(timer);web?.kill();emulator.kill();process.exitCode=1;}});
  } catch(e) { stopping=true; web?.kill();emulator.kill();throw e; }
}
const command=process.argv[2];
const action={start,seed,save,reset,workers}[command];
if(!action) throw new Error('Use start, seed, save, reset or workers');
await action();
if(command !== 'start') process.exit(0);
