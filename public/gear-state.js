(()=>{
 // P1-5 reopened (staging QA, 2026-08-27): "Gear shows 10 setups, Mission
 // reports 0" was three independent, uncoordinated gear-fetch/cache
 // implementations disagreeing with each other -- arsenal-safe.js's own
 // `state`, mission-inventory-fit.js's own `cache` (separate TTL, separate
 // in-flight fetch), and today.js's own synchronous peek at window.combos
 // with its OWN 15s cache that could freeze a pre-hydration `[]` (the
 // initial value set at boot, before ANY fetch has resolved) as "0 setups"
 // for the rest of that cache window -- and nothing ever told today.js to
 // refresh once the real data arrived, since it never listened for
 // arsenal-safe.js's own atlas:arsenal-loaded event. This module is the one
 // authoritative fetch + cache all three now delegate to. See
 // arsenal-safe.js, mission-inventory-fit.js, and today.js for the rewire.
 const TTL=30000;
 let cache={uid:null,at:0,combos:[],rods:[],reels:[],lures:[],loaded:false};
 let inflight=null;

 function emptyState(uid,loaded){return{uid,at:0,combos:[],rods:[],reels:[],lures:[],loaded}}

 async function fetchAll(uid){
  const q=encodeURIComponent(uid);
  const [combos,rods,reels,lures]=await Promise.all([
   api(`/rest/v1/combos?select=id,atlas_id,name,role,primary_lure,rod_id,reel_id&owner_id=eq.${q}&order=atlas_id.asc`),
   api(`/rest/v1/rods?select=id,brand,model,rod_type,length,power,action,lure_rating,line_rating,role&owner_id=eq.${q}&order=brand.asc,model.asc`),
   api(`/rest/v1/reels?select=id,brand,model,reel_type,line_type,line_test,line_color,role&owner_id=eq.${q}&order=brand.asc,model.asc`),
   api(`/rest/v1/lures?select=id,category,brand,model,color,size_weight,quantity,species,clarity,conditions,cover,assigned_combo_id,trailer_pairing,confidence,storage_location,last_used_at,catches_count,bites_count&owner_id=eq.${q}&order=category.asc,model.asc`),
  ]);
  cache={uid,at:Date.now(),combos:combos||[],rods:rods||[],reels:reels||[],lures:lures||[],loaded:true};
  // Kept for every reader that peeks at these globals directly (mentor-pro.js's
  // bestOwned(), gear-coach-lite.js, etc) instead of calling ensure() itself --
  // this is the ONE place that ever writes them now, not a second copy of them.
  window.combos=cache.combos.map(c=>({...c,rods:cache.rods.find(r=>r.id===c.rod_id)||null,reels:cache.reels.find(r=>r.id===c.reel_id)||null}));
  window.lures=cache.lures;
  // Go-to-combo restoration used to be duplicated in both arsenal-safe.js
  // and mission-inventory-fit.js (same localStorage key, same computation,
  // harmless but redundant); done once here instead, so it's set correctly
  // even if Gear is never visited before Mission needs it for scoring.
  try{const uid2=session?.user?.id,saved=uid2?localStorage.getItem(`atlas:goToCombo:${uid2}`):null;window.atlasGoToCombo=saved?window.combos.find(c=>String(c.id)===String(saved))||null:null}catch(e){console.error('FishWizz: could not restore go-to combo',e)}
  const detail={combos:cache.combos,rods:cache.rods,reels:cache.reels,lures:cache.lures,uid};
  document.dispatchEvent(new CustomEvent('atlas:gear-hydrated',{detail}));
  // Backward-compatible: gear-coach-lite.js, personal-hub.js, and (until its
  // own rewire below) mission-inventory-fit.js already listen for these two
  // events with this exact count shape -- keeping them dispatched from here,
  // the one real fetch, means those files don't also need editing today.
  document.dispatchEvent(new CustomEvent('atlas:arsenal-loaded',{detail:{combos:cache.combos.length,rods:cache.rods.length,reels:cache.reels.length,user_id:uid}}));
  document.dispatchEvent(new CustomEvent('atlas:tackle-loaded',{detail:{count:cache.lures.length,user_id:uid}}));
  return cache;
 }

 // P1-5 reopened AGAIN, as a release blocker (staging QA, 2026-08-27): after
 // the fix above shipped, Gear went from "shows 10 but a stray empty-state
 // card renders under it" to showing NOTHING -- 0 setups, 0 rods, 0 reels,
 // and Refresh not recovering them -- for an account confirmed to still
 // have all 10/12/10 records (Tackle, on its own separate, untouched fetch,
 // still correctly showed all 47). Two real, independent bugs found:
 //
 // 1. A genuine race with the boot-time auth event: supabase.auth.
 //    onAuthStateChange's very first firing (INITIAL_SESSION) dispatches
 //    atlas:account-changed for an ALREADY-signed-in user refreshing the
 //    page -- not just on an actual account switch (src/runtime/index.js's
 //    own `if (previous) window.atlasClearPersonalState?.()` guard only
 //    skips clearing *personal state*, not this dispatch). If that fires
 //    while this module's very first fetch is still in flight (a real,
 //    plausible timing -- that event only fires once the entire LEGACY
 //    chain has finished loading, which can easily land inside the same
 //    network-latency window as the first combos/rods/reels fetch), the old
 //    unconditional invalidate() here raced consumers into believing the
 //    account had no gear.
 // 2. A failed fetch here was being silently reported as a confirmed-empty
 //    result instead of a genuine error, which arsenal-safe.js's render()
 //    then couldn't tell apart from "this account really has 0 setups" --
 //    exactly what the current instruction requires fixed.
 //
 // Fixed by no longer trusting this module's own fetch as the SOLE source
 // for Gear's own page: arsenal-safe.js (see that file) now does its own
 // direct fetch again, exactly like the prior, working deployment, and
 // reports the result here via report() as a side effect -- so Gear's own
 // correctness no longer depends on this module's invalidate timing at all,
 // while other readers (today.js, mission-inventory-fit.js) still benefit
 // from a single shared fetch when Gear got there first. account-changed
 // now only invalidates when the account genuinely changed.
 function report(uid,{combos,rods,reels,lures}){
  if(!uid)return;
  cache={uid,at:Date.now(),combos:combos||[],rods:rods||[],reels:reels||[],lures:lures??cache.lures,loaded:true};
  window.combos=cache.combos.map(c=>({...c,rods:cache.rods.find(r=>r.id===c.rod_id)||null,reels:cache.reels.find(r=>r.id===c.reel_id)||null}));
  if(lures!==undefined)window.lures=cache.lures;
  try{const saved=localStorage.getItem(`atlas:goToCombo:${uid}`);window.atlasGoToCombo=saved?window.combos.find(c=>String(c.id)===String(saved))||null:null}catch(e){console.error('FishWizz: could not restore go-to combo',e)}
  document.dispatchEvent(new CustomEvent('atlas:gear-hydrated',{detail:{...cache}}));
 }

 async function ensure({force=false}={}){
  const uid=session?.user?.id;
  if(!uid){cache=emptyState(null,false);window.combos=[];window.lures=[];return cache}
  if(!force&&cache.uid===uid&&cache.loaded&&Date.now()-cache.at<TTL)return cache;
  if(inflight?.uid===uid&&!force)return inflight.promise;
  const promise=fetchAll(uid).catch(e=>{
   console.error('FishWizz: shared gear state load failed',e);
   // A failed fetch must never look identical to "confirmed zero" -- error
   // is a real, checkable field, not just an inferred loaded:false. Callers
   // that only render an empty state once loaded===true AND error is falsy
   // correctly show a retryable error instead of a false "no gear" message.
   return{...(cache.uid===uid&&cache.loaded?cache:emptyState(uid,false)),error:e?.message||String(e)};
  }).finally(()=>{if(inflight?.promise===promise)inflight=null});
  inflight={uid,promise};
  return promise;
 }

 function invalidate(reason){
  // Only actually drop the cache for a REAL account change -- not every
  // firing of atlas:account-changed, which (see the note above) also fires
  // once, harmlessly-in-intent, on a plain refresh for an already-signed-in
  // user. Checking cache.uid alone isn't enough: on the very FIRST load,
  // cache.uid is still null while that first fetch is in flight -- the
  // exact race that caused this reopening -- so also skip when a fetch is
  // already running for exactly this account; let it finish and populate
  // the cache normally instead of discarding its result out from under it.
  const incomingUid=reason?.user_id;
  if(incomingUid&&(incomingUid===cache.uid||incomingUid===inflight?.uid))return;
  cache=emptyState(null,false);
 }
 function forceReset(){cache=emptyState(null,false);inflight=null}
 function get(){return cache}
 function isHydratedFor(uid){return !!uid&&cache.uid===uid&&cache.loaded}

 document.addEventListener('atlas:account-changed',e=>invalidate(e.detail));
 document.addEventListener('atlas:inventory-changed',()=>{forceReset();ensure({force:true}).catch(()=>{})});

 window.FishWizzGearState={ensure,get,invalidate:forceReset,report,isHydratedFor};

 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{gearState:{ensure,get,invalidate,forceReset,report,isHydratedFor}});
})();
