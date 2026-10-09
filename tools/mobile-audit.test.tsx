import { render, act, cleanup, fireEvent, screen } from '@testing-library/react';
import { writeFileSync, mkdirSync } from 'node:fs';
import { AuthContext } from '../src/ui/auth/AuthProvider';
import { AppShell } from '../src/ui/AppShell';
import { emptyProfile } from '../src/domain/propertyProfile';
import { rememberProperty } from '../src/ui/host/propertyCache';
import { LandingPage } from '../src/ui/pages/LandingPage';
import { PricingPage } from '../src/ui/pages/PricingPage';
import { HostSignInPage } from '../src/ui/pages/HostSignInPage';
import { HostDashboardPage } from '../src/ui/pages/HostDashboardPage';
import { HostWallDesignPage } from '../src/ui/pages/HostWallDesignPage';
import { HostPropertySettingsPage } from '../src/ui/pages/HostPropertySettingsPage';
import { HostQrPage } from '../src/ui/pages/HostQrPage';
import { HostBillingPage } from '../src/ui/pages/HostBillingPage';
import { HostModerationPage } from '../src/ui/pages/HostModerationPage';
import { HostExportPage } from '../src/ui/pages/HostExportPage';
import { GuestWallPage } from '../src/ui/pages/GuestWallPage';
import { StayWallPage } from '../src/ui/pages/StayWallPage';
import { PrivacySafetyPage } from '../src/ui/pages/PrivacySafetyPage';
import { LegalDraftPage } from '../src/ui/pages/LegalDraftPage';
import { SafetyOperationsPage } from '../src/ui/pages/SafetyOperationsPage';
import { NotFoundPage } from '../src/ui/pages/NotFoundPage';
vi.mock('../src/lib/firebaseConfig', () => ({firebaseConfigured:true,firebaseConfig:{}}));
vi.mock('../src/lib/firebase', () => ({getFirebaseServices:async()=>null}));
let property:any;
vi.mock('../src/ui/host/billingStore', async original => ({...await original<any>(),loadActivationOffer:async()=>({status:'ok',value:{currency:'aud',trialAvailable:true,trialDays:28,trialEndsAt:1800000000,version:'fixture',plans:['monthly','annual'].map(plan=>({plan,price:plan==='monthly'?'A$15':'A$150',chargedPrice:plan==='monthly'?'A$15':'A$150',chargedAmount:plan==='monthly'?1500:15000,discount:null,disclosure:'Your 28-day free trial is followed by your selected subscription. Cancel from your dashboard.',acknowledgement:'I agree to the selected subscription after my trial.'}))}})}));
vi.mock('../src/ui/host/propertyStore', async original => ({...await original<any>(), loadProperty:async()=>({status:'ok',value:property}),listOwnedProperties:async()=>({status:'ok',value:[property]}),loadWallCounts:async()=>({status:'ok',value:{visible:3,hidden:0}})}));
vi.mock('../src/ui/host/moderationStore', async original => ({...await original<any>(),listWallPosts:async()=>({status:'ok',value:[{id:'sample',message:'A wonderful stay by the sea. We loved the garden and coastal walks.',displayName:'Mia and Sam',createdAt:'2026-09-01',stayedOn:'September 2026',visibility:'visible',pinned:false,photo:null,hold:null}]})}));
// Explicitly opt in: renders sample data to HTML for browser layout review; never connects to a live backend.
test.skipIf(process.env.DSB_MOBILE_AUDIT !== '1')('capture mobile page fixtures', async()=>{
 mkdirSync('artifacts/mobile-review',{recursive:true});
 property={id:'mobile-audit',ownerUid:'audit',name:'Seabreeze Cottage',slug:'seabreeze-cottage',lifecycle:'draft',mode:'private',foundationalPostCount:0,createdAt:'2026-09-01',updatedAt:'2026-09-01',billing:{trialEndsAt:null,currentPeriodEndsAt:null,lastPaymentAt:null,renewalAmount:null,renewalCurrency:null,renewalInterval:null},profile:emptyProfile()};
 const cases:any[]=[['home',<LandingPage/>,false],['pricing',<PricingPage/>,false],['sign-in',<HostSignInPage/>,false],['sign-up',<HostSignInPage initialMode="create"/>,false],['dashboard',<HostDashboardPage/>],['property-empty',<HostWallDesignPage propertyId="mobile-audit"/>],['public-editor',<HostWallDesignPage propertyId="mobile-audit" view="public"/>],['settings',<HostPropertySettingsPage propertyId="mobile-audit"/>],['qr',<HostQrPage propertyId="mobile-audit"/>],['billing',<HostBillingPage propertyId="mobile-audit"/>],['moderation',<HostModerationPage propertyId="mobile-audit"/>],['export',<HostExportPage propertyId="mobile-audit"/>],['guest-wall',<GuestWallPage propertySlug="demo-cottage"/>,false],['stay-wall',<StayWallPage propertySlug="demo-cottage"/>,false],['privacy-safety',<PrivacySafetyPage/>,false],['terms',<LegalDraftPage kind="terms"/>,false],['privacy',<LegalDraftPage kind="privacy"/>,false],['operations',<SafetyOperationsPage/>],['not-found',<NotFoundPage/>,false],['property-filled',<HostWallDesignPage propertyId="mobile-audit"/>],['qr-active',<HostQrPage propertyId="mobile-audit"/>],['billing-active',<HostBillingPage propertyId="mobile-audit"/>]];
 for(const [name,page,host=true] of cases){
  cleanup(); if(name==='property-filled') { property={...property,name:'Seabreeze Cottage and Coastal Garden Retreat',lifecycle:'active',mode:'live',profile:{...emptyProfile(),cover:{path:'sample',url:'/wall/memory-coast.webp',alt:'Coast',width:880,height:660},location:'A long coastal address in New South Wales, Australia',hostNotes:[{id:'note-mobile',style:'pinned',message:'We would love it if you would leave a memory of your stay.',photo:{path:'sample-note',url:'/wall/memory-coast.webp',alt:'Coast',width:880,height:660}}],stayHeading:'Welcome - make yourself at home in our coastal cottage',stayWelcome:'Everything you need for a comfortable stay is here. Enjoy the garden and the beach.',facts:[{term:'Wi-Fi',detail:'SEABREEZE-5G',note:'The password is in your welcome message.'}]}};} rememberProperty(property); window.history.replaceState(null,'',host?'/host/property/mobile-audit':'/');
  render(<AuthContext.Provider value={{status:host?'host':'signed-out',user:host?{uid:'audit',email:'host@example.com'} as any:null}}><AppShell>{page}</AppShell></AuthContext.Provider>);
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,40));});
  if(name==='settings'){for(let step=2;step<=3;step++){fireEvent.click(screen.getByRole('button',{name:'Next'})); await act(async()=>{}); writeFileSync('artifacts/mobile-review/settings-step-'+step+'.html','<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/styles.css"></head><body>'+document.body.innerHTML+'</body></html>');}}
  document.querySelectorAll('option').forEach(e=>{if(e.selected)e.setAttribute('selected','');else e.removeAttribute('selected');});
  document.querySelectorAll('input').forEach(e=>e.setAttribute('value',e.value));
  document.querySelectorAll('textarea').forEach(e=>e.textContent=e.value);
  writeFileSync(`artifacts/mobile-review/${name}.html`,`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/ui/guest/guest.css"><link rel="stylesheet" href="/src/ui/host/dashboardOverview.css"><title>Mobile review: ${name}</title></head><body>${document.body.innerHTML}</body></html>`);
 }
});





