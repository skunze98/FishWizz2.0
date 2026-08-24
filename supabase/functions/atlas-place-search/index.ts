import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"authorization, x-client-info, apikey, content-type","access-control-allow-methods":"POST, OPTIONS","content-type":"application/json"};
const reply=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:cors});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return reply({error:"POST required"},405);
 try{
  // Require a signed-in user, matching the other functions. verify_jwt accepts
  // the publishable key, which is public and ships in the JS bundle, so without
  // this anyone can drive this endpoint. It proxies to Nominatim, whose usage
  // policy is per-application -- unbounded anonymous traffic through it risks
  // getting FishWizz blocked there.
  const authHeader=req.headers.get("authorization")??"";
  const supaUrl=Deno.env.get("SUPABASE_URL")!,anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
  const {createClient}=await import("jsr:@supabase/supabase-js@2");
  const authed=createClient(supaUrl,anonKey,{global:{headers:{Authorization:authHeader}}});
  const {data:authData}=await authed.auth.getUser();
  if(!authData?.user) return reply({error:"Unauthorized"},401);

  const body=await req.json();
  const q=String(body.q||"").trim();
  if(q.length<2) return reply({results:[]});
  const viewbox="-97.5,49.5,-86.0,42.3";
  const url=new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q",q);
  url.searchParams.set("format","jsonv2");
  url.searchParams.set("addressdetails","1");
  url.searchParams.set("limit","8");
  url.searchParams.set("countrycodes","us");
  url.searchParams.set("viewbox",viewbox);
  url.searchParams.set("bounded","0");
  const r=await fetch(url,{headers:{"user-agent":"AtlasFishingOS/0.11 contact=skylerhunze98@gmail.com","accept-language":"en-US,en;q=0.9"}});
  if(!r.ok) return reply({error:`Place search failed (${r.status})`},502);
  const rows=await r.json();
  const results=(rows||[]).filter((x:any)=>{
    const state=String(x.address?.state||"");
    return state==="Minnesota"||state==="Wisconsin"||String(x.display_name||"").includes("Minnesota")||String(x.display_name||"").includes("Wisconsin");
  }).map((x:any)=>({
    name:x.name||String(x.display_name||"").split(",")[0],
    display_name:x.display_name,
    latitude:Number(x.lat),longitude:Number(x.lon),
    category:x.category||x.class||null,type:x.type||null,
    state:x.address?.state||null,county:x.address?.county||null,city:x.address?.city||x.address?.town||x.address?.village||null,
    boundingbox:x.boundingbox||null
  }));
  return reply({results});
 }catch(e){return reply({error:e instanceof Error?e.message:String(e)},500)}
});