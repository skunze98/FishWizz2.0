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

 async function ensure({force=false}={}){
  const uid=session?.user?.id;
  if(!uid){cache=emptyState(null,false);window.combos=[];window.lures=[];return cache}
  if(!force&&cache.uid===uid&&cache.loaded&&Date.now()-cache.at<TTL)return cache;
  if(inflight?.uid===uid&&!force)return inflight.promise;
  const promise=fetchAll(uid).catch(e=>{
   console.error('FishWizz: shared gear state load failed',e);
   // A failed fetch must never look identical to "confirmed zero" -- callers
   // that only render an empty state on loaded:true correctly keep showing
   // their loading/retry UI instead of a false "no gear" message.
   return cache.uid===uid&&cache.loaded?cache:emptyState(uid,false);
  }).finally(()=>{if(inflight?.promise===promise)inflight=null});
  inflight={uid,promise};
  return promise;
 }

 function invalidate(){cache=emptyState(null,false);inflight=null}
 function get(){return cache}
 function isHydratedFor(uid){return !!uid&&cache.uid===uid&&cache.loaded}

 document.addEventListener('atlas:account-changed',invalidate);
 document.addEventListener('atlas:inventory-changed',()=>{invalidate();ensure({force:true}).catch(()=>{})});

 window.FishWizzGearState={ensure,get,invalidate,isHydratedFor};

 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{gearState:{ensure,get,invalidate,isHydratedFor}});
})();
