(()=>{
 // "Why this mission?" -- item 3/5 of the mentor-experience request: explain,
 // factor by factor, how each piece of information affected the
 // recommendation, plus a confidence rationale and what's missing. This is a
 // pure explanation layer over the existing recommendation (get_mission_plan_v3
 // in Postgres) and the context object mission-v3.js already assembles --
 // it reads both but changes neither, so the proven rules engine is untouched.
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

 // Each entry: [context key, label, fn(value, context) -> effect sentence or null].
 // A null effect means "known but Atlas doesn't have a rule that changes the
 // recommendation for it" -- shown as considered, not hidden.
 const FACTORS=[
  ['target','Target species',v=>`Selects the species-specific rig, presentation, and technique -- everything else below only adjusts it.`],
  ['water_type','Water type',(v,c)=>/river|stream/i.test(v||'')?'Moving water shifts the starting spot toward current seams, eddies, and current breaks instead of shoreline structure.':null],
  ['current','Current',(v,c)=>v&&v!=='None'?`${v} current reinforces working current breaks and seams rather than open water.`:null],
  ['clarity','Water clarity',v=>v?`${v} clarity sets the lure color family (natural vs. high-contrast).`:null],
  ['light','Light',v=>v?`${v} light shifts fish toward or away from cover and changes how aggressively they'll chase.`:null],
  ['wind','Wind',v=>v&&v!=='Low'?`${v} wind can concentrate baitfish on wind-blown banks and points.`:null],
  ['cover','Cover',v=>v?`${v} cover narrows which structure to prioritize first.`:null],
  ['pressure_trend','Barometric pressure',v=>v==='Falling'?'Falling pressure often opens a short, real feeding window -- fish tend to chase harder right now.':v==='Rising'?'Rising pressure tends to push fish tight to cover and make them feed more cautiously.':v==='Steady'?'Steady pressure points to a normal bite rather than a weather-driven one.':null],
  ['fish_activity','Reported fish activity',v=>v==='Active'?'Active fish activity raises confidence in this recommendation.':v==='Inactive'?'Inactive fish activity lowers confidence and favors a slower presentation.':null],
  ['water_level_trend','Water level trend',v=>v==='Rising'?'Rising water can push fish toward newly flooded cover or fresh current breaks.':v==='Falling'?'Falling water can pull fish toward channel edges or deeper water.':null],
  ['water_temp','Water temperature',v=>v&&v!=='Unknown'?`${v} water temperature affects how far and how fast fish will move to feed.`:null],
  ['season','Season',v=>v?`${v} sets general seasonal positioning for this species.`:null],
 ];

 function liveWeatherLine(c){
  if(!c.live_weather)return{ok:false,text:'Live weather was not loaded for this Mission -- the conditions above came from your own selections, not a real-time reading.'};
  const w=c.live_weather.current||{};
  return{ok:true,text:`Live weather was loaded (${esc(w.temperature_2m??'?')}°F, wind ${esc(w.wind_speed_10m??'?')} mph) and used for wind/light/pressure above instead of a guess.`};
 }
 function positionLine(c){
  if(c.latitude&&c.longitude)return{ok:true,text:`An exact fishing position was set${c.position_method?` (${esc(String(c.position_method).replaceAll('_',' '))})`:''}, so the starting spot is anchored to a real, matched water.`};
  return{ok:false,text:'No exact fishing position was set -- the starting spot below is general guidance for this water type, not tied to a specific matched location.'};
 }
 function gearLine(c,rec){
  const n=(c.inventory_summary?.saved_setups||0)+(c.inventory_summary?.saved_tackle||0);
  if(rec?.inventory_used)return{ok:true,text:'Your saved Arsenal was matched to this Mission -- the combo shown is gear you actually own, not a generic suggestion.'};
  if(n)return{ok:false,text:'Saved gear was checked, but nothing owned was a confident match for this Mission, so generic setup guidance is shown.'};
  return{ok:false,text:'No saved rods, reels, or tackle were found, so this Mission uses general setup guidance rather than your own gear.'};
 }
 function profileLine(c){
  if(c.angler_profile?.experience_level)return{ok:true,text:`Your profile (${esc(c.angler_profile.experience_level)} angler) is known and available to Atlas for this Mission.`};
  return{ok:false,text:'No angler profile is set, so guidance defaults to a general skill level.'};
 }

 function confidenceReasoning(c,rec){
  const missing=[];
  if(!c.live_weather)missing.push('live weather');
  if(!(c.latitude&&c.longitude))missing.push('an exact fishing position');
  if(!c.angler_profile)missing.push('an angler profile');
  if(!((c.inventory_summary?.saved_setups||0)+(c.inventory_summary?.saved_tackle||0)))missing.push('saved gear');
  if(!c.fish_activity||c.fish_activity==='Unknown')missing.push('recent fish-activity reports');
  const score=Number(rec?.confidence);
  const band=score>=80?'high':score>=60?'moderate':'low';
  const basis=`${score||'?'}% confidence is a ${band} rating, based on ${c.target?`species-specific guidance for ${esc(c.target)}`:'general guidance (no target species set)'}, ${missing.length?`with ${missing.length} input${missing.length===1?'':'s'} not available (${missing.map(esc).join(', ')})`:'with every input Atlas asks for already supplied'}.`;
  return{band,missing,text:basis};
 }

 function render(c,rec){
  const factorRows=FACTORS.map(([key,label,fn])=>{
   const v=c[key];
   const effect=fn(v,c);
   if(!label&&!effect)return null; // internal-only factor with no visible rule fired
   if(v==null||v==='')return null;
   return{label:label||key,value:v,effect,known:true};
  }).filter(Boolean);
  const liveW=liveWeatherLine(c),pos=positionLine(c),gear=gearLine(c,rec),prof=profileLine(c);
  const conf=confidenceReasoning(c,rec);
  const rows=[...factorRows.map(f=>`<li class="mw-row"><b>${esc(f.label)}: ${esc(f.value)}</b>${f.effect?`<br><span class="muted">${esc(f.effect)}</span>`:'<br><span class="muted tiny">Known, but no specific rule changed the recommendation for this value.</span>'}</li>`),
   `<li class="mw-row ${liveW.ok?'mw-ok':'mw-gap'}"><b>${liveW.ok?'Live weather used':'Live weather not used'}</b><br><span class="muted">${esc(liveW.text)}</span></li>`,
   `<li class="mw-row ${pos.ok?'mw-ok':'mw-gap'}"><b>${pos.ok?'Exact position used':'No exact position'}</b><br><span class="muted">${esc(pos.text)}</span></li>`,
   `<li class="mw-row ${gear.ok?'mw-ok':'mw-gap'}"><b>${gear.ok?'Your gear used':'Generic gear guidance'}</b><br><span class="muted">${esc(gear.text)}</span></li>`,
   `<li class="mw-row ${prof.ok?'mw-ok':'mw-gap'}"><b>${prof.ok?'Angler profile used':'No angler profile'}</b><br><span class="muted">${esc(prof.text)}</span></li>`
  ].join('');
  return `<span class="eyebrow">Why this Mission</span><h2>How Atlas reasoned through this</h2><p class="muted">Every factor Atlas actually used, in plain language -- not guesses presented as fact.</p><ul class="mw-list">${rows}</ul><div class="mw-confidence ${conf.band==='low'?'bad':''}"><b>Confidence: ${esc(rec?.confidence??'?')}%</b> (${esc(conf.band)})<br><span class="muted tiny">${esc(conf.text)}</span></div><p class="muted tiny">This is guidance based on the information above, not a guarantee of results. FishWizz will not state something as fact when it is really an estimate or a missing input.</p>`;
 }

 function ensure(){
  let el=$('missionWhy');
  if(el)return el;
  const host=$('planSummary')?.parentElement;
  const anchor=$('planCards');
  if(!host||!anchor)return null;
  el=document.createElement('details');
  el.id='missionWhy';
  el.className='card mission-why';
  host.insertBefore(el,anchor);
  if(!$('missionWhyStyles')){
   const s=document.createElement('style');s.id='missionWhyStyles';
   s.textContent=`.mission-why{margin:10px 0}.mission-why>summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:800;list-style:none}.mission-why>summary::-webkit-details-marker{display:none}.mission-why>summary:before{content:'\\25B8';margin-right:8px;transition:transform .15s ease}.mission-why[open]>summary:before{transform:rotate(90deg)}.mw-list{list-style:none;margin:10px 0;padding:0;display:grid;gap:9px}.mw-row{padding:9px 11px;border-radius:10px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.mw-row.mw-ok{border-color:rgba(140,196,155,.35)}.mw-row.mw-gap{border-color:rgba(255,255,255,.07);opacity:.85}.mw-confidence{margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(225,191,99,.08);border:1px solid rgba(225,191,99,.25)}.mw-confidence.bad{background:rgba(142,79,73,.1);border-color:rgba(142,79,73,.3)}`;
   document.head.appendChild(s);
  }
  return el;
 }

 function update(detail){
  const el=ensure();
  if(!el)return;
  const c=detail?.context,rec=detail?.recommendation;
  if(!c||!rec){el.innerHTML='';el.hidden=true;return}
  el.hidden=false;
  el.innerHTML=`<summary>Why this Mission? <span class="muted tiny">tap to see Atlas's reasoning</span></summary>${render(c,rec)}`;
 }

 if(typeof document!=='undefined'){
  document.addEventListener('atlas:mission-built',e=>update(e.detail));
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>window.lastMission&&update(window.lastMission)):(window.lastMission&&update(window.lastMission));
 }

 // Exposed only for scripts/test-mentor-explanations.mjs, which imports this
 // file for its side effect and reads this namespace back -- this project is
 // "type":"module", so a plain `module.exports` here would be silently
 // ignored (no CommonJS `module` global exists), and `export` cannot appear
 // inside this IIFE. globalThis exists in Node and every browser alike, and
 // this key is inert in production (nothing else reads it).
 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{missionWhy:{confidenceReasoning,render,FACTORS}});
})();
