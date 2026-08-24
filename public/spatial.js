(()=>{
 const $=id=>document.getElementById(id);
 const dirs=['N','NE','E','SE','S','SW','W','NW'];
 const norm=d=>(d%360+360)%360;
 const dir=d=>dirs[Math.round(norm(d)/45)%8];
 function bearing(a,b){const p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dl=(b.lon-a.lon)*Math.PI/180;return norm(Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl))*180/Math.PI)}
 function angleDiff(a,b){return Math.abs(((a-b+540)%360)-180)}
 function analysis(){
  const p=window.atlasFishingLocation,w=window.selectedWater,wx=window.atlasLiveWeather;
  if(!p||!w)return null;
  const slat=Number(w.latitude),slon=Number(w.longitude);if(!Number.isFinite(slat)||!Number.isFinite(slon))return null;
  const waterBearing=bearing(p,{lat:slat,lon:slon});
  const windFrom=Number(wx?.current?.wind_direction_10m),windTo=Number.isFinite(windFrom)?norm(windFrom+180):null;
  const relation=windTo===null?'unknown':angleDiff(windTo,waterBearing)<=45?'toward_water':angleDiff(windTo,norm(waterBearing+180))<=45?'toward_angler':'crosswind';
  const type=String(w.water_type||'').toLowerCase();
  let firstCast,secondCast,why;
  if(/river|stream/.test(type)){
    firstCast=`Cast ${dir(waterBearing)} toward the nearest channel edge, then work 30–45° upstream and let the lure sweep across current.`;
    secondCast='Next, cast nearly parallel to the bank through slower water beside the main current, seams, eddies, or current breaks.';
    why='River fish commonly use current boundaries rather than holding in the fastest water. The angle helps the lure travel naturally into the strike zone.';
  }else{
    firstCast=`Start toward ${dir(waterBearing)}—the nearest water-facing direction—then fan-cast roughly 30° left and right.`;
    secondCast='Make several casts parallel to the shoreline before casting straight out, especially around grass, rock, docks, shade, or a visible depth change.';
    why='Parallel casts keep the lure in the productive shoreline depth and cover zone longer than a straight-out cast.';
  }
  let windNote='Live wind direction has not been loaded yet.';
  if(relation==='toward_angler')windNote='Wind is pushing water and drifting food toward your position. Prioritize the wind-blown bank and retrieve with control because waves may hide subtle bites.';
  if(relation==='toward_water')windNote='Wind is blowing away from your position. Casting distance may improve with the wind, but this bank may receive less bait concentration than the opposite shoreline.';
  if(relation==='crosswind')windNote='Wind is crossing the selected position. Use lower, more controlled casts and work the windward side of points, docks, current seams, and cover.';
  const confidence=wx?'moderate':'basic';
  return{waterBearing,waterDirection:dir(waterBearing),windFrom:Number.isFinite(windFrom)?windFrom:null,windTo,relation,firstCast,secondCast,why,windNote,confidence,water_type:type||'unknown',generated_at:new Date().toISOString()};
 }
 function render(){
  const a=analysis();window.atlasSpatialAnalysis=a;
  let box=$('spatialPlan');
  if(!box){const summary=$('planSummary');if(!summary)return;box=document.createElement('div');box.id='spatialPlan';box.className='card';summary.insertAdjacentElement('afterend',box)}
  if(!a){box.innerHTML='<span class="eyebrow">Cast Direction</span><h3>Select an exact fishing position and water</h3><p class="muted">Atlas needs both points before it can orient the angler to the shoreline or river segment.</p>';return}
  box.innerHTML=`<span class="eyebrow">Spatial Mentor · ${a.confidence} confidence</span><h3>Face ${a.waterDirection} toward the nearest official water segment</h3><p><b>First cast:</b> ${esc(a.firstCast)}</p><p><b>Second pattern:</b> ${esc(a.secondCast)}</p><p><b>Wind read:</b> ${esc(a.windNote)}</p><p><b>Why:</b> ${esc(a.why)}</p><p class="muted tiny">This is coordinate-based guidance using the selected fishing pin, nearest mapped water segment, water type, and loaded wind. It does not yet identify submerged contour or private-property boundaries.</p>`;
 }
 document.addEventListener('atlas:fishing-position',()=>setTimeout(render,50));
 const old=window.loadWater;if(typeof old==='function')window.loadWater=async function(w){const r=await old(w);setTimeout(render,80);return r};
 const oldFetch=window.fetch; // live weather is stored by Mission; periodic refresh catches it without modifying network calls
 setInterval(()=>{if(window.atlasLiveWeather||window.selectedWater)render()},2500);
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>setTimeout(render,400)):setTimeout(render,400);
})();