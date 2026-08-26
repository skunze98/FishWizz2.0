(()=>{
 // Reframes two panels the water profile already fetches data for but never
 // uses fully -- atlas-water-profile's `reports` (fishing_reports, complete
 // with species/lure/technique mentions, source, confidence, age) and
 // `species` (waterbody_species, confidence-scored) -- into the two mentor
 // features the app is missing: "What's biting here lately" and a ranked,
 // explained species list. No new network calls: this wraps window.renderWater
 // and reads the same payload it already receives, per "reuse existing data
 // and don't fabricate."
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cap=s=>String(s||'').replace(/\b\w/g,c=>c.toUpperCase());

 // Compact, independent species-family lookup for ranking display only --
 // deliberately NOT the full get_mission_plan_v3 rig logic (that stays the
 // single source of truth for the actual recommendation). This just gives a
 // one-line technique/depth/time hint so a ranked species entry is useful on
 // its own before the angler builds a full Mission for it.
 function speciesHint(name){
  const s=String(name||'').toLowerCase();
  if(/walleye|sauger/.test(s))return{depth:'Mid-depth to deep structure -- points, breaklines, or channel edges.',technique:'Jig-and-minnow or slip-sinker live bait.',time:'Low-light: dawn, dusk, or overcast.'};
  if(/crappie|bluegill|sunfish|perch|panfish/.test(s))return{depth:'Shallow cover early season, suspended over deeper water in summer.',technique:'Small jig or live bait under a slip float.',time:'Morning and evening, especially around spawning season.'};
  if(/pike|muskellunge|musk/.test(s))return{depth:'Weed edges, points, and ambush cover.',technique:'Spinner, spoon, or large minnow-style bait.',time:'Active most of the day; low light often best.'};
  if(/catfish|bullhead/.test(s))return{depth:'Deep pools, holes, and current seams near bottom.',technique:'Cut bait or nightcrawlers on a bottom rig.',time:'Evening through night, especially warm months.'};
  if(/bass/.test(s))return{depth:'Cover and structure: docks, wood, weed edges, points.',technique:'Match retrieve speed and lure profile to light and clarity.',time:'Low light and stable conditions.'};
  if(/trout|salmon|whitefish|cisco/.test(s))return{depth:'Depth strongly waterbody-dependent -- follow marked fish or known cold pockets.',technique:'Small spinner, spoon, or natural drift bait.',time:'Cooler parts of the day, especially in warm months.'};
  return{depth:'Structure and depth vary by water -- start shallow and work deeper.',technique:'General species-appropriate lure or bait.',time:'Low light or stable-weather windows.'};
 }

 function rankSpecies(species,reports){
  const mentionsFor=name=>{
   const norm=String(name||'').toLowerCase();
   let count=0,mostRecentHours=Infinity;
   for(const r of reports||[]){
    const hit=(r.species||[]).some(s=>String(s).toLowerCase().includes(norm)||norm.includes(String(s).toLowerCase()));
    if(hit){count++;if(Number.isFinite(r.age_hours))mostRecentHours=Math.min(mostRecentHours,r.age_hours)}
   }
   return{count,mostRecentHours};
  };
  return (species||[]).map(s=>{
   const m=mentionsFor(s.species_name);
   const baseConf=Number(s.confidence||.5);
   const recencyBoost=m.count?Math.min(.25,m.count*.08)*(m.mostRecentHours<=72?1:.5):0;
   const score=Math.round(Math.min(97,Math.max(15,(baseConf*70)+(recencyBoost*100))));
   const evidence=[`${Math.round(baseConf*100)}% species-evidence confidence (${esc(s.source_name||'catalog')})`];
   if(m.count)evidence.push(`${m.count} recent fishing report${m.count===1?'':'s'} mention this species${Number.isFinite(m.mostRecentHours)?`, most recent ${m.mostRecentHours}h ago`:''}`);
   else evidence.push('no recent fishing reports mention this species yet');
   return{name:s.species_name,score,confidence:score>=70?'High':score>=45?'Moderate':'Low',evidence,hint:speciesHint(s.species_name),observed_on:s.observed_on};
  }).sort((a,b)=>b.score-a.score);
 }

 function renderBiting(reports){
  if(!reports||!reports.length){
   return `<div class="wb-empty"><h3>No reliable recent activity yet</h3><p class="muted">FishWizz has not linked a fishing report to this water recently. It will show real reports here as soon as a trusted source publishes one -- it will not invent recent activity.</p></div>`;
  }
  const sorted=[...reports].sort((a,b)=>(a.age_hours??1e9)-(b.age_hours??1e9)).slice(0,10);
  const rows=sorted.map(r=>{
   const species=(r.species||[]).slice(0,4).map(esc).join(', ')||'Species not specified';
   const lures=(r.lure_mentions||[]).slice(0,3).map(esc).join(', ');
   const tech=(r.technique_mentions||[]).slice(0,3).map(esc).join(', ');
   const age=Number.isFinite(r.age_hours)?(r.age_hours<24?`${r.age_hours}h ago`:`${Math.round(r.age_hours/24)}d ago`):'Date unknown';
   return `<div class="wb-report"><div class="wb-report-top"><b>${species}</b><span class="pill">${age}</span></div>${lures?`<p class="tiny"><b>Lure/bait mentioned:</b> ${lures}</p>`:''}${tech?`<p class="tiny"><b>Technique:</b> ${tech}</p>`:''}<p class="muted tiny">${esc(r.source_name||'Unknown source')} · confidence ${Math.round(Number(r.confidence_score||0)*100)}%</p></div>`;
  }).join('');
  return `<p class="muted tiny">${sorted.length} report${sorted.length===1?'':'s'} from real sources -- not a guarantee of what you'll catch today.</p><div class="wb-reports">${rows}</div>`;
 }

 function renderRanking(species,reports){
  if(!species||!species.length){
   return `<div class="wb-empty"><h3>No species evidence imported yet</h3><p class="muted">FishWizz has not confirmed which species are present in this water. It will not guess a ranked list without real evidence.</p></div>`;
  }
  const ranked=rankSpecies(species,reports);
  const rows=ranked.map((r,i)=>`<div class="wb-rank-row${i===0?' wb-rank-top':''}"><div class="wb-rank-head"><b>#${i+1} ${esc(r.name)}</b><span class="pill">${r.score}% bite-likelihood</span></div><p class="muted tiny">Confidence: ${esc(r.confidence)} · ${r.evidence.map(esc).join(' · ')}</p><p class="tiny"><b>Likely depth/structure:</b> ${esc(r.hint.depth)}</p><p class="tiny"><b>Technique:</b> ${esc(r.hint.technique)}</p><p class="tiny"><b>Best time:</b> ${esc(r.hint.time)}</p></div>`).join('');
  return `<p class="muted tiny">Ranked from real species evidence and recent report activity -- guidance, not a guarantee.</p><div class="wb-ranked">${rows}</div>${ranked[0]?`<div class="wb-target-call"><b>Target today: ${esc(ranked[0].name)}</b><br><span class="muted tiny">Highest combined evidence for this water right now.</span> <button class="btn gold" id="wbTargetMission" type="button">Build a Mission for ${esc(ranked[0].name)}</button></div>`:''}`;
 }

 function ensureStyles(){
  if($('waterMentorStyles'))return;
  const s=document.createElement('style');s.id='waterMentorStyles';
  s.textContent=`.wb-empty{padding:14px;text-align:center}.wb-reports,.wb-ranked{display:grid;gap:9px;margin-top:8px}.wb-report,.wb-rank-row{padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)}.wb-report-top,.wb-rank-head{display:flex;justify-content:space-between;align-items:center;gap:8px}.wb-rank-top{border-color:rgba(225,191,99,.4)}.wb-target-call{margin-top:12px;padding:12px;border-radius:12px;background:rgba(225,191,99,.08);border:1px solid rgba(225,191,99,.3)}.wb-target-call .btn{margin-top:8px}`;
  document.head.appendChild(s);
 }

 function enhance(p){
  ensureStyles();
  const reportsPanel=document.querySelector('#waterPanels [data-panel="reports"]');
  const speciesPanel=document.querySelector('#waterPanels [data-panel="species"]');
  const reportsTabBtn=document.querySelector('[data-tab="reports"]');
  if(reportsTabBtn)reportsTabBtn.textContent="What's biting";
  if(reportsPanel)reportsPanel.innerHTML=`<span class="eyebrow">What's biting here lately</span>${renderBiting(p.reports)}`;
  if(speciesPanel){
   speciesPanel.innerHTML=`<span class="eyebrow">Target species ranking</span>${renderRanking(p.species,p.reports)}`;
   const ranked=rankSpecies(p.species,p.reports);
   $('wbTargetMission')?.addEventListener('click',()=>{if(ranked[0]&&$('mTarget')){const opt=[...$('mTarget').options].find(o=>o.value===ranked[0].name||o.textContent===ranked[0].name);if(opt)$('mTarget').value=opt.value}showPage('mission')});
  }
 }

 if(typeof window!=='undefined'){
  const origRenderWater=window.renderWater;
  if(typeof origRenderWater==='function'){
   window.renderWater=function(p){origRenderWater(p);try{enhance(p)}catch(e){console.error('FishWizz: water-mentor enhance failed',e)}};
  }
 }

 // Exposed only for scripts/test-mentor-explanations.mjs -- see the matching
 // comment in mission-why.js for why this is globalThis, not module.exports.
 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{waterMentor:{rankSpecies,renderBiting,renderRanking,speciesHint}});
})();
