// Supabase Edge Function: Overdue Task Checker
// Runs periodically (e.g. cron schedule) to detect overdue tasks and insert notification records

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const nowIso = new Date().toISOString();

    // 1. Fetch eligible tasks that are overdue
    const { data: overdueTasks, error: taskError } = await supabase
      .from("tasks")
      .select("id, org_id, title, due_date, assignee_id")
      .lt("due_date", nowIso)
      .not("status", "in", '("done","cancelled")')
      .is("archived_at", null)
      .not("assignee_id", "is", null);

    if (taskError) throw taskError;

    let notificationsCreated = 0;

    for (const task of overdueTasks || []) {
      const dedupeKey = `overdue:${task.id}:${task.due_date}`;

      const { error: notifError } = await supabase.from("notifications").insert({
        org_id: task.org_id,
        recipient_id: task.assignee_id,
        type: "task_overdue",
        task_id: task.id,
        payload_json: {
          task_title: task.title,
          due_date: task.due_date,
        },
        dedupe_key: dedupeKey,
      });

      if (!notifError) {
        notificationsCreated++;
      }
    }

    return new Response(
      JSON.stringify({
        status: "success",
        overdueCount: overdueTasks?.length ?? 0,
        notificationsCreated,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
