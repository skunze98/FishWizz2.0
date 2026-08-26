(()=>{
 let map,clickMarker,gpsMarker,gpsAccuracyCircle;let waterMarkers=[],nearbyRows=[],requestId=0,position=null,searchTimer=null,searchHint=null;const byId=id=>document.getElementById(id);
 // P0-3 (river-to-lake false matches): atlas-place-search already returns
 // Nominatim's own category/type for every result (confirmed live in the
 // edge function) -- e.g. "waterway"/"dam" for a Lock and Dam search -- but
 // it was being thrown away the moment a suggestion was clicked, so
 // bestWater() below had no way to know the user searched for a river
 // feature, not a lake. searchHint carries that signal from the search
 // click through setFishingPosition into the matching step; a plain map tap
 // (no search involved) leaves it null, which is the pre-existing behavior.
 const RIVERLIKE_RE=/\b(river|stream|creek|dam|lock|tailwater|weir|rapids|falls|channel)\b/i;
 function hintIsRiverlike(hint){if(!hint)return false;return RIVERLIKE_RE.test(`${hint.category||''} ${hint.type||''} ${hint.name||''}`)}
 // Map-wide depth filter (distinct from map-context.js's single-selected-water
 // depth panel): a Leaflet overlay layer, toggled from the map's own layer
 // control, that loads every DNR-surveyed lake's contours inside the current
 // viewport from atlas-water-depth's bbox/"area" mode. DEPTH_MIN_ZOOM keeps a
 // zoomed-out view from firing a request the backend would just reject as too
 // wide (see MAX_BBOX_MILES server-side) -- this is the client-side half of
 // that same guard, not a separate rule.
 let depthLayer=null,depthOn=false,depthReqId=0,depthTimer=null;const DEPTH_MIN_ZOOM=10;
 function icon(cls,size=14){return L.divIcon({className:'',html:`<div class="${cls}" style="width:${size}px;height:${size}px"></div>`,iconSize:[size,size],iconAnchor:[size/2,size/2]})}
 function ensureControls(){const toolbar=document.querySelector('#waters .map-toolbar');if(!toolbar||byId('spotSearch'))return;const radiusLabel=byId('mapRadius')?.closest('label');if(radiusLabel)radiusLabel.hidden=true;toolbar.insertAdjacentHTML('afterbegin',`<div class="fw-spot-tools"><label class="fw-spot-search"><span>Search place or water</span><div><input id="spotSearch" placeholder="Lake Zumbro, Mississippi River, a launch, park…" autocomplete="off"><button id="spotSearchBtn" class="btn gold" type="button">Find</button></div></label><div id="spotSuggestions" class="suggestions" hidden></div></div>`);let card=byId('positionCard');if(!card){card=document.createElement('div');card.id='positionCard';card.className='map-note fw-position-card';card.textContent='Tap the exact place you will stand, dock, wade, or fish from shore.';toolbar.insertAdjacentElement('afterend',card)}}
 function ensureDepthNote(){const mapEl=byId('watersMap');if(!mapEl)return null;let note=byId('depthLegend');if(!note){note=document.createElement('div');note.id='depthLegend';note.className='map-note fw-depth-note';note.hidden=true;mapEl.insertAdjacentElement('afterend',note)}return note}
 function setDepthNote(html){const n=ensureDepthNote();if(!n)return;n.innerHTML=html||'';n.hidden=!html}
 function depthColor(depthFt,maxDepth){const t=maxDepth?Math.min(1,depthFt/maxDepth):0;return `hsl(${205-t*45},70%,${62-t*30}%)`}
 // The longest of a contour feature's paths -- used as the anchor for that
 // depth's visible number, since a single depth value on a big lake often
 // arrives as several disconnected ring segments and only the main one is
 // worth labeling.
 function longestPath(paths){return(paths||[]).reduce((a,p)=>Array.isArray(p)&&p.length>(a?a.length:0)?p:a,null)}
 function depthLabelMarker(latlon,text){if(!latlon)return null;return L.marker(latlon,{icon:L.divIcon({className:'depth-label-icon',html:`<span class="depth-label">${text}</span>`,iconSize:[0,0]}),interactive:false,keyboard:false})}
 // Draws every contour line for a lake (unchanged) plus one visible "NN ft"
 // label per index depth (multiples of 10, since the DNR survey's own
 // interval is 5 ft) at that depth's longest segment -- labeling every one of
 // a big lake's several-hundred contour segments would bury the map in text.
 function drawLakeContours(lake){
  const bestByDepth=new Map();
  (lake.contours||[]).forEach(c=>{
   if(!Array.isArray(c.paths)||!c.paths.length)return;
   L.polyline(c.paths,{color:depthColor(c.depth_ft,lake.max_depth_ft),weight:c.depth_ft<=0?1.2:1.6,opacity:.8}).bindTooltip(`${esc(lake.lake_name||'Lake')}${c.depth_ft>0?` · ${c.depth_ft} ft`:' · Shoreline'}`).addTo(depthLayer);
   const lp=longestPath(c.paths),existing=bestByDepth.get(c.depth_ft);
   if(lp&&(!existing||lp.length>existing.length))bestByDepth.set(c.depth_ft,lp);
  });
  bestByDepth.forEach((path,depthFt)=>{
   if(depthFt<=0||depthFt%10!==0)return;
   const m=depthLabelMarker(path[Math.floor(path.length/2)],`${depthFt} ft`);
   if(m)m.addTo(depthLayer);
  });
 }
 // Wisconsin has no contour lines to draw, only one reported max depth per
 // lake (see atlas-water-depth's wi_lakes) -- a gold marker at the lake's
 // approximate center with the number always visible, distinct in style from
 // MN's blue-to-green contour gradient so the two data qualities never look
 // like the same kind of fact.
 function drawWiLake(w){
  if(!Number.isFinite(Number(w.lat))||!Number.isFinite(Number(w.lon)))return;
  L.circleMarker([+w.lat,+w.lon],{radius:5,weight:2,color:'#d7b55b',fillColor:'#d7b55b',fillOpacity:.75}).bindTooltip(`${esc(w.lake_name||'Lake')} · reported max ${esc(w.max_depth_ft)} ft (${esc(w.depth_source||'WDNR')})`).addTo(depthLayer);
  const m=depthLabelMarker([+w.lat,+w.lon],`${w.max_depth_ft} ft max`);
  if(m)m.addTo(depthLayer);
 }
 async function refreshDepthLayer(){
  if(!depthOn||!map||!depthLayer)return;
  const zoom=map.getZoom();
  if(zoom<DEPTH_MIN_ZOOM){depthLayer.clearLayers();setDepthNote('<b>Depth:</b> zoom in further to load lake depth data for this area.');return}
  if(!session){setDepthNote('<b>Depth:</b> sign in to load DNR lake survey data.');return}
  const b=map.getBounds(),id=++depthReqId;
  setDepthNote('<b>Depth:</b> loading DNR survey data for this area…');
  try{
   const data=await api('/functions/v1/atlas-water-depth',{method:'POST',body:JSON.stringify({bbox:{min_lat:b.getSouth(),min_lon:b.getWest(),max_lat:b.getNorth(),max_lon:b.getEast()}})});
   if(id!==depthReqId)return;
   depthLayer.clearLayers();
   if(!data.available){setDepthNote(`<b>Depth:</b> ${esc(data.reason||'Not available for this area.')}${data.note?`<br><span class="muted tiny">${esc(data.note)}</span>`:''}`);return}
   (data.lakes||[]).forEach(drawLakeContours);
   (data.wi_lakes||[]).forEach(drawWiLake);
   const trunc=data.truncated?' · zoom in for full detail here':'';
   const wiCount=(data.wi_lakes||[]).length;
   const parts=[];
   if(data.lake_count)parts.push(`${data.lake_count} MN lake${data.lake_count===1?'':'s'} with contour lines (numbers shown at 10-ft intervals) · ${data.contour_count} lines${trunc}`);
   if(wiCount)parts.push(`${wiCount} WI lake${wiCount===1?'':'s'} with a reported max depth (gold markers)`);
   setDepthNote(parts.length?`<b>Depth:</b> ${parts.join(' · ')}<br><span class="muted tiny">${esc(data.note||'')}</span>`:`<b>Depth:</b> no DNR-surveyed lakes in this view.<br><span class="muted tiny">${esc(data.note||'')}</span>`);
  }catch(e){if(id!==depthReqId)return;setDepthNote(`<b>Depth:</b> <span class="warning">${esc(e.message)}</span>`)}
 }
 function scheduleDepthRefresh(){clearTimeout(depthTimer);depthTimer=setTimeout(refreshDepthLayer,450)}
 function ensureMap(){if(map||!window.L||!byId('watersMap'))return;map=L.map('watersMap',{zoomControl:true,preferCanvas:true}).setView([44.3,-93.5],7);window.atlasMap=map;const street=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,updateWhenIdle:true,keepBuffer:2,attribution:'&copy; OpenStreetMap contributors'}),topo=L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,updateWhenIdle:true,keepBuffer:1,attribution:'Map data &copy; OpenStreetMap, SRTM'});street.addTo(map);depthLayer=L.layerGroup();L.control.layers({Street:street,Terrain:topo},{'Depth (MN contours + WI max depth)':depthLayer},{position:'topright'}).addTo(map);map.on('overlayadd',e=>{if(e.layer===depthLayer){depthOn=true;refreshDepthLayer()}});map.on('overlayremove',e=>{if(e.layer===depthLayer){depthOn=false;depthLayer.clearLayers();setDepthNote('')}});map.on('moveend zoomend',()=>{if(depthOn)scheduleDepthRefresh()});map.on('click',e=>setFishingPosition(e.latlng.lat,e.latlng.lng,'map_tap'));setTimeout(()=>map.invalidateSize(),120)}
 const fmt=(lat,lon)=>`${lat.toFixed(5)}, ${lon.toFixed(5)}`,method=m=>({gps_fix:'Your location',map_tap:'Pinned fishing spot',place_search:'Searched spot'})[m]||'Fishing spot';
 function updatePositionCard(){const box=byId('positionCard');if(!box)return;if(!position){box.innerHTML='<b>Choose your fishing spot</b><br><span class="muted tiny">Tap the map, search a place, or use your location.</span>';return}const acc=Number.isFinite(position.accuracy)?` · ±${Math.round(position.accuracy)} m`:'';const water=position.water_name?`<div class="fw-resolved-water"><b>${esc(position.water_name)}</b><span>${esc(position.water_type||'water')} · ${esc(position.state_code||'')}</span></div>`:'<div class="muted tiny fw-matching">Identifying the water at this exact spot…</div>';box.innerHTML=`<div class="fw-position-head"><div><b>${esc(method(position.method))}</b><br><span class="muted tiny">${esc(fmt(position.lat,position.lon))}${acc}</span></div></div>${water}<button id="missionFromSpot" type="button" class="btn gold" ${position.water_name?'':'disabled'}>${position.water_name?'Build Mission from this spot':'Matching water…'}</button>`;byId('missionFromSpot')?.addEventListener('click',()=>{if(!position.water_name)return;if(byId('mWater'))byId('mWater').value=position.water_name;if(byId('mWaterType'))byId('mWaterType').value=/stream/i.test(position.water_type||'')?'Stream':/river/i.test(position.water_type||'')?'River':/reservoir|flowage/i.test(position.water_type||'')?'Reservoir':'Lake';showPage('mission')});window.atlasFishingLocation={...position};document.dispatchEvent(new CustomEvent('atlas:fishing-position',{detail:window.atlasFishingLocation}))}
 function clearWaterMarkers(){waterMarkers.forEach(m=>m.remove());waterMarkers=[]}
 function drawSelection(lat,lon){clickMarker?.remove();clickMarker=L.marker([lat,lon],{icon:icon('selected-pin',20),zIndexOffset:1000,draggable:true}).addTo(map).bindTooltip('Your exact fishing spot',{direction:'top'});clickMarker.on('dragend',e=>{const p=e.target.getLatLng();setFishingPosition(p.lat,p.lng,'map_tap',null,false)})}
 function clearResolvedWater(){window.selectedWater=null;if(!position)return;delete position.waterbody_id;delete position.water_name;delete position.water_type;delete position.state_code}
 function setFishingPosition(lat,lon,m='map_tap',accuracy=null,recenter=true,hint=null){if(!Number.isFinite(lat)||!Number.isFinite(lon))return;position={lat,lon,method:m,accuracy,selected_at:new Date().toISOString()};searchHint=hint;clearResolvedWater();drawSelection(lat,lon);updatePositionCard();if(recenter)map.flyTo([lat,lon],Math.max(map.getZoom(),15),{duration:.25});findNearby(lat,lon)}
 function rankWater(w){const match=String(w.match_type||'').toLowerCase(),d=Number(w.distance_miles??999);let p=30;if(match==='on_water')p=0;else if(match==='very_close')p=1;else if(match==='cached')p=4;else p=3;const type=String(w.water_type||'').toLowerCase();const shorelineBias=/river|stream/.test(type)&&d<=.2?-0.2:0;return p*100+d+shorelineBias}
 // P0-3: a search explicitly for a river/dam/tailwater feature must not
 // resolve to a nearby lake just because it's geometrically closer --
 // exclude lake-type candidates outright rather than merely down-ranking
 // them, so distance can never override the type mismatch. Lake searches
 // (hint not riverlike, or no hint at all -- a plain map tap) are completely
 // unaffected: this only ever narrows the candidate set, never re-ranks it.
 function bestWater(rows,hint){let candidates=[...rows].filter(Boolean);if(hintIsRiverlike(hint))candidates=candidates.filter(w=>String(w.water_type||'').toLowerCase()!=='lake');const best=candidates.sort((a,b)=>rankWater(a)-rankWater(b))[0]||null;if(!best)return null;const d=Number(best.distance_miles??999),m=String(best.match_type||'').toLowerCase();return m==='on_water'||m==='very_close'||d<=.4?best:null}
 function distanceLabel(w){const d=Number(w.distance_miles||0);return w.match_type==='on_water'?'Exact spot':d<.1?`${Math.max(1,Math.round(d*5280))} ft away`:`${d.toFixed(1)} mi away`}
 function confidenceLabel(w){const m=String(w.match_type||'').toLowerCase(),d=Number(w.distance_miles||999);if(m==='on_water')return'High-confidence water match';if(m==='very_close'||d<=.08)return'High-confidence shoreline match';return'Likely water match'}
 function renderResolved(best){nearbyRows=best?[best]:[];const box=byId('mapResults');if(!box)return;if(!best){box.innerHTML='<div class="map-note"><b>No confident water match yet.</b><br><span class="muted tiny">Move the pin a little closer to the shoreline or search the water by name. FishWizz will not guess.</span></div>';return}box.innerHTML=`<div class="fw-nearby-title"><b>FishWizz matched this spot to</b></div><div class="map-result active fw-best-water"><span class="distance">${distanceLabel(best)}</span><b>${esc(best.name)}</b><br><span class="muted tiny">${esc(best.state_code||'')} · ${esc(best.water_type||'water')} · ${esc(confidenceLabel(best))}</span></div>`}
 function drawBestMarker(w){clearWaterMarkers();if(!w||!Number.isFinite(Number(w.latitude))||!Number.isFinite(Number(w.longitude)))return;const m=L.marker([Number(w.latitude),Number(w.longitude)],{icon:icon('water-marker exact',13)}).addTo(map).bindTooltip(w.name||'Matched water');waterMarkers.push(m)}
 function selectNearby(index=0,automatic=false){const water=nearbyRows[index];if(!water)return;window.selectedWater={...water};if(position){position={...position,waterbody_id:water.id||null,water_name:water.name,water_type:water.water_type,state_code:water.state_code};if(byId('mWater'))byId('mWater').value=water.name||'';updatePositionCard();document.dispatchEvent(new CustomEvent('atlas:water-selected',{detail:{water,automatic,position:window.atlasFishingLocation}}))}drawBestMarker(water);if(!automatic&&typeof loadWater==='function')loadWater(water)}
 // P0-3 fallback: when a riverlike search hint exists but no type-compatible
 // water could be confirmed nearby, keep the searched place's own name and
 // coordinates as an unconfirmed candidate instead of either substituting a
 // wrong nearby lake or just saying "no match" and discarding what the user
 // actually typed. Requires an explicit tap to use it for a Mission --
 // never auto-selected the way a confident match is.
 function useSearchedLabel(lat,lon){const label={id:null,name:searchHint.name,state_code:searchHint.state||null,water_type:hintIsRiverlike(searchHint)?'river':null,latitude:lat,longitude:lon,distance_miles:0,match_type:'searched_label'};nearbyRows=[label];clearWaterMarkers();const box=byId('mapResults');if(box)box.innerHTML=`<div class="map-note"><b>Using "${esc(searchHint.name)}" as searched.</b><br><span class="muted tiny">FishWizz could not confirm a matching indexed water here, so it kept your search instead of guessing a nearby one.</span></div><button class="result active" id="confirmSearchedLabel" type="button"><b>${esc(searchHint.name)}</b><br><span class="muted tiny">Unconfirmed water · tap to use it for your Mission anyway</span></button>`;byId('confirmSearchedLabel')?.addEventListener('click',()=>selectNearby(0,true));stat(`Could not confirm a matching water for "${searchHint.name}" -- kept your search instead of guessing.`,'ok')}
 async function findNearby(lat,lon){ensureMap();const box=byId('mapResults');if(!session){if(box)box.innerHTML='<div class="map-note"><b>Spot saved.</b><br><span class="muted tiny">Sign in to identify the named water and use it in your Mission.</span></div>';stat('Spot selected. Sign in for water matching.','ok');return}const id=++requestId;if(box)box.innerHTML='<div class="map-note">Identifying the water at this exact spot…</div>';try{const data=await api('/functions/v1/atlas-nearby-waters',{method:'POST',body:JSON.stringify({lat,lon,radius_miles:5,refresh:false})});if(id!==requestId)return;const best=bestWater((data.waters||[]).filter(Boolean),searchHint);if(best){renderResolved(best);selectNearby(0,true);stat(`Matched to ${best.name}.`,'ok')}else if(searchHint?.name&&hintIsRiverlike(searchHint)){useSearchedLabel(lat,lon)}else{renderResolved(null);clearWaterMarkers();stat('No confident water match yet. Move the pin closer to the shoreline.','ok')}}catch(e){if(id!==requestId)return;if(box)box.innerHTML=`<div class="warning">${esc(e.message)}</div>`;stat(e.message,'err')}}
 function showGps(lat,lon,accuracy){gpsMarker?.remove();gpsAccuracyCircle?.remove();gpsMarker=L.marker([lat,lon],{icon:icon('water-marker exact',16),zIndexOffset:1200}).addTo(map).bindTooltip('Your location');gpsAccuracyCircle=L.circle([lat,lon],{radius:accuracy||10,color:'#4aa3ff',weight:1,fillOpacity:.05,interactive:false}).addTo(map)}
 function useLocation(){if(!navigator.geolocation)return stat('Location is not supported.','err');stat('Finding your location…');navigator.geolocation.getCurrentPosition(p=>{ensureMap();showGps(p.coords.latitude,p.coords.longitude,p.coords.accuracy);map.setView([p.coords.latitude,p.coords.longitude],p.coords.accuracy<=50?16:14);setFishingPosition(p.coords.latitude,p.coords.longitude,'gps_fix',p.coords.accuracy,false)},e=>stat(e.message||'Location permission was not granted.','err'),{enableHighAccuracy:true,timeout:15000,maximumAge:10000})}
 async function searchPlaces(){const q=byId('spotSearch')?.value.trim(),box=byId('spotSuggestions');if(!q||q.length<2)return;if(!session){stat('Sign in to search places and waters.','err');return}box.hidden=false;box.innerHTML='<div class="map-note">Searching…</div>';try{const data=await api('/functions/v1/atlas-place-search',{method:'POST',body:JSON.stringify({q})}),rows=(data.results||[]).slice(0,6);box.innerHTML=rows.length?rows.map((r,i)=>`<button class="suggestion" data-place="${i}" type="button"><b>${esc(r.name)}</b><br><span class="muted tiny">${esc(r.display_name)}</span></button>`).join(''):'<div class="map-note">No matching place found.</div>';box.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>{const r=rows[Number(b.dataset.place)];box.hidden=true;byId('spotSearch').value=r.name;map.setView([r.latitude,r.longitude],15);setFishingPosition(r.latitude,r.longitude,'place_search',null,true,{name:r.name,category:r.category,type:r.type,state:r.state})})}catch(e){box.innerHTML=`<div class="warning">${esc(e.message)}</div>`}}
 if(typeof document!=='undefined'){
  window.AtlasMap={getMap:()=>map,getPosition:()=>position,setPosition:setFishingPosition,selectWater:selectNearby,refresh:()=>position&&findNearby(position.lat,position.lon)};
  document.addEventListener('DOMContentLoaded',()=>{ensureControls();ensureMap();byId('useLocation')?.addEventListener('click',useLocation);byId('spotSearchBtn')?.addEventListener('click',searchPlaces);byId('spotSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchPlaces()}});byId('spotSearch')?.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(byId('spotSearch').value.trim().length>=3)searchPlaces()},420)});document.querySelector('[data-page="waters"]')?.addEventListener('click',()=>setTimeout(()=>map?.invalidateSize(),80))});
 }
 // Exposed only for scripts/test-p0-fixes.mjs, which imports this file for
 // its side effect and reads this namespace back -- see mission-why.js's own
 // comment on this same pattern for why it isn't module.exports.
 globalThis.__fishwizzTest=Object.assign(globalThis.__fishwizzTest||{},{map:{hintIsRiverlike,bestWater,rankWater}});
})();