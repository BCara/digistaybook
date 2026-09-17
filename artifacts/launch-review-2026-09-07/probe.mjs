// Isolated review evidence. Writes synthetic data ONLY to local demo emulators.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getBytes } from 'firebase/storage';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const app = initializeApp({projectId:'demo-digistaybook'});
const uid = 'launch-review-host';
await getAuth(app).getUser(uid).catch(() => getAuth(app).createUser({uid,email:'review-host@example.test',password:'Audit-local-2026!',displayName:'Review Host'}));
const env = await initializeTestEnvironment({
  projectId:'demo-digistaybook',
  firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')},
  storage:{host:'127.0.0.1',port:9199,rules:readFileSync('storage.rules','utf8')}
});
const admin = getFirestore(app);
const profile = {theme:'linen',displayWallOff:false,location:'Demo coast',hosts:'Review Host',welcome:'Welcome to Audit Cottage',stayHeading:'Welcome to your stay',stayWelcome:'Enjoy this synthetic test property.',stayTip:'A local tip.',facts:[{term:'Wi-Fi',detail:'AUDIT-PRIVATE-PASSWORD',note:'Synthetic data only'}],hostNote:'A welcome note from the host'};
await admin.doc('properties/audit-live').set({ownerUid:uid,name:'Audit Cottage',slug:'audit-cottage',mode:'live',lifecycle:'active',foundationalPostCount:1,profile,billing:{lastPaymentAt:'2026-09-01T00:00:00Z'},createdAt:'2026-09-07T00:00:00Z'});
await admin.doc('properties/audit-draft').set({ownerUid:uid,name:'Audit Draft',slug:'audit-draft',mode:'sandbox',lifecycle:'draft',profile,createdAt:'2026-09-06T00:00:00Z'});
await admin.doc('properties/audit-live/posts/audit-visible').set({visibility:'visible',message:'A saved emulator memory',displayName:'Test Guest',createdAt:'2026-09-07T00:00:00Z',stayedOn:'September 2026',pinned:false});
await admin.doc('properties/audit-live/posts/audit-held').set({visibility:'hidden_pending_review',message:'A memory waiting for review',displayName:'Another Test Guest',createdAt:'2026-09-07T00:00:00Z',hold:{source:'automated_screening',reason:'screening_flag',detail:'Synthetic hold'}});
await admin.doc('properties/audit-live/posts/audit-restricted').set({visibility:'restricted',message:'SYNTHETIC RESTRICTED CONTENT',createdAt:'2026-09-07T00:00:00Z'});
const guest = env.unauthenticatedContext();
const owner = env.authenticatedContext(uid,{firebase:{sign_in_provider:'password'}});
const result={};
const publicDoc = await getDoc(doc(guest.firestore(),'properties','audit-live'));
result.publicReadIncludesHouseGuidance = publicDoc.data().profile.facts[0].detail === 'AUDIT-PRIVATE-PASSWORD';
result.publicReadIncludesBilling = Boolean(publicDoc.data().billing);
await admin.doc('properties/audit-cancelled').set({ownerUid:uid,name:'Cancelled but paid through October',mode:'live',lifecycle:'cancelled_pending_end',billing:{currentPeriodEndsAt:'2026-10-07T00:00:00Z'}});
try { await getDoc(doc(guest.firestore(),'properties','audit-cancelled')); result.cancelledBeforePeriodEndDenied=false; }
catch { result.cancelledBeforePeriodEndDenied=true; }
await admin.doc('properties/audit-wall-off').set({ownerUid:uid,name:'Public wall switched off',mode:'live',lifecycle:'active',profile:{...profile,displayWallOff:true}});
result.publicReadIgnoresDisplayWallOff = (await getDoc(doc(guest.firestore(),'properties','audit-wall-off'))).exists();
result.ownerCanReadRestrictedMessage = (await getDoc(doc(owner.firestore(),'properties','audit-live','posts','audit-restricted'))).data().message === 'SYNTHETIC RESTRICTED CONTENT';
await setDoc(doc(owner.firestore(),'properties','audit-forged-fields'),{ownerUid:uid,name:'Synthetic forged fields',slug:'audit-forged',mode:'sandbox',lifecycle:'draft',billing:{lastPaymentAt:'2099-01-01'},retentionState:'held',foundationalPostCount:999});
result.clientCanSupplyServerFieldsAtCreation = true;
await updateDoc(doc(owner.firestore(),'properties','audit-draft'),{mode:'live',foundationalPostCount:999,arbitraryField:'accepted'});
result.clientCanChangeModeCountAndUnknownFields = true;
const path='properties/audit-draft/media/audit.jpg';
await uploadBytes(ref(owner.storage(),path),new Uint8Array([255,216,255,219]),{contentType:'image/jpeg',cacheControl:'public, max-age=31536000'});
const url = await getDownloadURL(ref(owner.storage(),path));
try { await getBytes(ref(guest.storage(),path)); result.guestSdkDraftPhotoDenied=false; }
catch { result.guestSdkDraftPhotoDenied=true; }
const response = await fetch(url);
result.unauthenticatedDraftPhotoTokenUrlStatus = response.status;
writeFileSync(new URL('probe-results.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
await env.cleanup();
process.exit(0);
