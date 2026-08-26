import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { reportError } from "../_shared/sentry.ts";

// Real public access data (item 1 of the mentor-experience request): boat
// launches, canoe/kayak carry-ins, and shore fishing sites, sourced live
// from each state's own DNR GIS service -- the same "query live, cache into
// public_access_points" pattern atlas-nearby-waters already uses for
// waterbody shapes, applied to a table that previously had a schema and a
// reader (atlas_map_context, atlas-water-profile) but NO writer anywhere in
// this codebase. It was always going to read back empty.
//
// Sources verified live before writing this (real fields, real sample rows):
//   MN: enterprise.gisdata.mn.gov/.../struc_water_access_sites -- launch_type
//       distinguishes "Trailer Launch" (boat) from "Carry-In" (canoe/kayak/
//       hand-launch); also carries ADA parking counts and administrator.
//   WI: dnrmaps.wi.gov/.../PR_Boat_Access_Shore_Fishing_WTM_Ext -- layer 1 is
//       a dedicated "Shore Fishing Site" layer, layer 2 is boat landings with
//       its own RAMP_TYPE_CODE/LANDING_TYPE_CODE and ADA field.
// Neither state publishes a single "access type" vocabulary, so normalize()
// below maps both into the same three buckets the UI actually needs.

const cors={"access-control-allow-origin":"*","access-control-allow-headers":"authorization, x-client-info, apikey, content-type","access-control-allow-methods":"POST, OPTIONS","content-type":"application/json"};
const reply=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:cors});

type Row={source_system:string;source_id:string;name:string;access_type:string;administrator:string|null;ada_accessible:boolean|null;lat:number;lon:number;source_url:string|null};

function normalizeMnType(t:string):string{
 const s=(t||"").toLowerCase();
 if(s.includes("carry"))return"Canoe / kayak / carry-in";
 if(s.includes("trailer")||s.includes("ramp"))return"Boat launch";
 return t||"Public access";
}
function normalizeWiRamp(landing:string,ramp:string):string{
 const s=`${landing||""} ${ramp||""}`.toLowerCase();
 if(s.includes("carry")||s.includes("hand"))return"Canoe / kayak / carry-in";
 if(s.includes("ramp")||s.includes("trailer")||s.includes("boat"))return"Boat launch";
 return"Boat launch";
}

async function fetchJson(url:URL,timeoutMs=6000):Promise<any>{
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);
 try{
  const r=await fetch(url,{signal:ctl.signal,headers:{"user-agent":"FishWizz/1.0"}});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  return await r.json();
 }finally{clearTimeout(timer)}
}

function envelopeFor(lat:number,lon:number,radiusMiles:number){
 const dLat=radiusMiles/69,dLon=radiusMiles/(69*Math.max(.25,Math.cos(lat*Math.PI/180)));
 return `${lon-dLon},${lat-dLat},${lon+dLon},${lat+dLat}`;
}

async function fetchMn(lat:number,lon:number,radiusMiles:number,failures:any[]):Promise<Row[]>{
 const url=new URL("https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/struc_water_access_sites/FeatureServer/0/query");
 for(const[k,v]of Object.entries({f:"json",where:"1=1",outFields:"unique_swas_id,access_name,launch_type,administrator,lake_name,accessible_parking_spaces",geometry:envelopeFor(lat,lon,radiusMiles),geometryType:"esriGeometryEnvelope",inSR:"4326",spatialRel:"esriSpatialRelIntersects",outSR:"4326",returnGeometry:"true",resultRecordCount:"80"}))url.searchParams.set(k,v);
 try{
  const p=await fetchJson(url);
  return (p.features||[]).map((f:any)=>{
   const a=f.attributes||{},g=f.geometry||{};
   if(!Number.isFinite(g.x)||!Number.isFinite(g.y))return null;
   return{source_system:"mn_dnr_water_access",source_id:String(a.unique_swas_id||a.access_name||`${g.x},${g.y}`),name:String(a.access_name||a.lake_name||"Public water access"),access_type:normalizeMnType(String(a.launch_type||"")),administrator:a.administrator||null,ada_accessible:Number(a.accessible_parking_spaces||0)>0,lat:g.y,lon:g.x,source_url:"https://www.dnr.state.mn.us/water_access/index.html"};
  }).filter(Boolean) as Row[];
 }catch(e){failures.push({source:"mn_dnr_water_access",error:e instanceof DOMException&&e.name==="AbortError"?"source timeout":String(e)});return[]}
}

