(()=>{
 // P0-1 (QA tracker): identity data (the signed-in email) must never enter
 // a fishing-domain field (water, spot, species, lure, notes). An exhaustive
 // search of every write into those fields found no application code that
 // assigns email into them -- every email usage in this codebase is a safe
 // display-name fallback that never touches fishing state (see DEPLOYMENT.md
 // for the full account of that investigation). Since no single injection
 // site could be confirmed, this implements exactly what the acceptance
 // criteria independently require regardless of root cause: reject an
 // email-shaped value at every real save/restore choke point, rather than
 // guessing at and "fixing" a specific line that may not be the real cause.
 function isEmailShaped(v){const s=String(v??'').trim();if(!s)return false;return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)}
 function rejectIfEmailShaped(value,fieldLabel){if(!isEmailShaped(value))return{ok:true,value};return{ok:false,message:`"${value}" looks like an email address, not a ${fieldLabel}. Enter the real ${fieldLabel} instead.`}}
 // P0-1 reopened (staging QA, 2026-08-27): a real, live-verified repro
 // (refresh -> Mission -> Gear -> Mission puts the signed-in email in the
 // Water field) proved the original "no injection site found" conclusion
 // above was wrong, or at least incomplete -- it predates guest-draft.js
 // (added later, in the P2 batch), which restores a previously-saved
 // localStorage value into #mWater/#cWater with ZERO validation, unlike
 // every other save/restore path this file already guards. That's the
 // single most likely real mechanism: a stale draft saved before this guard
 // existed (or from any future bug) keeps getting silently restored on
 // every refresh, forever, until the corrupted value itself is purged --
 // which rejectIfEmailShaped()'s save-time-only check never did.
 //
 // setGuardedValue is the one enforcement point every direct `.value =`
 // assignment into a fishing-domain field should go through from here on,
 // instead of each call site reimplementing (or forgetting) its own check.
 // Unlike rejectIfEmailShaped (which reports back to the caller so a save
 // can be blocked with a user-facing message), this is for the *fallback/
 // restore* call sites named in the instruction -- a rejected assignment is
 // silently skipped (the field is left however it already was, never
 // cleared out from under a value the user may be mid-typing) and logged
 // for diagnosis if the P0-1 staging diagnostic module is present.
 function setGuardedValue(el,value,label){
  if(!el)return false;
  const v=value==null?'':String(value);
  if(isEmailShaped(v)){
   console.warn(`FishWizz: refused to set ${label||el.id||'a fishing field'} to an email-shaped value.`);
   // Always dispatched, not gated on the diagnostic module having loaded
   // yet -- field-guard.js loads first in LEGACY, well before
   // diag-identity-p0.js (last), so a boot-time block (guest-draft.js's
   // restore() purging a corrupted saved value, the actual scenario this
   // exists to catch) would otherwise fire before anything is listening.
   // dispatchEvent with zero listeners is a no-op, not an error. Guarded for
   // the same plain-Node testability every other function above this line
   // has (this function's own logic needs no real DOM, only its diagnostic
   // side effect does).
   if(typeof document!=='undefined')document.dispatchEvent(new CustomEvent('atlas:diag-guard-blocked',{detail:{field:label||el.id||null}}));
   return false;
  }
  el.value=v;
  return true;
 }
 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{fieldGuard:{isEmailShaped,rejectIfEmailShaped,setGuardedValue}});
 if(typeof window==='undefined')return; // testable in plain Node up to here; nothing below touches fishing fields
 window.FishWizzGuard={isEmailShaped,rejectIfEmailShaped,setGuardedValue};
 const $=id=>document.getElementById(id);let failures=0;function banner(msg,type='warn'){let b=$('fieldGuard');if(!b){b=document.createElement('div');b.id='fieldGuard';b.className='status';document.querySelector('main')?.prepend(b)}b.textContent=msg;b.className='status '+type;b.hidden=false}function hide(){if($('fieldGuard'))$('fieldGuard').hidden=true}function health(){const issues=[];if(!navigator.onLine)issues.push('offline');if(typeof L==='undefined')issues.push('map library');if(typeof api!=='function')issues.push('data connection');if(issues.length)banner(`Field mode degraded: ${issues.join(', ')}. Saved app features remain available.`,'warn');else hide()}window.addEventListener('error',e=>{failures++;if(failures<=3)banner('Atlas recovered from a screen error. If something looks incomplete, retry the action or reopen this tab.','warn')});window.addEventListener('unhandledrejection',()=>{failures++;if(failures<=3)banner('A live-data request did not finish. Atlas kept the app running; retry when signal improves.','warn')});window.addEventListener('offline',health);window.addEventListener('online',()=>{health();stat?.('Connection restored. Live data is available again.','ok')});document.addEventListener('visibilitychange',()=>{if(!document.hidden){health();window.AtlasMap?.invalidateSize?.()}});document.addEventListener('DOMContentLoaded',()=>{setTimeout(health,1500);document.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{if(navigator.vibrate&&matchMedia('(pointer:coarse)').matches)navigator.vibrate(8)},{passive:true}))})})();