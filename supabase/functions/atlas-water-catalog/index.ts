import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors={"access-control-allow-origin":"*","access-control-allow-headers":"authorization, x-client-info, apikey, content-type","access-control-allow-methods":"POST, OPTIONS"};
const jsonHeaders={...cors,"content-type":"application/json"};
const SOURCES={MN:[
 {key:"mn_dnr_basins",label:"Minnesota DNR Public Waters",url:"https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/water_mn_public_waters/FeatureServer/1/query",field:"pw_basin_name",idField:"dnr_hydro_id",type:"lake"},
 {key:"mn_dnr_streams",label:"Minnesota DNR Rivers and Streams",url:"https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_dnr/water_dnr_hydrography/FeatureServer/0/query",field:"kittle_name",idField:"dnr_hydro_id",type:"stream"}
],WI:[
 {key:"wi_dnr_lakes",label:"Wisconsin DNR Hydrography",url:"https://dnrmaps.wi.gov/arcgis/rest/services/ER_Biotics/ER_Biotics_WGS84_Hydro/MapServer/0/query",field:"WATERBODY_NAME",idField:"WATERBODY_WBIC",type:"lake"},
 {key:"wi_dnr_streams",label:"Wisconsin DNR Hydrography",url:"https://dnrmaps.wi.gov/arcgis/rest/services/ER_Biotics/ER_Biotics_WGS84_Hydro/MapServer/1/query",field:"RIVER_SYS_NAME",idField:"RIVER_SYS_WBIC",type:"stream"}
]} as const;
function esc(v:string){return v.replaceAll("'","''");}
function center(g:any):[number|null,number|null]{if(!g)return[null,null];if(g.type==="Point")return[g.coordinates?.[0]??null,g.coordinates?.[1]??null];const pts:number[][]=[];const walk=(v:any)=>{if(Array.isArray(v)&&typeof v[0]==="number"&&typeof v[1]==="number")pts.push(v);else if(Array.isArray(v))v.forEach(walk)};walk(g.coordinates);if(!pts.length)return[null,null];return[pts.reduce((s,p)=>s+p[0],0)/pts.length,pts.reduce((s,p)=>s+p[1],0)/pts.length];}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return new Response(JSON.stringify({error:"POST required"}),{status:405,headers:jsonHeaders});
 const auth=req.headers.get("authorization")??"";
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 const {data:userData}=await userClient.auth.getUser();
 if(!userData.user)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:jsonHeaders});
 const admin=createClient(url,service);const body=await req.json().catch(()=>({}));
 const state=body.state==="WI"?"WI":"MN",query=String(body.query??"").trim(),requested=String(body.water_type??"all").toLowerCase();
 if(query.length<2)return new Response(JSON.stringify({error:"Enter at least 2 characters"}),{status:400,headers:jsonHeaders});
 const sources=SOURCES[state].filter(s=>requested==="all"||requested==="water"||requested===s.type||(requested==="river"&&s.type==="stream")||(requested==="stream"&&s.type==="stream")||(["pond","reservoir","flowage"].includes(requested)&&s.type==="lake"));
 const waters:any[]=[],failures:any[]=[];
 await Promise.all(sources.map(async source=>{const q=new URL(source.url);q.searchParams.set("f","geojson");q.searchParams.set("where",`UPPER(${source.field}) LIKE UPPER('%${esc(query)}%')`);q.searchParams.set("outFields",`${source.idField},${source.field}`);q.searchParams.set("returnGeometry","true");q.searchParams.set("outSR","4326");q.searchParams.set("resultRecordCount","100");try{const res=await fetch(q,{headers:{"user-agent":"AtlasFishingOS/0.8"}});if(!res.ok){failures.push({source:source.key,status:res.status});return;}const payload=await res.json();for(const feature of payload.features??[]){const p=feature.properties??{},name=String(p[source.field]??"").trim();if(!name)continue;const sourceId=String(p[source.idField]??feature.id??`${name}:${source.type}`),[lon,lat]=center(feature.geometry);const {data:id,error}=await admin.rpc("upsert_catalog_waterbody",{p_source_system:source.key,p_source_id:sourceId,p_source_label:source.label,p_name:name,p_state_code:state,p_water_type:source.type,p_lon:lon,p_lat:lat,p_official_url:q.toString(),p_source_updated_at:null});if(!error)waters.push({id,name,state_code:state,water_type:source.type,source_label:source.label,latitude:lat,longitude:lon,official:true});}}catch(e){failures.push({source:source.key,error:String(e)})}}));
 const unique=[...new Map(waters.map(w=>[`${w.id||w.name}|${w.state_code}`,w])).values()].sort((a:any,b:any)=>a.name.localeCompare(b.name));
 return new Response(JSON.stringify({query,state,coverage:"statewide official catalog, searched on demand",cached_count:unique.length,waters:unique,failures}),{headers:jsonHeaders});
});