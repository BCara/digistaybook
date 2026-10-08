import {execFileSync} from 'node:child_process';
const projectId='digistaybook-cbert';
const emails=['clb.bertram@gmail.com','caralbertram@gmail.com','jjbdunleavy@gmail.com','codebertcreations@gmail.com'];
const apply=process.argv.includes('--apply');
const token=execFileSync(process.platform==='win32'?'cmd.exe':'gcloud',process.platform==='win32'?['/d','/s','/c','gcloud auth print-access-token']:['auth','print-access-token'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const response=await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,{headers:{Authorization:`Bearer ${token}`,'X-Goog-User-Project':projectId}});
const config=await response.json();
if(!response.ok)throw new Error(`Configuration read failed (${response.status}): ${config.error?.message}`);
console.log(JSON.stringify({projectId,mfa:config.mfa,signIn:config.signIn?{email:config.signIn.email?.enabled,google:config.signIn.allowDuplicateEmails}:null}));
if(process.argv.includes('--initialize')) {
  const initialized=await fetch(`https://identitytoolkit.googleapis.com/v2/projects/${projectId}/identityPlatform:initializeAuth`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'X-Goog-User-Project':projectId,'Content-Type':'application/json'},body:'{}'});
  const result=await initialized.json();if(!initialized.ok)throw Error(`Identity Platform enablement failed (${initialized.status}): ${result.error?.message}`);
  console.log('Identity Platform enabled for '+projectId);
}
async function api(path,body){
  const r=await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'X-Goog-User-Project':projectId,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await r.json();if(!r.ok)throw Error(`Auth request failed (${r.status}): ${result.error?.message}`);return result;
}
for(const email of emails){
  let user=(await api('accounts:lookup',{email:[email]})).users?.[0];
  if(apply&&!user){const created=await api('accounts',{email});user=(await api('accounts:lookup',{localId:[created.localId]})).users?.[0];}
  if(apply&&user){if(user.disabled)throw Error(`Account disabled: ${email}`);await api('accounts:update',{localId:user.localId,customAttributes:JSON.stringify({...JSON.parse(user.customAttributes||'{}'),admin:true})});user=(await api('accounts:lookup',{localId:[user.localId]})).users?.[0];}
  console.log(JSON.stringify({email,exists:!!user,uid:user?.localId,emailVerified:user?.emailVerified===true,reviewer:JSON.parse(user?.customAttributes||'{}').admin===true,factors:user?.mfaInfo?.map(f=>({totp:!!f.totpInfo}))??[]}));
  // Google can return the legacy googlemail.com address for the same approved
  // Gmail mailbox. Authorise its existing verified Google identity by UID;
  // never create aliases or use email matching as runtime authorisation.
  const alias=email.replace(/@gmail\.com$/,'@googlemail.com');
  let linked=(await api('accounts:lookup',{email:[alias]})).users?.[0];
  if(linked){
    const verifiedGoogle=linked.emailVerified===true&&linked.providerUserInfo?.some(p=>p.providerId==='google.com'&&p.email?.toLowerCase()===alias);
    if(!verifiedGoogle||linked.disabled)throw Error(`Alias requires identity review: ${alias}`);
    if(apply){await api('accounts:update',{localId:linked.localId,customAttributes:JSON.stringify({...JSON.parse(linked.customAttributes||'{}'),admin:true})});linked=(await api('accounts:lookup',{localId:[linked.localId]})).users?.[0];}
    console.log(JSON.stringify({approvedEmail:email,googleSignInEmail:alias,uid:linked.localId,reviewer:JSON.parse(linked.customAttributes||'{}').admin===true,emailVerified:linked.emailVerified===true}));
  }
}
if(apply){
  const providers=config.mfa?.providerConfigs??[];
  const totp=providers.find(p=>p.totpProviderConfig);
  const providerConfigs=[...providers.filter(p=>!p.totpProviderConfig),{...totp,state:'ENABLED',totpProviderConfig:{...totp?.totpProviderConfig,adjacentIntervals:1}}];
  const update=await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=mfa`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'X-Goog-User-Project':projectId,'Content-Type':'application/json'},body:JSON.stringify({mfa:{...config.mfa,state:"ENABLED",providerConfigs}})});
  const result=await update.json();if(!update.ok)throw Error(`MFA update failed (${update.status}): ${result.error?.message}`);
  console.log(JSON.stringify({projectId,mfa:result.mfa}));
}
