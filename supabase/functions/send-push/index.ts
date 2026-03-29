// BECCA — Supabase Edge Function: Send Push Notification via FCM
// Deploy: Supabase Dashboard → Edge Functions → New Function → nama: send-push
// Secret: FCM_SERVER_KEY sudah diset di Edge Functions Secrets

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const FCM_KEY = Deno.env.get("FCM_SERVER_KEY");
  if (!FCM_KEY) {
    return new Response(
      JSON.stringify({ error: "FCM_SERVER_KEY belum dikonfigurasi" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  let payload: { tokens: string[]; title: string; body?: string; data?: Record<string, string> };
  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const { tokens, title, body = "", data = {} } = payload;
  if (!tokens?.length || !title) {
    return new Response(
      JSON.stringify({ error: "tokens dan title wajib diisi" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // Kirim batch (FCM max 500 token per request)
  const BATCH = 500;
  const results = [];
  for (let i = 0; i < tokens.length; i += BATCH) {
    const batch = tokens.slice(i, i + BATCH);
    const res = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Authorization": `key=${FCM_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registration_ids: batch,
        notification: {
          title,
          body,
          icon:  "/img/logo-bps.png",
          badge: "/img/logo-bps.png",
          click_action: "/",
        },
        data,
        android: { priority: "high" },
        webpush: { headers: { Urgency: "high" } },
      }),
    });
    results.push(await res.json());
  }

  return new Response(
    JSON.stringify({ success: true, results }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
