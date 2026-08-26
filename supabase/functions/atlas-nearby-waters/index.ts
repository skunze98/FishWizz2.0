import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { reportError } from "../_shared/sentry.ts";

const cors={"access-control-allow-origin":"*","access-control-allow-headers":"authorization, x-client-info, apikey, content-type","access-control-allow-methods":"POST, OPTIONS","content-type":"application/json"};
const reply=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:cors});
// WI sources: NOT ER_Biotics_WGS84_Hydro -- verified live 2026-08-26 that
// that service returns features far outside Wisconsin (a real Minnesota
// lake, "Zumbro Lake", came back from it as an on-water WI match, ~60 miles
// west of the actual state line -- this is why a real MN angler's depth data
// was going missing, misidentified as a non-existent WI lake). Confirmed:
// both its lake (layer 0) and stream (layer 1) sublayers do this, all with
// WBIC 0 for the phantom rows, so it isn't just a border-adjacency quirk.
// DW_Map_Dynamic/EN_SurfaceWater_WTM_Ext_Dynamic_L16 is WI's real 24K hydro
// layer (native WTM/EPSG:3071, the state's own plane) and DOES carry a
// genuine boundary field, IN_STATE_CODE -- 0 for the same cross-border
// buffer rows included for map-continuity/cartographic reasons, 1 for
// features actually inside Wisconsin. Verified both ends live: the Zumbro
// bbox returns zero rows with IN_STATE_CODE=1, and a real Madison-area bbox
// still correctly returns Mendota/Monona/Wingra with their real WBICs.
const sources=[{state:'MN',key:'mn_dnr_basins',label:'Minnesota DNR Public Waters',url:'https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/water_mn_public_waters/FeatureServer/1/query',name:'pw_basin_name',id:'dnr_hydro_id',type:'lake'},{state:'MN',key:'mn_dnr_streams',label:'Minnesota DNR Rivers and Streams',url:'https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/water_dnr_hydrography/FeatureServer/0/query',name:'kittle_name',id:'dnr_hydro_id',type:'stream'},{state:'WI',key:'wi_dnr_lakes',label:'Wisconsin DNR 24K Hydrography',url:'https://dnrmaps.wi.gov/arcgis/rest/services/DW_Map_Dynamic/EN_SurfaceWater_WTM_Ext_Dynamic_L16/MapServer/5/query',name:'WATERBODY_NAME',id:'WATERBODY_WBIC',type:'lake',extraWhere:'AND IN_STATE_CODE=1'},{state:'WI',key:'wi_dnr_streams',label:'Wisconsin DNR 24K Hydrography',url:'https://dnrmaps.wi.gov/arcgis/rest/services/DW_Map_Dynamic/EN_SurfaceWater_WTM_Ext_Dynamic_L16/MapServer/3/query',name:'RIVER_SYS_NAME',id:'RIVER_SYS_WBIC',type:'stream',extraWhere:'AND IN_STATE_CODE=1'}];
type Pt=[number,number];const R=3958.7613;function hav(a:Pt,b:Pt){const dlat=(b[1]-a[1])*Math.PI/180,dlon=(b[0]-a[0])*Math.PI/180,la1=a[1]*Math.PI/180,la2=b[1]*Math.PI/180,h=Math.sin(dlat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dlon/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)))}function project(p:Pt,lat0:number):Pt{return[p[0]*Math.cos(lat0*Math.PI/180)*69,p[1]*69]}function unproject(p:Pt,lat0:number):Pt{return[p[0]/(Math.cos(lat0*Math.PI/180)*69),p[1]/69]}function closestSeg(p:Pt,a:Pt,b:Pt,lat0:number):Pt{const pp=project(p,lat0),aa=project(a,lat0),bb=project(b,lat0),dx=bb[0]-aa[0],dy=bb[1]-aa[1],den=dx*dx+dy*dy;if(!den)return a;const t=Math.max(0,Math.min(1,((pp[0]-aa[0])*dx+(pp[1]-aa[1])*dy)/den));return unproject([aa[0]+t*dx,aa[1]+t*dy],lat0)}function pointInRing(p:Pt,r:Pt[]){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const[xi,yi]=r[i],[xj,yj]=r[j];if(((yi>p[1])!==(yj>p[1]))&&(p[0]<(xj-xi)*(p[1]-yi)/(yj-yi||1e-12)+xi))inside=!inside}return inside}function paths(g:any):Pt[][]{return Array.isArray(g?.paths)?g.paths:Array.isArray(g?.rings)?g.rings:g?.x!=null&&g?.y!=null?[[[g.x,g.y]]]:[]}function nearest(g:any,p:Pt){const groups=paths(g);if(g?.rings&&groups.some(r=>pointInRing(p,r)))return{point:p,distance:0};let best=p,bestD=Infinity;for(const line of groups){if(line.length===1){const d=hav(p,line[0]);if(d<bestD){bestD=d;best=line[0]}}for(let i=1;i<line.length;i++){const q=closestSeg(p,line[i-1],line[i],p[1]),d=hav(p,q);if(d<bestD){bestD=d;best=q}}}return{point:best,distance:bestD}}function norm(s:string){return s.toLowerCase().replace(/\b(lake|river|stream|creek|flowage|reservoir)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim()}function dedupe(rows:any[]){const out:any[]=[],seen=new Map<string,number>();for(const r of rows){const key=`${norm(String(r.name||''))}:${String(r.water_type||'').replace('stream','river')}`;if(!key||key===':')continue;const prior=seen.get(key);if(prior==null){seen.set(key,out.length);out.push(r)}else if(Number(r.distance_miles||999)<Number(out[prior].distance_miles||999))out[prior]=r}return out.sort((a,b)=>Number(a.distance_miles||999)-Number(b.distance_miles||999))}

// esri JSON geometry (what these ArcGIS sources return with f=json) -> GeoJSON,
// so the real shape -- not just the nearest computed point -- can be persisted
// into waterbodies.geometry via upsert_catalog_waterbody. Every ring becomes
// its own polygon in a MultiPolygon rather than assuming later rings are holes
// in the first (esri disambiguates that by winding order, which this app's
// simple DNR lake/stream layers don't reliably need) -- that can never wrongly
// subtract real water area the way a misread hole would.
function esriToGeoJSON(g:any):any{
 if(!g)return null;
 if(Array.isArray(g.rings)&&g.rings.length)return{type:"MultiPolygon",coordinates:g.rings.map((r:any)=>[r])};
 if(Array.isArray(g.paths)&&g.paths.length)return{type:"MultiLineString",coordinates:g.paths};
 if(g.x!=null&&g.y!=null)return{type:"Point",coordinates:[g.x,g.y]};
 return null;
}

// Shared by the cache short-circuit and the final acceptance gate below.
// A geometry-backed on_water/very_close row (real shoreline math, done in
// Postgres by nearby_water_catalog once geometry has been persisted for that
// row) is trustworthy at any distance the RPC itself already computed. A row
// with no geometry backing -- a bare centroid, or a live match whose feature
// had no usable geometry -- still needs to be genuinely close, same as
// before. This replaces two flat distance-only cutoffs (0.05mi to
// short-circuit on cache, 0.4mi to accept anything at all) that made any live
// DNR hiccup silently look like "no water here," because a real lake's
// centroid is almost never within either distance of its own shoreline.
function trustworthy(row:any):boolean{
 const mt=String(row?.match_type||"");
 if(mt==="on_water"||mt==="very_close")return true;
 const d=Number(row?.distance_miles);
 return Number.isFinite(d)&&d<=.4;
}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"POST required"},405);
 try{
  const auth=req.headers.get("authorization")||"";
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const user=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:u}=await user.auth.getUser();
  if(!u.user)return reply({error:"Unauthorized"},401);
  const admin=createClient(url,service);
  const b=await req.json();
  const lat=Number(b.lat),lon=Number(b.lon);
  const radius=Math.min(Math.max(Number(b.radius_miles||5),1),20);
  const refresh=b.refresh===true;
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return reply({error:"Valid lat/lon required"},400);

  const cached=await admin.rpc("nearby_water_catalog",{p_lat:lat,p_lon:lon,p_radius_miles:radius,p_limit:40});
  const cachedRows=dedupe(Array.isArray(cached.data)?cached.data:[]);
  const cachedBest=cachedRows[0];
  if(!refresh&&cachedBest&&trustworthy(cachedBest)){
   return reply({center:{lat,lon},radius_miles:radius,waters:cachedRows.slice(0,6),source:"atlas_index",accuracy:cachedBest.has_geometry?"cached real shoreline/stream geometry":"cached centroid estimate, within tolerance",refresh_available:true});
  }

  const target:Pt=[lon,lat];
  const dLat=radius/69,dLon=radius/(69*Math.max(.25,Math.cos(lat*Math.PI/180)));
  const envelope=`${lon-dLon},${lat-dLat},${lon+dLon},${lat+dLat}`;
  const failures:any[]=[];
  const found=new Map<string,any>();
  // Query all 4 DNR sources unconditionally. This used to guess the state
  // from longitude alone (lon<-92.6 => MN only, lon>-91.0 => WI only) to skip
  // a couple of fetches -- but the real MN/WI border follows the St.
  // Croix/Mississippi rivers, not a straight longitude line, so that
  // heuristic could silently skip the correct state's source entirely near
  // the border. Promise.all already parallelizes this; the accuracy loss
  // wasn't worth the couple of fetches it was saving.
  await Promise.all(sources.map(async s=>{
   const q=new URL(s.url);
   for(const[k,v]of Object.entries({f:"json",where:`${s.name} IS NOT NULL ${(s as any).extraWhere||""}`.trim(),outFields:`${s.id},${s.name}`,geometry:envelope,geometryType:"esriGeometryEnvelope",inSR:"4326",spatialRel:"esriSpatialRelIntersects",returnGeometry:"true",outSR:"4326",resultRecordCount:"60"}))q.searchParams.set(k,v);
   try{
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),5000);
    const r=await fetch(q,{signal:ctl.signal,headers:{"user-agent":"FishWizz/1.0"}});
    clearTimeout(timer);
    if(!r.ok){failures.push({source:s.key,status:r.status});return}
    const p=await r.json();
    for(const f of p.features||[]){
     const name=String(f.attributes?.[s.name]||"").trim();
     if(!name)continue;
     const sid=String(f.attributes?.[s.id]||`${name}:${s.type}`),near=nearest(f.geometry,target);
     if(near.distance>radius)continue;
     found.set(`${s.key}:${sid}`,{id:null,source_id:sid,name,state_code:s.state,water_type:s.type,source_system:s.key,source_label:s.label,latitude:near.point[1],longitude:near.point[0],distance_miles:near.distance,match_type:near.distance<=.03?"on_water":near.distance<=.25?"very_close":"nearby",geometry:esriToGeoJSON(f.geometry)});
    }
   }catch(e){failures.push({source:s.key,error:e instanceof DOMException&&e.name==="AbortError"?"source timeout":String(e)})}
  }));

  let rows=dedupe([...found.values()]);
  const usedCacheFallback=!rows.length&&cachedRows.length>0;
  if(usedCacheFallback)rows=cachedRows;

  const best=rows[0];
  if(!best||!trustworthy(best)){
   return reply({center:{lat,lon},radius_miles:radius,waters:[],failures,source:found.size?"official_live":"atlas_index_fallback",accuracy:"no confident water at tapped coordinate",low_confidence:true,nearest_distance_miles:best?Number(best.distance_miles):null,refresh_available:true});
  }

  // Persist the real geometry for whatever was just matched live, so the
  // *next* lookup anywhere near this spot resolves straight from Postgres --
  // accurately, via nearby_water_catalog -- instead of re-hitting DNR's live
  // API. This is the map-tap path; until now only the by-name search
  // (atlas-water-catalog) ever wrote into the catalog at all, so a spot
  // reached only by tapping the map (the map page's primary flow) could
  // never be cached, geometry or not. Best-effort: a persistence failure
  // here must not turn an already-successful match into an error response.
  if(!usedCacheFallback){
   await Promise.all(rows.slice(0,6).map(async(w:any)=>{
    if(!w.geometry)return;
    try{
     await admin.rpc("upsert_catalog_waterbody",{p_source_system:w.source_system,p_source_id:w.source_id,p_source_label:w.source_label,p_name:w.name,p_state_code:w.state_code,p_water_type:w.water_type,p_lon:w.longitude,p_lat:w.latitude,p_official_url:null,p_source_updated_at:null,p_geometry_geojson:JSON.stringify(w.geometry)});
    }catch(e){reportError(e,{function:"atlas-nearby-waters",stage:"persist_geometry"})}
   }));
  }

  return reply({center:{lat,lon},radius_miles:radius,waters:rows.slice(0,6).map(({geometry,...w}:any)=>w),failures,source:found.size?"official_live":"atlas_index_fallback",accuracy:found.size?"nearest official shoreline or river segment":"cached indexed geometry",refresh_available:true});
 }catch(e){reportError(e,{function:"atlas-nearby-waters"});return reply({error:e instanceof Error?e.message:String(e)},500)}
});
