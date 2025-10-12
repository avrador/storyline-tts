// inside api/tts.js
const body = await readJson(req).catch(() => null);
let ssml;

if (body && body.ssml) {
  // client provided full SSML
  ssml = String(body.ssml);
} else {
  // fallback: construct SSML from text
  const text  = String(body.text || '').trim();
  const voice = String(body.voiceId || 'en-US-AriaNeural').trim();
  const rate  = String(body.rate   || '0%');
  const pitch = String(body.pitch  || '0%');
  ssml = `<speak version="1.0" xml:lang="en-US" xmlns="http://www.w3.org/2001/10/synthesis">
            <voice name="${escapeAttr(voice)}">
              <prosody rate="${escapeAttr(rate)}" pitch="${escapeAttr(pitch)}">${escapeXml(text)}</prosody>
            </voice>
          </speak>`;
}

// send to Azure
const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
  method: 'POST',
  headers: {
    'Ocp-Apim-Subscription-Key': key,
    'Content-Type': 'application/ssml+xml',
    'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'
  },
  body: ssml
});

if (!r.ok) {
  const detail = await r.text().catch(() => '');
  return res.status(r.status).json({ error: 'Azure TTS error', detail }); // <-- surfaces reason
}
