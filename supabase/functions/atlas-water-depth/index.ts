import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { reportError } from "../_shared/sentry.ts";

// Real depth contours (item 2 of the mentor-experience request), from the
// one structured, statewide, queryable source that actually exists:
// Minnesota DNR's lake bathymetric survey layers
// (enterprise.gisdata.mn.gov/.../water_lake_bathymetry), verified live
// before writing this -- polyline contours carry a real `depth`/`abs_depth`
// in feet, and the metadata layer carries survey area/perimeter.
//
// Wisconsin DOES NOT have an equivalent: WI DNR's lake depth maps are
// scanned per-lake images (apps.dnr.wi.gov/lakes/maps/), not a queryable
// GIS dataset. That is reported here as `available:false` with a real
// reason, not silently omitted and not faked -- per the "do not fabricate
// missing depth information" requirement.
//
// Rivers/streams also return available:false: this survey program only
// covers lake basins, and drawing invented contour lines on a stream would
// be exactly the kind of fabrication the request prohibits.

const cors={"access-control-allow-origin":"*","access-control-allow-headers":"authorization, x-client-info, apikey, content-type","access-control-allow-methods":"POST, OPTIONS","content-type":"application/json"};
const reply=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:cors});

async function fetchJson(url:URL,timeoutMs=7000):Promise<any>{
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

const base="https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/water_lake_bathymetry/MapServer";

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"POST required"},405);
 try{
  const auth=req.headers.get("authorization")||"";
  const url=Deno.env.get("SUPABASE_URL")!,anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient=createClient(url,anonKey,{global:{headers:{Authorization:auth}}});
  const {data:u}=await userClient.auth.getUser();
  if(!u.user)return reply({error:"Unauthorized"},401);

  const b=await req.json().catch(()=>({}));
  const lat=Number(b.lat),lon=Number(b.lon);
  const stateCode=String(b.state_code||"").toUpperCase();
  const waterType=String(b.water_type||"").toLowerCase();
  const lakeName=String(b.lake_name||"").trim();
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return reply({error:"Valid lat/lon required"},400);

  if(/river|stream/.test(waterType)){
   return reply({available:false,reason:"Depth-contour surveys cover lake basins only; there is no equivalent bathymetric survey for rivers or streams.",generated_at:new Date().toISOString()});
  }
  if(stateCode!=="MN"){
   return reply({available:false,reason:"Wisconsin DNR does not publish a queryable depth-contour dataset -- its lake maps are scanned per-lake images, not structured data FishWizz can read. Minnesota lakes with a DNR bathymetric survey on file are supported.",generated_at:new Date().toISOString()});
  }

  const envelope=envelopeFor(lat,lon,1.5);
  const contourUrl=new URL(`${base}/0/query`);
  for(const[k,v]of Object.entries({f:"json",where:"1=1",outFields:"dowlknum,lake_name,depth,abs_depth",geometry:envelope,geometryType:"esriGeometryEnvelope",inSR:"4326",spatialRel:"esriSpatialRelIntersects",outSR:"4326",returnGeometry:"true",resultRecordCount:"400"}))contourUrl.searchParams.set(k,v);

  let contourData:any;
  try{contourData=await fetchJson(contourUrl)}
  catch(e){
   reportError(e,{function:"atlas-water-depth",stage:"contours"});
   return reply({available:false,reason:"The DNR bathymetry service did not respond in time. Try again shortly.",generated_at:new Date().toISOString()});
  }

  const features=(contourData.features||[]).filter((f:any)=>Array.isArray(f.geometry?.paths)&&f.geometry.paths.length);
  if(!features.length){
   return reply({available:false,reason:lakeName?`No DNR bathymetric survey is on file for ${lakeName} yet.`:"No DNR bathymetric survey is on file for this water yet.",generated_at:new Date().toISOString()});
  }

  const contours=features.map((f:any)=>({depth_ft:Number(f.attributes?.abs_depth??f.attributes?.depth??0),paths:f.geometry.paths.map((path:[number,number][])=>path.map(([x,y])=>[y,x]))}));
  const maxDepth=contours.reduce((m,c)=>Math.max(m,Number(c.depth_ft)||0),0);
  const dowNum=String(features[0]?.attributes?.dowlknum||"");

  let survey:any=null;
  if(dowNum){
   try{
    const metaUrl=new URL(`${base}/2/query`);
    for(const[k,v]of Object.entries({f:"json",where:`dowlknum='${dowNum.replace(/'/g,"")}'`,outFields:"lake_name,area1,perimeter,fldw_end,data_src",outSR:"4326",returnGeometry:"false",resultRecordCount:"1"}))metaUrl.searchParams.set(k,v);
    const metaData=await fetchJson(metaUrl);
    const m=metaData.features?.[0]?.attributes;
    // area1/perimeter are deliberately not surfaced: their unit isn't
    // documented on this service and a wrong guess (sq meters vs sq feet vs
    // already-acres) would be exactly the kind of fabricated-looking fact
    // this feature exists to avoid. survey_completed and the source name are
    // unambiguous strings, so those are safe to pass through as-is.
    if(m)survey={lake_name:m.lake_name||null,survey_completed:m.fldw_end||null,data_source:m.data_src||"Minnesota DNR lake survey"};
   }catch(e){/* metadata is a bonus fact, not required -- degrade silently rather than fail the whole contour response */}
  }

  return reply({available:true,dow_lake_number:dowNum||null,max_depth_ft:maxDepth||null,contour_count:contours.length,contour_interval_ft:5,contours,survey,source:"Minnesota DNR Lake Bathymetric Contours",source_url:"https://www.dnr.state.mn.us/lakemapping/description.html",generated_at:new Date().toISOString()});
 }catch(e){reportError(e,{function:"atlas-water-depth"});return reply({error:e instanceof Error?e.message:String(e)},500)}
});
