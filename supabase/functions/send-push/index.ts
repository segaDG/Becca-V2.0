// BECCA — Supabase Edge Function: Send Push via FCM HTTP v1 API
// Secrets yang dibutuhkan (Edge Functions → Secrets):
//   FIREBASE_CLIENT_EMAIL  = client_email dari service account JSON
//   FIREBASE_PRIVATE_KEY   = private_key dari service account JSON

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROJECT_ID = "becca-ae19d";

// ── PEM → DER (untuk import private key RSA) ─────────────
function pemToDer(pem: string): ArrayBuffer {
  // Strip PEM headers (any type), whitespace, AND literal \n \r sequences
  const b64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\\n|\\r/g, "")        // literal backslash-n / backslash-r
    .replace(/[^A-Za-z0-9+/=]/g, ""); // keep only valid base64 chars
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ── Base64url encode ─────────────────────────────────────
function b64url(data: ArrayBuffer | string): string {
  const bytes = typeof data === "string"
    ? new TextEncoder().encode(data)
    : new Uint8Array(data);
  // Gunakan loop (bukan spread) agar tidak stack-overflow untuk key besar
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ── Buat Google OAuth2 access token via Service Account JWT ──
async function getAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss:   clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  }));

  const toSign = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(toSign)
  );
  const jwt = `${toSign}.${b64url(sig)}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const { access_token } = await tokenRes.json();
  return access_token;
}

// ── Kirim 1 pesan FCM V1 ─────────────────────────────────
async function sendOne(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
  accessToken: string
): Promise<{ ok: boolean; token: string }> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data,
          android: { priority: "high" },
          webpush: {
            headers: { Urgency: "high" },
            notification: { icon: "/img/logo-bps.png", badge: "/img/logo-bps.png" },
            fcm_options: { link: "/" },
          },
        },
      }),
    }
  );
  return { ok: res.ok, token };
}

// ── Main handler ─────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const CLIENT_EMAIL  = Deno.env.get("FIREBASE_CLIENT_EMAIL");
  const PRIVATE_KEY   = Deno.env.get("FIREBASE_PRIVATE_KEY");
  if (!CLIENT_EMAIL || !PRIVATE_KEY) {
    return new Response(
      JSON.stringify({ error: "FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY belum diset" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  let body: { tokens: string[]; title: string; body?: string; data?: Record<string, string> };
  try { body = await req.json(); } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  const { tokens, title, body: msgBody = "", data = {} } = body;
  if (!tokens?.length || !title) {
    return new Response(
      JSON.stringify({ error: "tokens dan title wajib" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  try {
    // Private key dari env bisa berisi literal \n — ubah ke newline sesungguhnya
    const privateKey = PRIVATE_KEY.replace(/\\n/g, "\n");
    const accessToken = await getAccessToken(CLIENT_EMAIL, privateKey);

    // Kirim paralel, max 20 sekaligus agar tidak timeout
    const BATCH = 20;
    const results = [];
    for (let i = 0; i < tokens.length; i += BATCH) {
      const batch = tokens.slice(i, i + BATCH);
      const batchResults = await Promise.all(
        batch.map(t => sendOne(t, title, msgBody, data, accessToken))
      );
      results.push(...batchResults);
    }

    const sent   = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    return new Response(
      JSON.stringify({ success: true, sent, failed }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
