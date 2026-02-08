import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseHtmlFull, formatTimeDisplay } from "../_shared/ffn-parser.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const { swimmer_iuf, user_id } = await req.json();
    if (!swimmer_iuf) return new Response(JSON.stringify({ error: "Missing swimmer_iuf" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const res = await fetch(`https://ffn.extranat.fr/webffn/nat_recherche.php?idact=nat&idrch_id=${swimmer_iuf}&idiuf=${swimmer_iuf}`, { headers: { "User-Agent": "suivi-natation/1.0" } });
    if (!res.ok) return new Response(JSON.stringify({ error: "FFN error" }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });

    const performances = parseHtmlFull(await res.text());
    const totalFound = performances.length;

    const rows = performances.map(p => ({
      user_id: user_id ?? null,
      swimmer_iuf,
      event_code: p.event_name,
      pool_length: p.pool_length,
      time_seconds: p.time_seconds,
      time_display: formatTimeDisplay(p.time_seconds),
      competition_name: p.competition_name,
      competition_date: p.record_date,
      competition_location: p.competition_location,
      ffn_points: p.ffn_points,
      source: "ffn",
    }));

    let newImported = 0;
    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const { data, error } = await supabase
          .from("swimmer_performances")
          .upsert(chunk, { onConflict: "swimmer_iuf,event_code,pool_length,competition_date,time_seconds", ignoreDuplicates: true })
          .select("id");
        if (error) console.error("[ffn-performances] upsert error:", error.message);
        else newImported += (data?.length ?? 0);
      }
    }

    return new Response(JSON.stringify({ status: "ok", total_found: totalFound, new_imported: newImported, already_existed: totalFound - newImported }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