async function fetchWi(lat:number,lon:number,radiusMiles:number,failures:any[]):Promise<Row[]>{
 const base="https://dnrmaps.wi.gov/arcgis2/rest/services/PR_Recreation/PR_Boat_Access_Shore_Fishing_WTM_Ext/MapServer";
 const envelope=envelopeFor(lat,lon,radiusMiles);
 const [boat,shore]=await Promise.all([
  (async()=>{
   const url=new URL(`${base}/2/query`);
   for(const[k,v]of Object.entries({f:"json",where:"1=1",outFields:"BOATLANDING_SEQ_NO,LMS_BOAT_LANDING_NAME,LANDING_TYPE_CODE,RAMP_TYPE_CODE,ADA_ACCESSIBLE_FEATURE_CODE,OWNERSHIP_NAME_TEXT,WATERBODY_NAME_TEXT",geometry:envelope,geometryType:"esriGeometryEnvelope",inSR:"4326",spatialRel:"esriSpatialRelIntersects",outSR:"4326",returnGeometry:"true",resultRecordCount:"80"}))url.searchParams.set(k,v);
   try{
    const p=await fetchJson(url);
    return (p.features||[]).map((f:any)=>{
     const a=f.attributes||{},g=f.geometry||{};
     if(!Number.isFinite(g.x)||!Number.isFinite(g.y))return null;
     return{source_system:"wi_dnr_boat_access",source_id:String(a.BOATLANDING_SEQ_NO||a.LMS_BOAT_LANDING_NAME||`${g.x},${g.y}`),name:String(a.LMS_BOAT_LANDING_NAME||a.WATERBODY_NAME_TEXT||"Public boat access"),access_type:normalizeWiRamp(String(a.LANDING_TYPE_CODE||""),String(a.RAMP_TYPE_CODE||"")),administrator:a.OWNERSHIP_NAME_TEXT||null,ada_accessible:/y|yes|true/i.test(String(a.ADA_ACCESSIBLE_FEATURE_CODE||"")),lat:g.y,lon:g.x,source_url:"https://dnr.wisconsin.gov/topic/lands/boataccess"} as Row;
    }).filter(Boolean) as Row[];
   }catch(e){failures.push({source:"wi_dnr_boat_access",error:e instanceof DOMException&&e.name==="AbortError"?"source timeout":String(e)});return[]}
  })(),
  (async()=>{
   const url=new URL(`${base}/1/query`);
   for(const[k,v]of Object.entries({f:"json",where:"1=1",outFields:"SHOREFISH_SEQ_NO,FACILITY_NAME_TEXT,WATERBODY_NAME_TEXT,MORE_INFO_URL",geometry:envelope,geometryType:"esriGeometryEnvelope",inSR:"4326",spatialRel:"esriSpatialRelIntersects",outSR:"4326",returnGeometry:"true",resultRecordCount:"80"}))url.searchParams.set(k,v);
   try{
    const p=await fetchJson(url);
    return (p.features||[]).map((f:any)=>{
     const a=f.attributes||{},g=f.geometry||{};
     if(!Number.isFinite(g.x)||!Number.isFinite(g.y))return null;
     return{source_system:"wi_dnr_shore_fishing",source_id:String(a.SHOREFISH_SEQ_NO||a.FACILITY_NAME_TEXT||`${g.x},${g.y}`),name:String(a.FACILITY_NAME_TEXT||a.WATERBODY_NAME_TEXT||"Shore fishing site"),access_type:"Shore fishing",administrator:null,ada_accessible:null,lat:g.y,lon:g.x,source_url:a.MORE_INFO_URL||"https://dnr.wisconsin.gov/topic/lands/boataccess"} as Row;
    }).filter(Boolean) as Row[];
   }catch(e){failures.push({source:"wi_dnr_shore_fishing",error:e instanceof DOMException&&e.name==="AbortError"?"source timeout":String(e)});return[]}
  })()
 ]);
 return[...boat,...shore];
}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"POST required"},405);
 try{
  const auth=req.headers.get("authorization")||"";
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:u}=await userClient.auth.getUser();
  if(!u.user)return reply({error:"Unauthorized"},401);
  const admin=createClient(url,service);

  const b=await req.json().catch(()=>({}));
  const waterbodyId=b.waterbody_id?String(b.waterbody_id):null;
  const lat=Number(b.lat),lon=Number(b.lon);
  const stateCode=String(b.state_code||"").toUpperCase();
  const radius=Math.min(Math.max(Number(b.radius_miles||3),1),10);
  const refresh=b.refresh===true;
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return reply({error:"Valid lat/lon required"},400);

  // Cache short-circuit: if this water already has access points on file and
  // the caller isn't forcing a refresh, skip the live DNR round trip.
  if(!refresh&&waterbodyId){
   const cached=await admin.from("public_access_points").select("id,name,access_type,public_status,source_system,source_url,location").eq("waterbody_id",waterbodyId).limit(60);
   if(!cached.error&&cached.data&&cached.data.length){
    return reply({access_points:cached.data.map((r:any)=>({id:r.id,name:r.name,access_type:r.access_type,administrator:r.public_status,source:r.source_system,source_url:r.source_url})),source:"cached",generated_at:new Date().toISOString()});
   }
  }

  const failures:any[]=[];
  const rows=stateCode==="WI"?await fetchWi(lat,lon,radius,failures):stateCode==="MN"?await fetchMn(lat,lon,radius,failures):[...await fetchMn(lat,lon,radius,failures),...await fetchWi(lat,lon,radius,failures)];

  if(!rows.length){
   return reply({access_points:[],source:"official_live",failures,available:false,reason:failures.length?"DNR access-site service did not respond in time.":"No public access site is on record from the state DNR within range of this water.",generated_at:new Date().toISOString()});
  }

  // Persist for next time. Best-effort: a cache-write failure must not turn
  // an already-successful live fetch into an error response.
  if(waterbodyId){
   try{
    await admin.from("public_access_points").upsert(rows.map(r=>({waterbody_id:waterbodyId,source_system:r.source_system,source_id:r.source_id,name:r.name,access_type:r.access_type,location:`SRID=4326;POINT(${r.lon} ${r.lat})`,public_status:r.administrator,source_url:r.source_url,source_updated_at:new Date().toISOString()})),{onConflict:"source_system,source_id"});
   }catch(e){reportError(e,{function:"atlas-water-access",stage:"persist"})}
  }

  return reply({access_points:rows.map(r=>({name:r.name,access_type:r.access_type,administrator:r.administrator,ada_accessible:r.ada_accessible,latitude:r.lat,longitude:r.lon,source:r.source_system,source_url:r.source_url})),source:"official_live",failures,generated_at:new Date().toISOString()});
 }catch(e){reportError(e,{function:"atlas-water-access"});return reply({error:e instanceof Error?e.message:String(e)},500)}
});
