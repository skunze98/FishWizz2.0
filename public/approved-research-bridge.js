(()=>{
 // Approved-research integration bridge. FEATURE-FLAGGED OFF BY DEFAULT
 // (window.FishWizzApprovedResearchFlag.isEnabled()) -- when disabled, this file's boot() is a
 // no-op and nothing it does is ever visible or called. When enabled, it listens for the SAME
 // 'atlas:mission-built' event mission-loop.js already listens to (fired by mission-v3.js after a
 // normal Mission finishes building) and adds a SEPARATE, clearly-labeled "Approved Research"
 // section -- it never edits the existing #planSummary/#planCards output from get_mission_plan_v3.
 //
 // Label shown to the user on every render -- the exact wording required by the standing
 // integration instruction (checkpoint approved-2026-08-30), verbatim, so the in-app disclosure
 // and the integration report's own closing label can never drift apart or say two different
 // things about the same non-mission-ready state.
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const LABEL='Professionally approved research integrated in isolation — awaiting application-team review, controlled production integration, mission-ready authorization, and authenticated QA.';

 // ---------- diagnostics: record IDs and matching stages only, NEVER user data ----------
 const diag={stages:[],lastQuery:null};
 function logStage(stage,data){
  // `data` here is deliberately restricted to record IDs / counts / boolean flags by every call
  // site below -- never the user's session, location, water name, or any personally-identifying
  // field from `context`. Reviewed at each call site, not just documented here.
  diag.stages.push({stage,at:new Date().toISOString(),...data});
  if(diag.stages.length>50)diag.stages.shift();
 }
 window.FishWizzApprovedResearchDiagnostics={getStages:()=>diag.stages.slice(),getLastQuery:()=>diag.lastQuery};

 // ---------- structured gear-fit check (rod power / line test / lure weight vs. a tactic's real equipment) ----------
 // Deliberately separate from mission-inventory-fit.js's text-similarity scorer -- that scorer was
 // built for get_mission_plan_v3's free-text plan.lure/.combo fields and has no way to compare a
 // structured { rod_power, line_test_lb: {min,max}, lure_weight_oz: {min,max} } object. Reuses
 // window.FishWizzTackleTaxonomy.isPresentable so a hook/sinker still can never be counted as
 // matching gear here either.
 function inRange(value,range){const n=Number(value);return range&&Number.isFinite(n)&&n>=range.min&&n<=range.max}
 // Rod power has no fixed vocabulary on either side of this comparison: the approved research's
 // equipment.rod_power is a snake_case token ('medium_light', 'ultralight'), while
 // manual-gear-pro.js leaves the app's own rods.power a free-text field a user typed by hand
 // ("Medium-Light", "ML", "Medium Light" have all been seen for real) -- stripping every non-
 // alphanumeric character on BOTH sides before comparing is what actually makes "Medium-Light"
 // match "medium_light"; comparing raw strings (or only replacing underscores) does not, since a
 // hyphen and a space are neither one the other. Caught by an actual gear-fit test asserting a
 // positive match, not assumed correct.
 const normPower=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 function gearFitForTactic(tactic,inv){
  const combos=inv?.combos||[],lures=(inv?.lures||[]).filter(l=>(l.quantity??1)>0&&(window.FishWizzTackleTaxonomy?.isPresentable?.(l)??true));
  const eq=tactic.equipment||{};
  const comboMatches=combos.filter(c=>{
   const rod=c.rods,reel=c.reels;
   const rodOk=!rod?.power||!eq.rod_power||normPower(rod.power).includes(normPower(eq.rod_power));
   const lineOk=!reel?.line_test||!eq.line_test_lb||inRange(parseFloat(reel.line_test),eq.line_test_lb);
   return rodOk&&lineOk;
  });
  const lureMatches=eq.lure_weight_oz?lures.filter(l=>{
   const w=parseFloat(l.size_weight);
   return Number.isFinite(w)&&inRange(w,eq.lure_weight_oz);
  }):[];
  return{comboMatches,lureMatches,hasMatch:comboMatches.length>0||lureMatches.length>0};
 }

 // ---------- safe-behavior rendering for missing/expired/conflicting/unsupported information ----------
 function tacticCard(t,inv){
  const fit=gearFitForTactic(t,inv);
  const badge=window.FishWizzApprovedResearchEvidence?.badge(t.confidence)||esc(t.confidence);
  const readinessNote=window.FishWizzApprovedResearchEvidence?.readinessNote(t.readiness,t.readiness_reason)||'';
  const sourcesHtml=(t.sources||[]).length
   ?`<details class="tiny"><summary>Sources (${t.sources.length})</summary><ul>${t.sources.map(s=>`<li>${esc(s.organization)} — <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a> (retrieved ${esc(s.access_date)})</li>`).join('')}</ul></details>`
   :`<p class="muted tiny">No source records attached to this tactic — do not treat it as verified.</p>`;
  const gearHtml=fit.hasMatch
   ?`<p class="tiny"><span class="pill">Fits gear you own</span> ${fit.comboMatches.length} setup(s), ${fit.lureMatches.length} lure(s)</p>`
   :`<p class="muted tiny">No owned gear matched this tactic's rod/line/lure specification.</p>`;
  return `<article class="card approved-research-tactic">
   <span class="eyebrow">${esc(t.presentation_category||'Technique')}${t.is_primary_species?'':' · secondary species'}</span>
   <h4>${esc(t.presentation_label||'Approved tactic')}</h4>
   <p>${badge}</p>
   ${readinessNote}
   <p>${esc(t.rigging_instructions||'')}</p>
   <p class="tiny"><b>Works when:</b> ${esc(t.works_when||'(not specified)')}</p>
   <p class="tiny"><b>Fails when:</b> ${esc(t.fails_when||'(not specified)')}</p>
   ${gearHtml}
   ${sourcesHtml}
  </article>`;
 }

 function regulationCard(r){
  const scope=r.geographic_scope||{};
  const scopeText=[scope.type,scope.waterbody_name,scope.district_code,scope.tributary_of,scope.great_lake_name].filter(Boolean).join(' · ');
  const dates=r.temporal_scope?.annual_recurrence?`${r.temporal_scope.annual_recurrence.start_month_day} – ${r.temporal_scope.annual_recurrence.end_month_day}`:'(see full record)';
  const sourcesHtml=(r.sources||[]).map(s=>`<li>${esc(s.organization)} — <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a> (retrieved ${esc(s.access_date)})</li>`).join('');
  return `<article class="card approved-research-regulation">
   <span class="eyebrow">Regulation · ${esc(r.provision_type)}</span>
   <h4>${esc(scopeText||'Jurisdiction not specified')}</h4>
   <p class="tiny">${esc(r.official_wording||'')}</p>
   <p class="tiny"><b>Effective:</b> ${esc(dates)} · <b>Status:</b> ${esc(r.status)} · <b>Reverify by:</b> ${esc(r.mandatory_reverify_by||'unknown')}</p>
   <ul class="tiny">${sourcesHtml}</ul>
   <p class="muted tiny">This is a research snapshot, not a live regulations lookup. Verify current, waterbody-specific rules independently before harvesting.</p>
  </article>`;
 }

 function renderSection(result,context,inv){
  let host=$('approvedResearchSection');
  if(!host){
   host=document.createElement('div');
   host.id='approvedResearchSection';
   host.className='approved-research-section';
   $('planCards')?.insertAdjacentElement('afterend',host);
  }
  if(!result||!result.available){
   host.innerHTML=`<div class="card muted"><span class="eyebrow">Approved research</span><p class="tiny">${esc(result?.data_note||'No approved research species matches this target yet.')}</p></div>`;
   return;
  }
  const tactics=(result.tactics||[]);
  const regulations=(result.regulations||[]);
  const tacticsHtml=tactics.length?tactics.map(t=>tacticCard(t,inv)).join(''):'<p class="muted tiny">Species researched, but no tactics are on file yet for this species.</p>';
  const regsHtml=regulations.length?`<h4>Regulations (independent of the tactics above)</h4>${regulations.map(regulationCard).join('')}`:'';
  host.innerHTML=`
   <div class="card">
     <span class="eyebrow">Approved research</span>
     <h3>${esc(result.matched_common_name)} — ${tactics.length} tactic(s)</h3>
     <p class="muted tiny">${LABEL}</p>
     <p class="muted tiny">${esc(result.data_note||'')}</p>
   </div>
   ${tacticsHtml}
   ${regsHtml}
  `;
 }

 async function run(mission){
  if(!window.FishWizzApprovedResearchFlag?.isEnabled())return;
  const context=mission?.context;
  if(!context?.target)return;
  const slug=window.FishWizzApprovedResearchTaxonomy?.toSlug(context.target);
  logStage('taxonomy_lookup',{target_provided:!!context.target,mapped:!!slug,slug:slug||null});
  try{
   // A NEW object, never a mutation of `context`/`mission.context` -- other listeners on the same
   // 'atlas:mission-built' event (mission-loop.js, location-state.js) still see the original
   // shape. target_species_slug is the one field this RPC call adds beyond what
   // get_mission_plan_v3 already receives: species-taxonomy-map.js's exact-match resolution of
   // the app's own free-text species name, since that name and the research's own
   // common_name_primary are legitimately different strings for several species (e.g. "Cisco
   // (Tullibee)" vs. "Cisco") -- see get_approved_research_plan's own header comment for the
   // confirmed case that caught this.
   const rpcContext=slug?{...context,target_species_slug:slug}:context;
   const body=JSON.stringify({p_context:rpcContext});
   diag.lastQuery={endpoint:'/rest/v1/rpc/get_approved_research_plan',at:new Date().toISOString()};
   const result=await api('/rest/v1/rpc/get_approved_research_plan',{method:'POST',body});
   logStage('rpc_response',{available:result?.available,tactic_count:result?.tactic_count??0,regulation_count:result?.regulation_count??0,matched_species_slug:result?.matched_species_slug||null});
   const inv=await window.FishWizzMissionInventory?.load?.(context).catch(()=>({combos:[],lures:[]}))||{combos:window.combos||[],lures:window.lures||[]};
   renderSection(result,context,inv);
  }catch(e){
   // Safe behavior on failure: a calm, visible, non-blocking note -- never silently nothing, never
   // a raw error, and NEVER a fabricated fallback recommendation.
   console.error('FishWizz approved-research bridge: RPC failed (degrading gracefully)',e);
   logStage('rpc_error',{message:e?.message||'unknown error'});
   renderSection({available:false,data_note:'Approved research is temporarily unavailable. Your Mission above is unaffected.'},context,null);
  }
 }

 document.addEventListener('atlas:mission-built',e=>run(e.detail));
 document.addEventListener('atlas:approved-research-flag-changed',()=>{if(window.lastMission)run(window.lastMission)});
 window.FishWizzApprovedResearchBridge={run,gearFitForTactic,tacticCard,regulationCard,LABEL};
 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{approvedResearchBridge:{run,gearFitForTactic,tacticCard,regulationCard,renderSection,LABEL}});
})();
