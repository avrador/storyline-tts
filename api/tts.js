// api/tts.js — Vercel Serverless Function
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

    const { text, voiceId = 'en-US-AriaNeural', rate = '0%', pitch = '0%' } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'Missing text' });

    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    if (!key || !region) return res.status(500).json({ error: 'Server missing Azure env vars' });

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
        'User-Agent': 'sto
