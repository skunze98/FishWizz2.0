import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const text=(v:unknown)=>String(v??"").trim();

function fallback(question:string,context:any){
 const q=question.toLowerCase();const mission=context?.mission?.recommendation||{};const primary=mission?.primary||{};const water=context?.water?.name||context?.position?.water_name||context?.mission?.context?.water||"this water";const target=context?.mission?.context?.target||"your target fish";const lure=primary?.lure||primary?.presentation||"your primary presentation";const color=primary?.color?` in ${primary.color}`:"";const start=mission?.start_zone||"the best visible cover or structure near your selected position";const how=primary?.how||"make controlled casts and change one variable at a time";const switchWhen=primary?.switch_when||mission?.adjustment_plan||"after 15–20 deliberate minutes without contact, change angle or depth before changing lures";
 if(/bite|strike|hook set|hookset|feel/.test(q))return `With ${lure}${color}, watch for a sudden stop, extra weight, a tick, or a change in vibration. Keep tension, confirm pressure, then set the hook. If it is a bottom-contact bait, also watch for the line moving sideways.`;
 if(/where|cast|spot|location/.test(q))return `Start at ${start}. On ${water}, make fan casts that cover the closest high-percentage edge first, then work progressively deeper or farther out. Repeat any cast that produces a bite or follow.`;
 if(/retrieve|reel|work this|how do i fish/.test(q))return `${how}. Keep the first several casts consistent so you can tell whether a speed, angle, or depth change actually improves the result.`;
 if(/switch|change|nothing|no bite|no contact|move/.test(q))return `${switchWhen}. Do not change lure, location, depth, and retrieve all at once—change one thing, give it a short test window, then decide.`;
 if(/color|colour/.test(q))return `Stay with ${primary?.color||"the Mission color"} first because Atlas selected it from the current clarity/light context. If visibility is poor, increase contrast; if the water is clearer or fish are pressured, move toward a more natural/translucent look.`;
 if(/gear|rod|reel|combo|line/.test(q)){const owned=context?.gear?.combos?.[0]?.name;return owned?`Your current context includes ${owned}. Use the closest owned setup that can comfortably cast and control ${lure}. Prioritize line/rod strength for cover and lure weight rather than chasing an exact brand match.`:`Use the owned combo that best matches ${lure}: enough power for the cover, a lure rating that fits the bait, and line that gives you reliable hook-setting and control.`}
 return `For ${target} on ${water}, start with ${lure}${color} at ${start}. ${how}. ${switchWhen}. Ask me about retrieve, bite detection, color, gear, where to cast, or what to change if you are not getting contact.`;
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
 }catch(e){return json({error:e instanceof Error?e.message:"Ask Atlas failed."},500)}
});