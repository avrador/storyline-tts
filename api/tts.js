// api/tts.js — Vercel Serverless Function (CommonJS, with manual JSON body parsing)
module.exports = async function handler(req, res) {
  // ---- CORS / preflight ----
  res.setHeader('Access-Control-Allow-Origin', '*'); // TODO: restrict to your LMS domain in prod
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

    const body = await readJson(req).catch(() => null);
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const {
      text,
      voiceId = 'en-US-AriaNeural',
      rate = '0%',
      pitch = '0%'
    } = body;

    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'Missing text' });
    }

    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    if (!key || !region) {
      return res.status(500).json({ error: 'Server missing Azure env vars' });
    }

    const ssml = `
      <speak version="1.0" xml:lang="en-US">
        <voice name="${voiceId}">
          <prosody rate="${rate}" pitch="${pitch}">${escapeXml(text)}</prosody>
        </voice>
      </speak>`.trim();

    const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'storyline-tts'
      },
      body: ssml
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      return res.status(r.status).json({ error: 'Azure TTS error', detail });
    }

    const base64 = Buffer.from(await r.arrayBuffer()).toString('base64');
    return res.status(200).json({ audioBase64: base64 });
  } catch (e) {
    console.error('Server error:', e);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function escapeXml(s = '') {
  return s.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
}
