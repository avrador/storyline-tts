// api/tts.js — Vercel Serverless Function (CommonJS)
module.exports = async function handler(req, res) {
  // ---- CORS / preflight ----
  res.setHeader('Access-Control-Allow-Origin', '*'); // TODO: restrict in prod
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

    const body = await readJson(req).catch(() => null);
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const key    = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    if (!key || !region) return res.status(500).json({ error: 'Server missing Azure env vars' });

    // ----- Build SSML -----
    let ssml;
    if (body.ssml && String(body.ssml).trim()) {
      // Client provided full SSML (use as-is)
      ssml = String(body.ssml);
    } else {
      // Fall back: build SSML from simple fields
      const text  = String(body.text  || '').trim();
      const voice = String(body.voiceId || 'en-US-AriaNeural').trim();
      const rate  = String(body.rate  || '0%').trim();  // '+8%' or '-10%'
      const pitch = String(body.pitch || '0%').trim();

      if (!text) return res.status(400).json({ error: 'Missing text' });

      ssml =
        `<speak version="1.0" xml:lang="en-US" xmlns="http://www.w3.org/2001/10/synthesis">` +
          `<voice name="${escapeAttr(voice)}">` +
            `<prosody rate="${escapeAttr(rate)}" pitch="${escapeAttr(pitch)}">` +
              `${escapeXml(text)}` +
            `</prosody>` +
          `</voice>` +
        `</speak>`;
    }

    // ----- Send to Azure -----
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
    return res.status(500).json({ error: 'Unexpected server error', detail: String(e && e.message || e) });
  }
};

// ----- helpers -----
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function escapeXml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeAttr(s = '') {
  return escapeXml(s);
}
