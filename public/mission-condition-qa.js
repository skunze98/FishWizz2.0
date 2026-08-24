(()=>{
 const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function neutralizePressure(detail){const c=detail?.context||window.lastMission?.context,r=detail?.recommendation||window.lastMission?.recommendation;if(!c||!r)return;const pressure=String(c.pressure_trend||'').toLowerCase();if(!['falling','rising'].includes(pressure))return;if(pressure==='falling'&&Number.isFinite(Number(r.confidence)))r.confidence=Math.max(40,Number(r.confidence)-3);r.adjustment_plan='Treat barometric pressure as context, not a standalone bite predictor. Prioritize observed fish activity, location and depth, wind/light, then retrieve speed before changing presentation.';const summary=$('planSummary');if(summary){const adjustment=[...summary.querySelectorAll('p')].find(p=>p.querySelector('b')?.textContent?.trim()==='Adjustment:');if(adjustment)adjustment.innerHTML=`<b>Adjustment:</b> ${esc(r.adjustment_plan)}`;const confidence=[...summary.querySelectorAll('.pill')].find(x=>/^Confidence\s/i.test(x.textContent||''));if(confidence)confidence.textContent=`Confidence ${r.confidence}%`}try{const uid=session?.user?.id;if(uid)localStorage.setItem(`atlas:lastMission:${uid}`,JSON.stringify({saved_at:new Date().toISOString(),context:c,recommendation:r}))}catch{}}
 function reads(c={}){const t=String(c.target||'').toLowerCase(),season=String(c.season||'').toLowerCase(),light=String(c.light||'').toLowerCase(),depth=String(c.depth||'').toLowerCase(),cover=String(c.cover||'').toLowerCase(),clarity=String(c.clarity||'').toLowerCase(),rows=[];
  if(/walleye|sauger/.test(t)){
   if(season==='summer')rows.push(['DEPTH','Summer walleyes often shift deeper as water warms; favor structure, depth control, and bottom-aware presentations before assuming shallow water.']);
   if(light==='low')rows.push(['LIGHT','Dawn and dusk can pull walleyes shallower to feed. A shallow flat, weedline, point, or reef can become more useful than it was in bright light.']);
   if(season==='fall')rows.push(['COVER WATER','Fall is a good time to cover shallow-to-mid-depth weedlines, gravel, and points with small hard baits; keep trolling speed slow—around 1 mph or only fast enough to make the lure work.']);
  }
  if(/largemouth|^bass$/.test(t)){
   if(season==='summer'&&depth!=='deep')rows.push(['SUMMER','On hot summer days, deeper/cooler water, outside weed edges, humps, and points deserve time if shallow cover is quiet.']);
   if(light==='low')rows.push(['LOW LIGHT','Morning and evening can make shallow and surface presentations especially useful before brighter conditions push fish tighter to cover or deeper.']);
   if(/grass|lily|wood/.test(cover))rows.push(['COVER','Keep the presentation weedless around vegetation and wood; add weight only when depth, wind, or cover penetration requires it.']);
  }
  if(/northern pike/.test(t)){
   rows.push(['AMBUSH ZONE','Start around weedbeds, rocky points, bulrush edges, timber, backwaters, or eddies—places pike can hold and ambush prey.']);
   if(light==='low')rows.push(['TIMING','Early morning and evening are productive pike periods, and pike can still be caught through the day. They are sight feeders and generally bite less at night.']);
  }
  if(/crappie/.test(t)){
   if(/grass|mixed/.test(cover))rows.push(['WEED EDGE','Cast small jigs along the outside weed edge and retrieve slowly with occasional jigging motions; with a bobber-rigged minnow, prioritize holding the bait at the depth where the school is suspended.']);
   if(light==='low'&&clarity==='clear')rows.push(['TIMING','In clear water, dawn and dusk can be especially productive. Once you contact crappies, track their exact depth because schools commonly suspend.']);
   else if(/stained|dirty/.test(clarity))rows.push(['TIMING','Do not write off the daytime bite in stained or dirty water. Prioritize finding the school and matching its suspended depth over waiting only for dawn or dusk.']);
   else if(light==='low')rows.push(['TIMING','Low light can be productive, but the bigger key is finding the school and matching its suspended depth.']);
  }
  if(/yellow perch/.test(t)){
   rows.push(['BOTTOM','Yellow perch are primarily bottom-oriented feeders. Keep small minnows, worms, jigs, or plastics near bottom unless the school shows otherwise.']);
   if(depth!=='shallow')rows.push(['DEPTH','Perch commonly use cooler, deeper water. Use enough weight for precise depth control without overpowering the presentation.']);
   rows.push(['SCHOOL','Perch travel in schools. If a spot stays quiet after a few good presentations, move and relocate the school instead of waiting indefinitely.']);
  }
  if(/bluegill|sunfish|pumpkinseed/.test(t)){
   if(season==='summer')rows.push(['SUMMER','Larger sunfish often use deeper weedlines, humps, and vertical cover; a slip float helps hold a small bait precisely at depth.']);
   rows.push(['PACE','Bluegill often inspect a bait closely. Start slow or nearly still and only add motion when the fish show they want it.']);
  }
  return rows.slice(0,3)
 }
 function render(detail){neutralizePressure(detail);const c=detail?.context||window.lastMission?.context;if(!c)return;const anchor=$('missionFieldQa')||$('planSummary');if(!anchor)return;const rows=reads(c);let el=$('missionConditionQa');if(!rows.length){el?.remove();return}if(!el){el=document.createElement('section');el.id='missionConditionQa';el.className='card';anchor.insertAdjacentElement('afterend',el)}el.innerHTML=`<span class="eyebrow">Condition read</span><h3>Adjust before you change everything</h3>${rows.map(([k,v])=>`<div style="margin-top:9px"><span class="pill">${esc(k)}</span><p class="muted tiny" style="margin:.35rem 0 0">${esc(v)}</p></div>`).join('')}`}
 document.addEventListener('atlas:mission-built',e=>render(e.detail));document.addEventListener('atlas:repeat-last-mission',()=>setTimeout(()=>render(window.lastMission),340));if(window.lastMission)setTimeout(()=>render(window.lastMission),560);window.atlasMissionConditionQa=true;
})();