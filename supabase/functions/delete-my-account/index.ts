import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({error:"Method not allowed"}), {status:405,headers:cors});
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return new Response(JSON.stringify({error:"Unauthorized"}), {status:401,headers:cors});
    const admin = createClient(url, service, { auth: { persistSession:false } });
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return new Response(JSON.stringify({error:"Unauthorized"}), {status:401,headers:cors});
    const userId = userData.user.id;
    const tables = ["catches","coaching_scenarios","combos","fishing_sessions","inventory_photo_intake","lakes","lures","maintenance_records","personal_fishing_locations","reels","rods","trips"];
    for (const table of tables) {
      const { error } = await admin.from(table).delete().eq("owner_id", userId);
      if (error) console.error(`delete ${table}`, error.message);
    }
    await admin.from("profiles").delete().eq("id", userId);
    for (const bucket of ["catch-photos","gear-photos","inventory-photos"]) {
      const { data: files } = await admin.storage.from(bucket).list(userId, { limit:1000 });
      if (files?.length) await admin.storage.from(bucket).remove(files.map(f => `${userId}/${f.name}`));
    }
    const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
    if (deleteErr) throw deleteErr;
    return new Response(JSON.stringify({ok:true}), {headers:cors});
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({error:"Could not delete account"}), {status:500,headers:cors});
  }
});