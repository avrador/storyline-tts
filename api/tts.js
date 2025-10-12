// api/tts.js — Vercel Serverless Function (CommonJS)
module.exports = async function handler(req, res) {
  // --- CORS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    const body = await readJson(req).catch(() => ({}));

    const key    = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    if (!key || !region) return res.status(500).json({ error: 'Server missing Azure env vars' });

    // read fields (all optional if ssml is provided)
    const text   = String(body.text || '').trim();
    const voice  = String(body.voiceId || 'en-US-JennyNeural').trim();
    const rate   = String(body.rate   || '0%').trim();   // e.g. +10%
    const pitch  = String(body.pitch  || '0st').trim();  // e.g. +2st
    const style  = String(body.style  || '').trim();     // e.g. 'chat'
    const ssmlIn = String(body.ssml   || '').trim();

    // If caller sent SSML, use it as-is. Otherwise, build SSML.
    let ssml;
    if (ssmlIn) {
      ssml = ssmlIn;
    } else {
      if (!text) return res.status(400).json({ error: 'Missing text' });
      ssml =
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ` +
        `xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">` +
          `<voice name="${escapeAttr(voice)}">` +
            (style ? `<mstts:express-as style="${escapeAttr(style)}">` : ``) +
              `<prosody rate="${escapeAttr(rate)}" pitch="${escapeAttr(pitch)}">` +
                `${escapeXml(text)}` +
              `</prosody>` +
            (style ? `</mstts:express-as>` : ``) +
          `</voice>` +
        `</speak>`;
    }

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
      // Return Azure’s detail so the client can display it
      return res.status(r.status).json({ error: 'Azure TTS error', detail });
    }

    const base64 = Buffer.from(await r.arrayBuffer()).toString('base64');
    return res.status(200).json({ audioBase64: base64 });

  } catch (e) {
    console.error('Server error:', e);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
};

// --- helpers (keep your existing ones) ---
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function escapeXml(s=''){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
function escapeAttr(s=''){ return escapeXml(s); }
