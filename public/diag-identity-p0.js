(()=>{
 // ============================================================================
 // TEMPORARY DIAGNOSTIC -- P0-1 (identity data leaking into fishing-domain
 // state), added 2026-08-27 at the user's explicit request to support an
 // authenticated staging QA pass. P0-1's defensive guard (field-guard.js) was
 // shipped without ever confirming a real code path that causes the leak --
 // this module exists to catch that path for real, in a live multi-account
 // session, without ever recording anything sensitive.
 //
 // TO REMOVE once P0-1 is confirmed fixed (or a root cause is found and
 // fixed directly): delete this file and its one entry in the LEGACY array
 // in src/runtime/index.js. Nothing else references it.
 //
 // Safety contract -- read before touching this file:
 //   - NEVER logs an email address, access/refresh token, password, or any
 //     other credential.
 //   - NEVER logs a coordinate (lat/lon), water name, species, or any other
 //     fishing-domain VALUE -- only whether a value is present (boolean) and
 //     which account fingerprint produced it.
 //   - The "account fingerprint" is a short, one-way, non-cryptographic hash
 //     (fnv1a) of the signed-in user id. It is NOT reversible to the real id
 //     and is not intended to be -- its only job is letting two log lines be
 //     compared as "same account" / "different account".
 // ============================================================================
 function fnv1a(str){let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=(h*0x01000193)>>>0}return h.toString(16).padStart(8,'0')}
 function fp(){const id=typeof session!=='undefined'?session?.user?.id:window.session?.user?.id;return id?fnv1a(String(id)):'signed-out'}

 const LOG_LIMIT=200;
 const buf=[];
 function log(kind,detail){
  const entry={t:new Date().toISOString(),kind,account:fp(),...detail};
  buf.push(entry);
  if(buf.length>LOG_LIMIT)buf.shift();
  const label=`[FW-DIAG-P0] ${kind}`;
  if(kind.indexOf('MISMATCH')===0)console.error(label,entry);else console.info(label,entry);
  return entry;
 }

 // Tag a piece of fishing-domain state with the account fingerprint that
 // produced it. Plain property on the same ad-hoc object every module
 // already uses (window.lastMission etc are not classes) -- deliberately not
 // hidden/non-enumerable, since this is a temporary tool meant to be easy to
 // inspect, not a stealth marker.
 function tag(obj){if(obj&&typeof obj==='object')obj.__diagOwner=fp();return obj}
 function checkOwner(label,obj){
  if(!obj||typeof obj!=='object'||!('__diagOwner' in obj))return null;
  const owner=obj.__diagOwner,current=fp();
  if(owner!==current)return log(`MISMATCH:${label}`,{owner,current});
  return null;
 }

 function boot(){
  // --- account transitions --------------------------------------------
  document.addEventListener('atlas:account-changed',e=>{
   log('account-changed',{
    previous_user_id_present:!!e.detail?.previous_user_id,
    current_user_id_present:!!e.detail?.user_id,
    mission_present:!!window.lastMission,
    water_present:!!window.selectedWater,
    position_present:!!window.atlasFishingLocation,
    session_present:!!window.atlasActiveSession,
    weather_present:!!window.atlasLiveWeather,
   });
  });
  document.addEventListener('atlas:account-state-cleared',()=>{
   log('state-cleared',{mission_present:!!window.lastMission,water_present:!!window.selectedWater,position_present:!!window.atlasFishingLocation});
  });

  // --- tag fishing-domain state the moment it's produced ---------------
  document.addEventListener('atlas:mission-built',()=>{tag(window.lastMission);tag(window.atlasLiveWeather);log('mission-built',{})});
  document.addEventListener('atlas:water-selected',()=>{tag(window.selectedWater);log('water-selected',{position_present:!!window.atlasFishingLocation})});
  // atlasFishingLocation is reassigned to a fresh object on every position
  // update (map.js's updatePositionCard), so re-tag the fresh object here.
  document.addEventListener('atlas:fishing-position',()=>{tag(window.atlasFishingLocation)});
  document.addEventListener('atlas:mission-invalidated',e=>log('mission-invalidated',{reason:e.detail?.reason}));
  document.addEventListener('atlas:catch-saved',()=>log('catch-saved',{}));
  document.addEventListener('atlas:session-ended',()=>log('session-ended',{}));

  // --- correlate with field-guard.js's rejections, without ever logging
  // the rejected value itself ------------------------------------------
  // setGuardedValue() (the fallback/restore-path guard added alongside this
  // module, reopened P0-1) dispatches this event itself rather than being
  // wrapped -- it's called from many files, wrapping would need finding and
  // patching every one of them the way this only needs one listener.
  document.addEventListener('atlas:diag-guard-blocked',e=>log('guard-blocked',{field:e.detail?.field||null}));
  const g=window.FishWizzGuard;
  if(g?.rejectIfEmailShaped&&!g.__diagWrapped){
   const orig=g.rejectIfEmailShaped;
   g.rejectIfEmailShaped=(value,label)=>{
    const result=orig(value,label);
    if(result&&!result.ok)log('email-shape-rejected',{field:label});
    return result;
   };
   g.__diagWrapped=true;
  }

  // --- periodic re-check: catches a tagged object that survived an
  // account switch it shouldn't have, not just a leak at creation time.
  // A 5s interval doing three cheap property reads is negligible overhead;
  // stop it if the tab is hidden to avoid burning cycles in a background tab.
  let timer=setInterval(sweep,5000);
  document.addEventListener('visibilitychange',()=>{
   clearInterval(timer);
   if(!document.hidden)timer=setInterval(sweep,5000);
  });
  function sweep(){
   checkOwner('lastMission',window.lastMission);
   checkOwner('selectedWater',window.selectedWater);
   checkOwner('atlasFishingLocation',window.atlasFishingLocation);
   checkOwner('atlasLiveWeather',window.atlasLiveWeather);
  }

  log('diag-loaded',{});
 }

 window.__fwDiagLog=buf;
 window.__fwDiagDump=()=>{console.table(buf);return buf};

 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();

 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{diagIdentityP0:{fnv1a,tag,checkOwner,log,buf}});
})();
