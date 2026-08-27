(()=>{
 // P2-10 ("guest work is not silently discarded"): the one real way a guest
 // loses in-progress Mission/Catch input is the Google OAuth round trip --
 // signInWithOAuth navigates the whole tab away and back, which wipes every
 // in-memory DOM value including whatever they had just typed. A plain
 // sign-in-by-email attempt does NOT navigate away (this is a classic-script
 // SPA, nothing reloads on a same-tab auth call), so those fields already
 // survive on their own; this covers the one path that doesn't, plus a
 // literal page refresh, for guest and signed-in users alike.
 const $=id=>document.getElementById(id);
 const FIELDS=['mWater','mTarget','mAccess','mClarity','mCover','mDepth','mWind','mLight','mCurrent',
  'cWater','cSpot','cSpecies','cLure','cColor','cLearn'];
 const KEY='fishwizz:guest_draft';
 function readDraft(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){return{}}}
 function writeDraft(d){try{localStorage.setItem(KEY,JSON.stringify(d))}catch(e){/* private mode / quota -- draft just doesn't persist */}}
 // Defense in depth alongside restore()'s guard above: never let a corrupted
 // value get INTO storage in the first place either, not just refuse it on
 // the way back out.
 function saveField(id){const el=$(id);if(!el)return;const d=readDraft();if(el.value&&!window.FishWizzGuard?.isEmailShaped?.(el.value))d[id]=el.value;else delete d[id];writeDraft(d)}
 // P0-1 reopened (staging QA, 2026-08-27): this was the actual live-verified
 // leak mechanism -- a draft value is restored here with zero validation,
 // unlike every other save/restore path field-guard.js already covers. A
 // corrupted value (an email, saved before this fix existed, or from any
 // future bug) would silently keep reappearing on every single refresh
 // forever, since nothing ever purged it from storage. setGuardedValue()
 // both refuses to apply it AND the corrupted key is deleted from the
 // stored draft right here, so it can only ever leak once, not repeatedly --
 // rejectIfEmailShaped() elsewhere in this app only ever blocked a *save*,
 // never cleaned up a bad value already sitting in storage from before it
 // existed. window.FishWizzGuard is guaranteed loaded before this runs (see
 // the LEGACY order comment in src/runtime/index.js) -- if it is somehow
 // still missing, fail closed and do not restore, rather than trust an
 // unvalidated value.
 //
 // Only ever fills an EMPTY field -- never overwrites something the user (or
 // fillFromMission()/repeatMission()) already put there, so this can't clash
 // with the real Mission/spot context those already apply.
 function restore(){
  const d=readDraft();const guard=window.FishWizzGuard;let dirty=false;
  FIELDS.forEach(id=>{
   const el=$(id);
   if(!el||el.value||!(id in d))return;
   if(!guard){dirty=false;return} // guard not present -- do not restore unvalidated state
   if(!guard.setGuardedValue(el,d[id],id)){delete d[id];dirty=true}
  });
  if(dirty)writeDraft(d);
 }
 function clearDraft(){try{localStorage.removeItem(KEY)}catch(e){}}
 function wire(){FIELDS.forEach(id=>{const el=$(id);if(el&&!el.dataset.guestDraftWired){el.dataset.guestDraftWired='1';el.addEventListener('input',()=>saveField(id))}})}
 // Successfully building a Mission or saving a catch means the draft did its
 // job -- clear it so a stale value doesn't reappear next time those fields
 // are legitimately empty for an unrelated reason.
 document.addEventListener('atlas:mission-built',clearDraft);
 document.addEventListener('atlas:catch-saved',clearDraft);
 function boot(){restore();wire()}
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
 // mission-v3.js's own extra plan-condition fields (mSeason/mSky/...) are
 // injected asynchronously after DOMContentLoaded -- not covered by FIELDS
 // (P2-10 only names Mission/gear/catch drafts, and those extra condition
 // fields already reset with the rest of the Mission form each Mission
 // build), so no re-wire pass is needed the way location-state.js needs one.
 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{guestDraft:{FIELDS,readDraft,writeDraft,restore,wire,clearDraft,KEY}});
})();
