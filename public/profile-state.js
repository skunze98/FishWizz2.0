(()=>{
 // P1 ("persist onboarding and Mission state" -- staging QA, 2026-08-27):
 // "onboarding saved nickname 'QA test Angler,' but after refresh Mission
 // returned to 'Ready, shunze?'." Root cause -- confirmed by reading
 // pwa.js's lazy-load groups, not guessed: the ONLY thing that ever fetched
 // the profile and set window.atlasAnglerProfile was angler-profile.js,
 // which pwa.js only ever loads once the ACCOUNT page is visited (it is
 // grouped under `account:[...]`, a separate lazy group from
 // `mission:[...]`, which is what actually loads on a fresh page load /
 // refresh landing on Mission -- the default page). A user who refreshes
 // and stays on Mission never triggers angler-profile.js at all, so
 // window.atlasAnglerProfile is simply never populated and today.js's
 // greeting permanently falls back to the account's email-derived name --
 // not a timing race that self-corrects, a fetch that was never scheduled.
 //
 // This is the exact "one authoritative fetch, shared by every page-group
 // instead of only the page that happens to load it" pattern already
 // applied to gear (see gear-state.js) -- this file is that same pattern
 // for the angler profile, loaded eagerly in the main LEGACY chain
 // (src/runtime/index.js) rather than behind any lazy page group, so the
 // Mission-page greeting and any other early consumer can rely on it
 // without depending on which page the account happens to land on.
 let cache={uid:null,profile:null,at:0,loaded:false};
 let inflight=null;

 async function fetchProfile(uid){
  await api('/rest/v1/rpc/bootstrap_atlas_account',{method:'POST',body:'{}'});
  const rows=await api(`/rest/v1/profiles?select=*&id=eq.${encodeURIComponent(uid)}&limit=1`);
  const profile=rows?.[0]||null;
  cache={uid,profile,at:Date.now(),loaded:true};
  window.atlasAnglerProfile=profile;
  document.dispatchEvent(new CustomEvent('atlas:profile-loaded',{detail:profile}));
  return cache;
 }

 async function ensure({force=false}={}){
  const uid=session?.user?.id;
  if(!uid){cache={uid:null,profile:null,at:0,loaded:false};window.atlasAnglerProfile=null;return cache}
  if(!force&&cache.uid===uid&&cache.loaded)return cache;
  if(inflight?.uid===uid&&!force)return inflight.promise;
  const promise=fetchProfile(uid).catch(e=>{
   console.error('FishWizz: profile load failed',e);
   // Same "a real failure is never indistinguishable from a genuinely
   // unnamed account" rule gear-state.js already established: never let a
   // fetch failure quietly render as "no nickname" -- carry a real error a
   // caller can check instead.
   return{...(cache.uid===uid&&cache.loaded?cache:{uid,profile:null,at:0,loaded:false}),error:e?.message||String(e)};
  }).finally(()=>{if(inflight?.promise===promise)inflight=null});
  inflight={uid,promise};
  return promise;
 }

 // Called by onboarding.js/angler-profile.js's own save flows, which
 // already have the freshly-saved row in hand from their own POST response
 // -- avoids a redundant re-fetch of the exact row that was just written.
 function report(uid,profile){
  if(!uid)return;
  cache={uid,profile,at:Date.now(),loaded:true};
  window.atlasAnglerProfile=profile;
 }

 function invalidate(reason){
  const incomingUid=reason?.user_id;
  if(incomingUid&&(incomingUid===cache.uid||incomingUid===inflight?.uid))return;
  cache={uid:null,profile:null,at:0,loaded:false};
 }
 function get(){return cache}

 document.addEventListener('atlas:account-changed',e=>invalidate(e.detail));
 // onboarding.js's finish() and angler-profile.js's saveProfile() both
 // already dispatch this with the freshly-saved row -- treat it as the new
 // authoritative cache instead of leaving this store to go stale until its
 // next independent fetch.
 document.addEventListener('atlas:profile-ready',e=>{if(e.detail)report(session?.user?.id,e.detail)});

 window.FishWizzProfileState={ensure,get,invalidate,report};

 // Deliberately NOT self-triggering an eager fetch here (unlike this file's
 // header comment might suggest at a glance): a fetch that fires the moment
 // THIS script's own network response lands, before every later LEGACY
 // script has had a chance to load and register its own atlas:profile-loaded
 // listener, would just trade one missed-hydration bug for a new missed-
 // dispatch one. gear-state.js's own real pattern -- confirmed by reading
 // it, not assumed -- is consumer-pulled, not self-pushed: it has no eager
 // trigger of its own either, because every real consumer (today.js,
 // arsenal-safe.js, mission-inventory-fit.js) calls ensure() itself at its
 // own boot/render time and awaits the result directly, so there's nothing
 // to race. today.js's own snapshot() now does exactly that for this store
 // (see today.js) -- that direct, awaited call, not a dispatched event, is
 // what actually fixes "the greeting shows the wrong name after a refresh
 // that lands on Mission."
 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{profileState:{ensure,get,invalidate,report}});
})();
