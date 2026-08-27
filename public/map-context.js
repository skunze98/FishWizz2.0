(()=>{
 const $=id=>document.getElementById(id);let groups={},last=null;const map=()=>window.AtlasMap?.getMap?.()||window.atlasMap;
 function group(k){if(!groups[k]&&map())groups[k]=L.layerGroup().addTo(map());return groups[k]}function clear(){Object.values(groups).forEach(g=>g.clearLayers())}
 // access_type is real DNR text (see atlas-water-access) -- bucket by it so
 // boat launches, canoe/kayak carry-ins, and shore fishing sites are visually
 // distinct and independently toggleable, not one undifferentiated "access" dot.
 function accessGroupKey(accessType){const s=String(accessType||'').toLowerCase();if(s.includes('canoe')||s.includes('kayak')||s.includes('carry'))return'access_paddle';if(s.includes('shore'))return'access_shore';return'access_boat'}
 const DOT_COLOR={access_boat:'#4aa3ff',access_paddle:'#8cc49b',access_shore:'#e1bf63',gauge:'#c98bd6',spot:'#ffffff'};
 function dot(lat,lon,label,groupKey){if(!map()||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon)))return;const color=DOT_COLOR[groupKey]||'#ffffff';const radius=groupKey==='gauge'?7:groupKey.startsWith('access')?6:5;L.circleMarker([+lat,+lon],{radius,weight:2,color,fillColor:color,fillOpacity:.82}).bindPopup(label).addTo(group(groupKey))}
 function contourLine(paths,depthFt,maxDepth){if(!map()||!Array.isArray(paths)||!paths.length)return;const t=maxDepth?Math.min(1,depthFt/maxDepth):0;const color=`hsl(${205-t*45},70%,${62-t*30}%)`;L.polyline(paths,{color,weight:depthFt<=0?1.4:1.8,opacity:.85}).bindTooltip(depthFt>0?`${depthFt} ft`:'Shoreline').addTo(group('depth'))}
 // Visible "NN ft" labels at index depths (multiples of 10 -- the DNR
 // interval is 5 ft, labeling every line would bury the lake in text), one
 // per depth at that depth's longest contour segment. Mirrors map.js's
 // map-wide depth layer so both views read the same way.
 function longestPath(paths){return(paths||[]).reduce((a,p)=>Array.isArray(p)&&p.length>(a?a.length:0)?p:a,null)}
 function depthLabelMarker(latlon,text){if(!latlon||!map())return null;return L.marker(latlon,{icon:L.divIcon({className:'depth-label-icon',html:`<span class="depth-label">${text}</span>`,iconSize:[0,0]}),interactive:false,keyboard:false})}
 function drawContourLabels(contours){
  const bestByDepth=new Map();
  (contours||[]).forEach(c=>{const lp=longestPath(c.paths),existing=bestByDepth.get(c.depth_ft);if(lp&&(!existing||lp.length>existing.length))bestByDepth.set(c.depth_ft,lp)});
  bestByDepth.forEach((path,depthFt)=>{if(depthFt<=0||depthFt%10!==0)return;const m=depthLabelMarker(path[Math.floor(path.length/2)],`${depthFt} ft`);if(m)m.addTo(group('depth'))});
 }
 function ensurePanel(){if($('mapContext'))return $('mapContext');const p=document.createElement('div');p.id='mapContext';p.className='card';p.innerHTML='<h2>Fishing context</h2><p class="muted">Choose an exact position to load fishing intelligence.</p>';const host=$('waterProfile')?.parentElement;host?.insertBefore(p,$('waterProfile'));return p}
 const fmt=d=>{const n=+d;return Number.isFinite(n)?(n<.1?`${Math.round(n*5280)} ft`:`${n.toFixed(1)} mi`):''};
 function layerControls(d){
  const access=d._access||[];
  const counts={access_boat:access.filter(a=>accessGroupKey(a.access_type)==='access_boat').length,access_paddle:access.filter(a=>accessGroupKey(a.access_type)==='access_paddle').length,access_shore:access.filter(a=>accessGroupKey(a.access_type)==='access_shore').length};
  const rows=[
   `<label><input type="checkbox" data-layer="access_boat" checked> Boat launches (${counts.access_boat})</label>`,
   `<label><input type="checkbox" data-layer="access_paddle" checked> Canoe / kayak (${counts.access_paddle})</label>`,
   `<label><input type="checkbox" data-layer="access_shore" checked> Shore fishing (${counts.access_shore})</label>`,
   `<label><input type="checkbox" data-layer="gauge" checked> Gauges (${(d.gauges||[]).length})</label>`,
   `<label><input type="checkbox" data-layer="spot" checked> My spots (${(d.saved_spots||[]).length})</label>`
  ];
  if(d._depth?.available)rows.push(`<label><input type="checkbox" data-layer="depth" checked> ${d._depth.depth_kind==='max_depth_only'?'Depth (reported max)':`Depth contours (${d._depth.contour_count})`}</label>`);
  return `<div class="launch-checks" id="mapLayerControls">${rows.join('')}</div>`;
 }
 function bindControls(){document.querySelectorAll('[data-layer]').forEach(c=>c.onchange=()=>{const g=groups[c.dataset.layer];if(!g||!map())return;c.checked?g.addTo(map()):map().removeLayer(g)})}
 function gaugeText(g){const obs=Array.isArray(g.latest_observations)?g.latest_observations:[];const bits=obs.slice(0,3).map(o=>`${esc(o.parameter_name||o.parameter_code||'Reading')}: ${esc(o.value)} ${esc(o.unit||'')}`);return `<b>${esc(g.site_name||g.site_id)}</b><br>${esc(g.agency||'Gauge')} · ${esc(fmt(g.distance_miles))}${bits.length?`<br>${bits.join('<br>')}`:''}`}
 function accessText(a){return `<b>${esc(a.name||'Public access')}</b><br>${esc(a.access_type||'Access')}${a.administrator?` · ${esc(a.administrator)}`:''}${a.ada_accessible?'<br><span class="muted tiny">ADA-accessible parking</span>':''}`}
 function draw(d){clear();
  (d._access?.length?d._access:(d.access_points||[])).forEach(a=>dot(a.latitude,a.longitude,accessText(a),accessGroupKey(a.access_type)));
  (d.gauges||[]).forEach(g=>dot(g.latitude,g.longitude,gaugeText(g),'gauge'));
  (d.saved_spots||[]).forEach(s=>dot(s.latitude,s.longitude,`<b>${esc(s.name)}</b><br>${esc(s.spot_type||'Saved spot')} · ${esc(fmt(s.distance_miles))}${s.notes?`<br>${esc(s.notes)}`:''}`,'spot'));
  if(d._depth?.available){
   if(d._depth.depth_kind==='max_depth_only'){
    const at=last?[+last.lat,+last.lon]:null;
    if(at){L.circleMarker(at,{radius:6,weight:2,color:'#d7b55b',fillColor:'#d7b55b',fillOpacity:.75}).bindPopup(`${esc(d._depth.lake_name||d.selected_water?.name||'Lake')} · reported max ${esc(d._depth.max_depth_ft)} ft (${esc(d._depth.survey?.data_source||'WDNR')})`).addTo(group('depth'));const m=depthLabelMarker(at,`${d._depth.max_depth_ft} ft max`);if(m)m.addTo(group('depth'))}
   }else{
    (d._depth.contours||[]).forEach(c=>contourLine(c.paths,c.depth_ft,d._depth.max_depth_ft));
    drawContourLabels(d._depth.contours);
   }
  }
 }
 function depthFact(depth){
  if(!depth)return'';
  if(!depth.available)return `<p class="muted tiny"><b>Depth chart:</b> ${esc(depth.reason||'Not available for this water yet.')}</p>`;
  if(depth.depth_kind==='max_depth_only')return `<p><b>Depth:</b> ${esc(depth.max_depth_ft)} ft reported maximum (${esc(depth.survey?.data_source||'Wisconsin DNR')}). Wisconsin doesn't publish full contour lines like Minnesota -- this is the one figure WDNR has on file, not a shoreline survey.</p>`;
  return `<p><b>Depth chart:</b> ${esc(depth.max_depth_ft)} ft max (DNR survey, ${esc(depth.contour_count)} contour lines at ${esc(depth.contour_interval_ft)}-ft intervals, numbers shown at 10-ft intervals on the map). Estimated from a lake survey -- always confirm with sonar on the water.</p>`;
 }
 // P1-6: View/Edit/Delete for saved spots. Spots had no textual list
 // anywhere -- only the map pin drawn by draw() above -- so there was no
 // normal-page UI path to rename, correct, or remove one at all (matching
 // the tracker's own evidence: "no usable UI path exists"). Same confirm +
 // optimistic + rollback shape as the other three CRUD additions in this
 // batch (arsenal-safe.js, inventory-pro.js, catch-history-pro.js).
 function spotsHtml(spots){if(!spots?.length)return'';return `<details open><summary>Your saved spots here (${spots.length})</summary>${spots.map(s=>`<div class="row" style="align-items:center;gap:8px;margin:6px 0"><p class="tiny" style="flex:1;margin:0"><b>${esc(s.name)}</b> · ${esc(s.spot_type||'Spot')}${s.notes?`<br><span class="muted">${esc(s.notes)}</span>`:''}</p><button class="btn ghost" type="button" data-spot-edit="${esc(s.id)}">Edit</button><button class="btn bad" type="button" data-spot-delete="${esc(s.id)}">Delete</button></div>`).join('')}</details>`}
 function editSpot(id){const spots=last?.__lastData?.saved_spots||[],s=spots.find(x=>String(x.id)===String(id));if(!s)return;const name=prompt('Spot name',s.name||'');if(name===null)return;const type=prompt('Spot type: dock, point, inlet, riffle, pool, seam, shoreline',s.spot_type||'');if(type===null)return;const notes=prompt('Notes about this spot',s.notes||'');if(notes===null)return;api(`/rest/v1/water_spots?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(session.user.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({name,spot_type:type,notes})}).then(()=>{stat('Spot updated.','ok');last&&load(last)}).catch(e=>stat(e.message,'err'))}
 function deleteSpot(id){if(!confirm('Delete this saved spot? This cannot be undone.'))return;api(`/rest/v1/water_spots?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(session.user.id)}`,{method:'DELETE',headers:{Prefer:'return=representation'}}).then(deleted=>{if(!Array.isArray(deleted)||!deleted.length)throw Error('This spot was not found in your account, so nothing was deleted.');stat('Spot deleted.','ok');last&&load(last)}).catch(e=>stat(e.message,'err'))}
 function render(d){const box=ensurePanel(),w=d.selected_water,q=d.data_quality||{},missing=Array.isArray(q.missing_layers)?q.missing_layers:[],catches=d.recent_catches||[],spots=d.saved_spots||[];if(last)last.__lastData=d;box.innerHTML=`<span class="eyebrow">Exact-position intelligence</span><h2>${esc(w?.name||'No indexed water selected')}</h2>${w?`<p><b>${esc(w.water_type)}</b> · ${esc(w.state_code)} · ${esc(fmt(w.distance_miles))} from pin</p>`:''}<p><b>Data quality:</b> ${esc(q.quality_grade||'Not graded')}${q.quality_score!=null?` · ${esc(q.quality_score)}/100`:''}</p>${depthFact(d._depth)}${layerControls(d)}${missing.length?`<p class="muted tiny"><b>Still missing:</b> ${esc(missing.join(', '))}</p>`:''}${spotsHtml(spots)}${catches.length?`<details><summary>Your recent history on this water (${catches.length})</summary>${catches.slice(0,8).map(c=>`<p class="tiny"><b>${esc(c.species||'Catch')}</b> · ${esc(c.lure_bait||'unknown lure')}${c.color?` · ${esc(c.color)}`:''}${c.combo_name?` · ${esc(c.combo_name)}`:''}<br><span class="muted">${esc(c.spot||'Unnamed spot')}${c.learned?` — ${esc(c.learned)}`:''}</span></p>`).join('')}</details>`:''}<div class="row"><button id="contextMission" class="btn gold">Build Mission here</button><button id="refreshContext" class="btn ghost">Refresh</button></div><p class="muted tiny">Atlas maps verified coordinates when available. Older catches without GPS stay linked to the water/spot name rather than receiving invented map pins.</p>`;bindControls();box.querySelectorAll('[data-spot-edit]').forEach(b=>b.onclick=()=>editSpot(b.dataset.spotEdit));box.querySelectorAll('[data-spot-delete]').forEach(b=>b.onclick=()=>deleteSpot(b.dataset.spotDelete));$('contextMission').onclick=()=>{if(w){window.selectedWater={...(window.selectedWater||{}),...w};if($('mWater'))window.FishWizzGuard?.setGuardedValue?.($('mWater'),w.name,'water');if($('mWaterType'))$('mWaterType').value=/river|stream/i.test(w.water_type)?(/stream/i.test(w.water_type)?'Stream':'River'):'Lake'}showPage('mission');setTimeout(()=>$('liveWeather')?.click(),150)};$('refreshContext').onclick=()=>last&&load(last)}
 async function loadAccessAndDepth(pos,w){
  if(!w)return{access:null,depth:null};
  const [access,depth]=await Promise.allSettled([
   api('/functions/v1/atlas-water-access',{method:'POST',body:JSON.stringify({waterbody_id:w.id||null,lat:+pos.lat,lon:+pos.lon,state_code:w.state_code})}),
   api('/functions/v1/atlas-water-depth',{method:'POST',body:JSON.stringify({lat:+pos.lat,lon:+pos.lon,state_code:w.state_code,water_type:w.water_type,lake_name:w.name})})
  ]);
  return{access:access.status==='fulfilled'?access.value:null,depth:depth.status==='fulfilled'?depth.value:null};
 }
 async function load(pos){if(!session?.user||!pos)return;last=pos;const box=ensurePanel();box.innerHTML='<h2>Fishing context</h2><p class="muted">Loading exact-position context…</p>';try{const d=await api('/rest/v1/rpc/atlas_map_context',{method:'POST',body:JSON.stringify({p_lat:+pos.lat,p_lon:+pos.lon,p_radius_miles:+($('mapRadius')?.value||10)})});window.atlasMapContext=d;const extra=await loadAccessAndDepth(pos,d.selected_water);d._access=extra.access?.access_points||null;d._depth=extra.depth||null;draw(d);render(d);if(d.selected_water&&!window.selectedWater){window.selectedWater=d.selected_water;document.dispatchEvent(new CustomEvent('atlas:water-selected',{detail:{water:d.selected_water,automatic:true,position:pos}}))}}catch(e){box.innerHTML=`<h2>Fishing context</h2><div class="warning">${esc(e.message)}</div>`}}
 document.addEventListener('atlas:fishing-position',e=>load(e.detail));document.addEventListener('atlas:water-selected',e=>{if(last&&e.detail?.water)load({...last,waterbody_id:e.detail.water.id})});document.readyState==='loading'?document.addEventListener('DOMContentLoaded',ensurePanel):ensurePanel();
})();