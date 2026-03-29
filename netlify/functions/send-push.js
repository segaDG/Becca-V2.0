/* BECCA — Netlify Function: Kirim Push Notification via FCM */
// Env var yang dibutuhkan: FCM_SERVER_KEY (set di Netlify → Site Settings → Env Vars)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
  }

  const FCM_KEY = process.env.FCM_SERVER_KEY;
  if (!FCM_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'FCM_SERVER_KEY not configured' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { tokens, title, body, data = {} } = payload;
  if (!tokens?.length || !title) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'tokens dan title wajib diisi' }) };
  }

  try {
    // Kirim batch (FCM max 500 token per request)
    const BATCH = 500;
    const results = [];
    for (let i = 0; i < tokens.length; i += BATCH) {
      const batch = tokens.slice(i, i + BATCH);
      const res = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${FCM_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          registration_ids: batch,
          notification: {
            title,
            body:  body || '',
            icon:  '/img/logo-bps.png',
            badge: '/img/logo-bps.png',
            click_action: '/',
          },
          data,
          android:  { priority: 'high' },
          webpush:  { headers: { Urgency: 'high' } },
        }),
      });
      const result = await res.json();
      results.push(result);
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, results }),
    };
  } catch(e) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
