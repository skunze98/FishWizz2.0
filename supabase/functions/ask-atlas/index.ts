import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { reportError } from "../_shared/sentry.ts";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const text=(v:unknown)=>String(v??"").trim();

// The rules-based mode (no OPENAI_API_KEY/ATLAS_AI_MODEL, or the OpenAI call
// failed). Every request already ships live weather, water type, and the
// angler's own last five catches with their own why_worked/try_next notes
// (see public/ask-atlas.js's context() builder) -- this used to read only
// mission.recommendation.primary and gear.combos[0] and threw the rest away.
// Reading the fields that are already on the wire is what makes this
// meaningfully smarter without adding a model call: real per-question
// reasoning over today's conditions and the angler's own field notes,
// instead of one canned paragraph per keyword bucket regardless of context.
function fallback(question:string,context:any){
 const q=question.toLowerCase();
 const mission=context?.mission?.recommendation||{};
 const primary=mission?.primary||{};
 const water=context?.water?.name||context?.position?.water_name||context?.mission?.context?.water||"this water";
 const target=context?.mission?.context?.target||context?.angler_profile?.preferred_species?.[0]||"your target fish";
 const lure=primary?.lure||primary?.presentation||"your primary presentation";
 const color=primary?.color?` in ${primary.color}`:"";
 // P3-16 ("no duplicated sentence starts", the tracker's own quoted example
 // "Start at Start on"): mission.start_zone, when a real Mission exists, is
 // already a complete instruction sentence beginning with "Start" itself
 // (get_mission_plan_v3 in supabase/schema/public.sql: "Start on a current
 // break...", "Start with shade...", etc) -- only the no-Mission fallback
 // below is a bare noun phrase that actually needs the "Start at " lead-in.
 const startZone=mission?.start_zone;
 const start=startZone||"the best visible cover or structure near your selected position";
 const startLine=startZone?startZone:`Start at ${start}`;
 const how=primary?.how||"make controlled casts and change one variable at a time";
 const switchWhen=primary?.switch_when||mission?.adjustment_plan||"after 15–20 deliberate minutes without contact, change angle or depth before changing lures";

 // Live conditions Atlas already fetched for this Mission (atlas-weather's
 // computed bands, not raw numbers) -- empty strings when weather was never
 // loaded, so every line below degrades to silence rather than a guess.
 const fw=context?.weather?.fishing||{};
 const pressure=String(fw.pressure_trend||"").toLowerCase();
 const light=String(fw.light_band||"").toLowerCase();
 const wind=String(fw.wind_band||"").toLowerCase();
 const gusty=!!fw.gusty;
 const tempBand=String(fw.temperature_band||"").toLowerCase();
 const waterType=String(context?.water?.water_type||context?.mission?.context?.water_type||"").toLowerCase();
 const moving=/river|stream/.test(waterType);
 const structure=moving?"current seams, eddies, current breaks, outside bends, pools below riffles, and bridge pilings -- anywhere fast water meets slow water":"points, weed edges, docks, inlets, the wind-blown bank, and depth changes";

 const pressureLine=pressure==="falling"?"Pressure is falling, which often means a short, real feeding window before a front -- fish tend to chase harder right now.":pressure==="rising"?"Pressure is rising, which tends to push fish tight to cover and make them feed more cautiously -- slow down and fish the thickest visible structure.":pressure==="steady"?"Pressure has been steady, so this should be a normal, predictable bite rather than a weather-driven one.":"";
 const lightLine=light==="low"?"Low light favors moving baits fished with confidence -- fish will chase farther and are less line-shy right now.":light==="bright"?"Bright conditions push fish tight to shade and cover and make them line-shy -- downsize and slow down.":"";
 const windLine=gusty?"Gusts are strong enough to move bait unnaturally -- go up in weight and keep casts short and controlled.":wind==="high"?"Wind is strong enough to stack baitfish and oxygenate the water -- the wind-blown bank is worth hitting first.":"";

 // The angler's own field notes for this exact water or this species -- real
 // personalization, no model required. Prefers a note that matches both.
 const notes:any[]=Array.isArray(context?.recent_learning)?context.recent_learning:[];
 const norm=(s:any)=>String(s||"").toLowerCase();
 const waterNorm=norm(water),targetNorm=norm(target);
 const personal=notes.map(n=>({n,score:(waterNorm&&norm(n.water).includes(waterNorm)?2:0)+(targetNorm&&norm(n.species).includes(targetNorm)?1:0)})).filter(x=>x.score>0&&(x.n.try_next||x.n.why_worked||x.n.learned)).sort((a,b)=>b.score-a.score)[0]?.n;
 const personalLine=personal?` You noted last time${personal.water?` on ${personal.water}`:""}: "${personal.try_next||personal.why_worked||personal.learned}" -- worth trying again before changing anything else.`:"";

 if(/weather|conditions|front|barometric|is (it|today) good/.test(q))return [pressureLine,lightLine,windLine].filter(Boolean).join(" ")||"Atlas doesn't have live conditions loaded for this spot yet -- load weather on the Mission page and ask again for a conditions-based read.";
 if(/bite|strike|hook set|hookset|feel/.test(q))return `With ${lure}${color}, watch for a sudden stop, extra weight, a tick, or a change in vibration. Keep tension, confirm pressure, then set the hook. If it is a bottom-contact bait, also watch for the line moving sideways.${light==="low"?" Low light means fish commit harder -- a positive take should be easy to feel.":light==="bright"?" Bright conditions often mean a softer, more hesitant take -- watch your line as much as you feel for it.":""}`;
 if(/where|cast|spot|location/.test(q))return `${startLine}. On ${water}, prioritize ${structure}. Make fan casts that cover the closest high-percentage edge first, then work progressively farther out.${windLine?` ${windLine}`:""}${personalLine}`;
 if(/how deep|depth/.test(q))return `${moving?"In moving water, work the depth where current speed breaks -- right where fast water slows, not the deepest slot in the pool.":"Start shallower along the structure edge and work progressively deeper until you find fish, rather than guessing a depth up front."}${tempBand==="cold"?" Cold water usually means fish are holding deeper and tighter to structure.":tempBand==="hot"?" Warm water often pushes fish shallow early/late and deeper through midday.":""}`;
 if(/morning|evening|night|best time|what time|time of day|when should/.test(q))return `${light==="low"?"Current light is already working in your favor -- low-light windows like this are when fish feed most confidently.":"Bright, high-light stretches favor early morning, late evening, or another low-light window -- fish sit tighter to cover and feed more cautiously through the middle of a bright day."}${tempBand==="hot"?" In warm water, first and last light matter even more than usual.":""}`;
 if(/retrieve|reel|work this|how do i fish/.test(q))return `${how}.${tempBand==="cold"?" Slow down further than feels natural -- cold water fish rarely chase a fast bait.":tempBand==="hot"||tempBand==="warm"?" Warmer water can support a faster, more reaction-triggering retrieve, especially early or late in the day.":""} Keep the first several casts consistent so you can tell whether a speed, angle, or depth change actually improves the result.`;
 if(/switch|change|nothing|no bite|no contact|move/.test(q))return `${switchWhen}.${pressureLine?` ${pressureLine}`:""} Do not change lure, location, depth, and retrieve all at once -- change one thing, give it a short test window, then decide.${personalLine}`;
 if(/color|colour/.test(q))return `Stay with ${primary?.color||"the Mission color"} first because Atlas selected it from the current clarity/light context.${light==="low"?" Low light favors more contrast -- darker or brighter solid colors read better than natural/translucent ones.":light==="bright"?" Bright, clear conditions favor a more natural, translucent look -- high contrast can spook fish.":" If visibility is poor, increase contrast; if the water is clearer or fish are pressured, move toward a natural/translucent look."}`;
 if(/gear|rod|reel|combo|line/.test(q)){const owned=context?.gear?.combos?.[0]?.name;return owned?`Your current context includes ${owned}. Use the closest owned setup that can comfortably cast and control ${lure}.${gusty||wind==="high"?" Wind today favors erring toward the heavier end of what you own.":""} Prioritize line/rod strength for cover and lure weight rather than chasing an exact brand match.`:`Use the owned combo that best matches ${lure}: enough power for the cover, a lure rating that fits the bait, and line that gives you reliable hook-setting and control.`}
 return `For ${target} on ${water}, start with ${lure}${color} at ${start}. ${how}. ${switchWhen}.${personalLine} Ask me about retrieve, depth, timing, conditions, bite detection, color, gear, where to cast, or what to change if you are not getting contact.`;
}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  // Require a signed-in user, matching atlas-weather and the five other
  // functions. verify_jwt alone is not enough: Supabase accepts the publishable
  // key as a valid anon credential, and that key is public by design -- it ships
  // in the JS bundle. Without this check anyone who reads it out of
  // fishwizz.com can invoke this function, which proxies to api.openai.com on
  // OPENAI_API_KEY. That is a direct billing and abuse vector.
  const authHeader=req.headers.get("authorization")??"";
  const supaUrl=Deno.env.get("SUPABASE_URL")!,anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
  const {createClient}=await import("jsr:@supabase/supabase-js@2");
  const authed=createClient(supaUrl,anonKey,{global:{headers:{Authorization:authHeader}}});
  const {data:authData}=await authed.auth.getUser();
  if(!authData?.user)return json({error:"Unauthorized"},401);

  const body=await req.json();const question=text(body?.question).slice(0,1200);const context=body?.context||{};
  if(question.length<2)return json({error:"Ask a fishing question first."},400);
  const key=Deno.env.get("OPENAI_API_KEY");const model=Deno.env.get("ATLAS_AI_MODEL");
  if(key&&model){
   const system=`You are Ask Atlas, a concise expert fishing assistant inside Atlas Angler. Answer only fishing-related questions. Use the supplied context when relevant: exact spot, water, current Mission, weather, owned gear, and recent catch learning. Never invent current conditions or owned equipment. Clearly label uncertainty. Prefer direct on-the-water instructions: where to cast, what to throw, how to retrieve, what a bite feels like, and when to switch. Keep most answers under 180 words.`;
   const payload={model,input:[{role:"system",content:[{type:"input_text",text:system}]},{role:"user",content:[{type:"input_text",text:`Question: ${question}\n\nAtlas context:\n${JSON.stringify(context).slice(0,14000)}`}]}],max_output_tokens:350};
   const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(payload)});
   if(r.ok){const d=await r.json();const answer=text(d?.output_text)||text(d?.output?.flatMap((x:any)=>x?.content||[]).find((x:any)=>x?.type==="output_text")?.text);if(answer)return json({answer,mode:"ai",model});}
  }
  return json({answer:fallback(question,context),mode:"contextual",model:null});
 }catch(e){reportError(e,{function:"ask-atlas"});return json({error:e instanceof Error?e.message:"Ask Atlas failed."},500)}
});