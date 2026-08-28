(()=>{
 const $=id=>document.getElementById(id);let host=null,loading=false,refreshTimer=null,lastSnapshot=null,lastSnapshotAt=0;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const label=v=>({new:'Brand new',casual:'Casual angler',intermediate:'Intermediate',advanced:'Advanced',shore:'Shore',boat:'Boat',both:'Shore + boat',none:'No gear needed',some:'Some gear',ready:'Arsenal ready'})[v]||v||'';
 function ensure(){if(host?.isConnected)return host;const mission=$('mission');if(!mission)return null;const hero=mission.querySelector('.hero');host=document.createElement('section');host.id='atlasToday';host.className='card atlas-today';(hero||mission.firstElementChild)?.insertAdjacentElement('afterend',host);return host}
 function css(){if($('atlasTodayStyles'))return;const s=document.createElement('style');s.id='atlasTodayStyles';s.textContent=`.atlas-today{margin:12px 0 16px}.atlas-today-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.atlas-today h2{margin:.2rem 0 .3rem}.atlas-today-kicker{margin:0}.atlas-today-status{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.atlas-today-status .pill{margin:0}.atlas-next{padding:14px;border:1px solid rgba(225,191,99,.26);border-radius:14px;background:linear-gradient(180deg,rgba(225,191,99,.08),rgba(255,255,255,.025));margin:12px 0}.atlas-next h3{margin:.15rem 0 .35rem}.atlas-today-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.atlas-today-actions button{min-height:46px}.atlas-memory{margin-top:10px}.atlas-memory details{border-top:1px solid rgba(255,255,255,.08);padding-top:10px}.atlas-memory summary{cursor:pointer;min-height:42px;display:flex;align-items:center;font-weight:700}.atlas-memory-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.atlas-memory-item{padding:10px;border-radius:11px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.atlas-memory-item b{display:block;margin-bottom:3px}.atlas-memory-item button{margin-top:8px;width:100%;min-height:42px}@media(max-width:760px){.atlas-today-head{display:grid}.atlas-today-actions,.atlas-memory-grid{grid-template-columns:1fr}.atlas-today-actions button{width:100%}}`;document.head.appendChild(s)}
 function lastMission(){if(!session?.user)return null;try{return JSON.parse(localStorage.getItem(`atlas:lastMission:${session.user.id}`)||'null')}catch(e){console.error('FishWizz: could not read the last saved Mission',e);return null}}
 function ago(value){if(!value)return'';const ms=Date.now()-new Date(value).getTime();if(!Number.isFinite(ms)||ms<0)return'';const mins=Math.floor(ms/60000);if(mins<1)return'just now';if(mins<60)return`${mins} min ago`;const hrs=Math.floor(mins/60);if(hrs<24)return`${hrs} hr${hrs===1?'':'s'} ago`;const d=Math.floor(hrs/24);return`${d} day${d===1?'':'s'} ago`}
 // P1-5 reopened (staging QA, 2026-08-27): this used to synchronously peek
 // at window.combos/window.lures and cache whatever it saw -- including [],
 // the initial value set before ANY fetch has resolved -- for 15 seconds,
 // with no way to tell "confirmed empty" apart from "not loaded yet". That
 // frozen 0 could then outlive its own 15s window indefinitely, since
 // nothing here ever listened for arsenal-safe.js's load finishing.
 // snapshot() now always awaits the one shared, authoritative gear loader
 // (gear-state.js -- the same one arsenal-safe.js and mission-inventory-
 // fit.js use) instead of guessing from a synchronous peek, so `combos`/
 // `lures` below are only ever real, post-hydration numbers -- this file's
 // own render() only shows an empty/low-gear message once this has resolved.
 // P1 ("persist onboarding and Mission state" -- staging QA, 2026-08-27):
 // "onboarding saved nickname 'QA test Angler,' but after refresh Mission
 // returned to 'Ready, shunze?'." This used to rely entirely on
 // angler-profile.js dispatching atlas:profile-loaded at some point --
 // which only ever happens once the ACCOUNT page has been visited (see
 // profile-state.js's own header for the full root cause: pwa.js only lazy-
 // loads angler-profile.js as part of the `account` page group, a separate
 // group from `mission`, so a refresh that lands back on Mission never
 // triggered it at all). snapshot() now awaits the shared profile store
 // directly, the same way it already awaits the shared gear store below --
 // render()'s greeting is correct on the very first paint, not dependent on
 // whether some other page happens to have loaded first.
 async function snapshot(force=false){
  if(!session?.user)return{combos:0,lures:0,catches:0,recent:[],last:null};
  if(!force&&lastSnapshot&&Date.now()-lastSnapshotAt<15000)return{...lastSnapshot,last:lastMission()};
  try{
   const uid=encodeURIComponent(session.user.id);
   const [gear,,recentCatches]=await Promise.all([
    window.FishWizzGearState?.ensure?.({force})||Promise.resolve({combos:[],lures:[]}),
    window.FishWizzProfileState?.ensure?.({force})||Promise.resolve(null),
    api(`/rest/v1/catches?select=id,water,species,caught_at,lure_bait&owner_id=eq.${uid}&order=caught_at.desc&limit=3`),
   ]);
   // P1-5 ("expose retrieval failures as an error instead of a legitimate
   // empty state"): gear.error is set by gear-state.js when the shared fetch
   // itself failed -- distinct from a genuinely empty account -- so this
   // widget's pill can say "couldn't check" instead of confidently claiming
   // "No gear loaded" for what might just be a network hiccup.
   lastSnapshot={combos:gear.combos?.length||0,lures:gear.lures?.length||0,catches:(window.catches||[]).length,recent:recentCatches||[],last:lastMission(),gearError:!!gear.error};
   lastSnapshotAt=Date.now();
   return lastSnapshot;
  }catch(e){
   console.error('FishWizz: today snapshot refresh failed',e);
   return{combos:0,lures:0,catches:(window.catches||[]).length,recent:[],last:lastMission()};
  }
 }
 function spot(){return window.atlasFishingLocation||window.AtlasMap?.getPosition?.()||null}
 function profile(){return window.atlasAnglerProfile||null}
 function memoryHtml(data){const lm=data.last?.context,rc=data.recent?.[0];if(!lm&&!rc)return'';return `<div class="atlas-memory"><details><summary>Your recent fishing</summary><div class="atlas-memory-grid">${lm?`<div class="atlas-memory-item"><b>Last Mission</b><div>${esc(lm.water||'Water')} · ${esc(lm.target||'Target')}</div><div class="muted tiny">${esc(data.last?.saved_at?ago(data.last.saved_at):'Saved Mission')}</div><button id="repeatLastMission" class="btn" type="button">Repeat with current conditions</button></div>`:''}${rc?`<div class="atlas-memory-item"><b>Recent catch</b><div>${esc(rc.species||'Catch')} · ${esc(rc.water||'Water')}</div><div class="muted tiny">${rc.lure_bait?`${esc(rc.lure_bait)} · `:''}${esc(ago(rc.caught_at))}</div><button id="useRecentCatch" class="btn ghost" type="button">Fish this water again</button></div>`:''}</div></details></div>`}
 function render(data){const el=ensure();if(!el)return;const p=profile(),pos=spot(),name=p?.display_name||session?.user?.email?.split('@')[0]||'Angler',targets=p?.preferred_species||[],gear=data.combos||data.lures;let nextTitle,nextText,primary,secondary;
  if(!session?.user){nextTitle='Create your fishing profile';nextText='Sign in so Atlas can keep your gear, catches, Missions, and learning private to you.';primary=['Open Account','account'];secondary=['Explore Waters','waters']}
  else if(!pos){nextTitle='Pick where you are fishing';nextText='Choose a bank, dock, launch, river seam, or boat position. Atlas can do the rest from there.';primary=['Choose a Spot','waters'];secondary=['Build Without a Spot','mission']}
  else if(!gear&&p?.gear_status!=='none'){nextTitle='Build your plan';nextText='You do not need inventory to fish with Atlas. Add gear later if you want setup-specific recommendations.';primary=['Build My Mission','mission'];secondary=['Add Gear','arsenal']}
  else{nextTitle='Build today’s Mission';nextText=gear?`Atlas can use your saved gear and current spot to narrow the plan.`:'Atlas will recommend a practical general setup for this trip.';primary=['Build My Mission','mission'];secondary=['Ask Atlas','ask']}
  const meta=[p?.experience_level?label(p.experience_level):'',targets.length?targets.slice(0,2).join(' · '):'',p?.access_style?label(p.access_style):''].filter(Boolean).join(' · ');
  el.innerHTML=`<div class="atlas-today-head"><div><span class="eyebrow">Today with Atlas</span><h2>${session?.user?`Ready, ${esc(name)}?`:'Your personal fishing companion'}</h2>${meta?`<p class="muted atlas-today-kicker">${esc(meta)}</p>`:''}</div>${data.catches?`<span class="pill">${data.catches} catch${data.catches===1?'':'es'}</span>`:''}</div><div class="atlas-today-status"><span class="pill">${pos?'Spot ready':'Choose spot'}</span><span class="pill">${gear?`${data.combos} setups · ${data.lures} tackle`:data.gearError?'Gear status unknown — check your connection':esc(label(p?.gear_status)||'No gear loaded')}</span></div><div class="atlas-next"><span class="eyebrow">Next best step</span><h3>${esc(nextTitle)}</h3><p class="muted">${esc(nextText)}</p><div class="atlas-today-actions"><button id="todayPrimary" class="btn gold" type="button">${esc(primary[0])}</button><button id="todaySecondary" class="btn ghost" type="button">${esc(secondary[0])}</button></div></div>${memoryHtml(data)}`;
  $('todayPrimary').onclick=()=>go(primary[1]);$('todaySecondary').onclick=()=>go(secondary[1]);$('repeatLastMission')?.addEventListener('click',()=>{if(data.last)document.dispatchEvent(new CustomEvent('atlas:repeat-last-mission',{detail:data.last}))});$('useRecentCatch')?.addEventListener('click',()=>{const c=data.recent?.[0];if(!c)return;if($('mWater'))window.FishWizzGuard?.setGuardedValue?.($('mWater'),c.water||'','water');if($('mTarget')&&c.species){const o=[...$('mTarget').options].find(x=>x.value===c.species||x.textContent===c.species);if(o)$('mTarget').value=o.value}showPage('mission');stat(`Loaded ${c.water||'recent water'} from your Catch Log.`,'ok')});
 }
 function go(dest){if(dest==='ask'){const a=$('askAtlas');if(a){a.scrollIntoView({behavior:'smooth',block:'start'});$('askAtlasInput')?.focus();return}dest='mission'}showPage(dest)}
 async function refresh(force=false){if(loading)return;loading=true;try{render(await snapshot(force))}finally{loading=false}}
 function scheduleRefresh(force=false,delay=180){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh(force),delay)}
 function boot(){css();ensure();refresh();['atlas:profile-loaded','atlas:profile-ready','atlas:fishing-position','atlas:mission-built','atlas:gear-hydrated'].forEach(n=>document.addEventListener(n,()=>scheduleRefresh(false)));['atlas:inventory-changed','atlas:catch-saved','atlas:account-changed'].forEach(n=>document.addEventListener(n,()=>{lastSnapshot=null;lastSnapshotAt=0;scheduleRefresh(true,220)}));$('accountBtn')?.addEventListener('click',()=>scheduleRefresh(false,120))}
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{today:{snapshot,render,profile}});
})();