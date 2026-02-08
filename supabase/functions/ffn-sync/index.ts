import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseHtmlBests } from "../_shared/ffn-parser.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const { athlete_id, athlete_name, iuf } = await req.json();
    if (!athlete_id || !iuf) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const res = await fetch(`https://ffn.extranat.fr/webffn/nat_recherche.php?idact=nat&idrch_id=${iuf}&idiuf=${iuf}`, { headers: { "User-Agent": "suivi-natation/1.0" } });
    if (!res.ok) return new Response(JSON.stringify({ error: "FFN error" }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });

    const records = parseHtmlBests(await res.text());
    console.log("[ffn] pools:", records.reduce((a, r) => { a[r.pool_length] = (a[r.pool_length] || 0) + 1; return a; }, {} as Record<number, number>));

    let ins = 0, upd = 0, skip = 0;

    for (const r of records) {
      const { data: ex } = await supabase.from("swim_records").select("id, time_seconds").eq("athlete_id", athlete_id).eq("event_name", r.event_name).eq("pool_length", r.pool_length).maybeSingle();
      const notes = [athlete_name ? `Nageur: ${athlete_name}` : null, r.ffn_points ? `${r.ffn_points} pts FFN` : null].filter(Boolean).join(" | ") || null;

      if (ex) {
        if (r.time_seconds < (ex.time_seconds ?? Infinity)) {
          await supabase.from("swim_records").update({ time_seconds: r.time_seconds, record_date: r.record_date, record_type: "comp", notes }).eq("id", ex.id);
          upd++;
        } else skip++;
      } else {
        await supabase.from("swim_records").insert({ athlete_id, event_name: r.event_name, pool_length: r.pool_length, time_seconds: r.time_seconds, record_date: r.record_date, record_type: "comp", notes });
        ins++;
      }
    }

    return new Response(JSON.stringify({ status: "ok", inserted: ins, updated: upd, skipped: skip }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
