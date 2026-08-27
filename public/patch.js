// Atlas hotfix: water intelligence rendering + Mission RPC compatibility
window.renderWater=function(p){
  const w=p.water,e=p.evidence||{},intel=p.intelligence_summary||{};
  const guidance=(intel.derived_guidance||[]).map(x=>`<li>${esc(x)}</li>`).join('');
  const gauges=(p.gauges||[]).map(g=>`<div class="result"><b>${esc(g.site_name||g.site_id)}</b>${(g.parameters||[]).map(o=>`<p>${esc(o.parameter_name||o.parameter_code)}: <b>${esc(o.value)} ${esc(o.unit||'')}</b><br><span class="muted tiny">${new Date(o.observed_at).toLocaleString()}</span></p>`).join('')}</div>`).join('');
  const species=(p.species||[]).map(s=>`<div class="result"><b>${esc(s.species_name)}</b><br><span class="muted">Confidence ${Math.round(Number(s.confidence||0)*100)}% · ${esc(s.source_name)}</span></div>`).join('');
  const access=(p.access||[]).map(a=>`<div class="result"><b>${esc(a.name||a.access_type||'Access point')}</b><br><span class="muted">${esc(a.public_status||'Status not verified')}</span></div>`).join('');
  const reports=(p.reports||[]).map(r=>`<div class="result"><b>${esc(r.title||r.source_name)}</b><p>${esc(r.summary)}</p><span class="muted tiny">${esc(r.source_name)} · ${r.age_hours==null?'age unknown':r.age_hours+' hours old'} · confidence ${Math.round(Number(r.confidence_score||0)*100)}%</span></div>`).join('');
  const history=[...(p.personal_spots||[]),...(p.personal_catches||[])].map(x=>`<div class="result"><b>${esc(x.name||x.species||'Personal record')}</b><br><span class="muted">${esc(x.notes||x.lure_bait||x.spot_type||'')}</span></div>`).join('');
  $('waterProfile').innerHTML=`<span class="eyebrow">${esc(w.source_label||w.source_system)}</span><h2>${esc(w.name)}</h2><p>${esc(w.state_code)} · ${esc(w.water_type)} ${w.county_name?'· '+esc(w.county_name):''}</p><div><span class="pill">Confidence: ${esc(e.confidence||'limited')}</span><span class="pill">${esc(e.species_count||0)} species</span><span class="pill">${esc(e.access_count||0)} access</span><span class="pill">${esc(e.gauge_count||0)} gauges</span><span class="pill">${esc(e.report_count||0)} reports</span></div><div class="card intelligence"><span class="eyebrow">Atlas intelligence</span><h3>${esc((e.confidence||'limited').toUpperCase())} confidence</h3><ul>${guidance||'<li>No derived guidance available yet.</li>'}</ul></div><div class="row"><button id="missionHere" class="btn gold">Build Mission Here</button><button id="refreshGauge" class="btn">Refresh Live Water</button><button id="addSpot" class="btn ghost">Save a Spot</button></div><div class="tabs"><button data-tab="conditions" class="active">Conditions</button><button data-tab="species">Species</button><button data-tab="access">Access</button><button data-tab="reports">Reports</button><button data-tab="history">My History</button></div><div id="waterPanels">${panel('conditions',gauges,'No linked gauge yet.')}${panel('species',species,'No species evidence loaded yet.')}${panel('access',access,'No access records linked yet.')}${panel('reports',reports,'No recent reports ingested yet.')}${panel('history',history,'No personal history yet.')}</div>`;
  $('waterPanels').querySelector('[data-panel="conditions"]').classList.add('active');
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('[data-panel]').forEach(x=>x.classList.toggle('active',x.dataset.panel===b.dataset.tab))});
  $('missionHere').onclick=()=>{window.FishWizzGuard?.setGuardedValue?.($('mWater'),w.name,'water');window.FishWizzGuard?.setGuardedValue?.($('cWater'),w.name,'water');selectedWater=w;showPage('mission')};
  $('refreshGauge').onclick=async()=>{try{const d=await api('/functions/v1/atlas-live-water',{method:'POST',body:JSON.stringify({waterbody_id:w.id})});stat(d.refreshed?'Live readings refreshed.':'No linked gauges yet.',d.refreshed?'ok':'')}catch(err){stat(err.message,'err')}};
  $('addSpot').onclick=()=>saveSpot(w);
};
window.coach=async function(){
  try{
    stat('Building plan…');
    const body={p_water:$('mWater').value,p_target:$('mTarget').value,p_season:'Summer',p_clarity:$('mClarity').value,p_wind:$('mWind').value,p_light:$('mLight').value,p_access:$('mAccess').value,p_cover:$('mCover').value,p_current:$('mCurrent').value,p_depth:$('mDepth').value};
    const d=await api('/rest/v1/rpc/get_mission_plan_v2',{method:'POST',body:JSON.stringify(body)});
    const r=[d.primary,d.backup,d.finesse].filter(Boolean).map(x=>({combo_name:x.combo,lure_color:[x.lure,x.color].filter(Boolean).join(' — '),why_text:x.why||'',how_text:x.how||'',watch_for:x.watch_for||'',next_step:x.switch_when||x.time_limit||''}));
    lastMission={context:body,recommendation:r};
    $('planSummary').innerHTML=`<span class="eyebrow">Atlas Mentor</span><h2>${esc($('mWater').value)} · ${esc($('mTarget').value)}</h2><p>${r.length} ranked approaches from your gear. Confidence ${esc(d.confidence||'—')}%.</p>`;
    $('planCards').innerHTML=r.map((p,i)=>planCard(i===0?'Primary':i===1?'Backup':'Finesse',p,i===0?'primary':'')).join('');
    $('feedbackBox').hidden=false;stat('Plan ready.','ok');
  }catch(err){stat(err.message,'err')}
};
$('coach').onclick=window.coach;
