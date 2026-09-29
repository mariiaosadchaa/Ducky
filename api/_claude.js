'use strict';
// Виклик Anthropic Messages API і безпечний розбір JSON із відповіді.
// Провайдер: Google Gemini (безкоштовний ліміт) або Anthropic. Обирається за змінними середовища.
// content: рядок або [{type:'image',source:{media_type,data}}, {type:'text',text}]
const GEMINI_MODEL = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const CLAUDE_MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

async function viaGemini({ system, content, maxTokens }) {
  const parts = (Array.isArray(content) ? content : [{ type: 'text', text: content }]).map((c) =>
    c.type === 'image' ? { inline_data: { mime_type: c.source.media_type, data: c.source.data } } : { text: c.text });
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(GEMINI_MODEL()) + ':generateContent';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { maxOutputTokens: maxTokens, responseMimeType: 'application/json', temperature: 0.4 },
    }),
  });
  if (r.status === 429) { const e = new Error('Ліміт безкоштовного ШІ на зараз вичерпано. Спробуйте за хвилину.'); e.status = 429; throw e; }
  if (!r.ok) { const e = new Error('ШІ тимчасово недоступний.'); e.status = 502; throw e; }
  const j = await r.json();
  const cand = j.candidates && j.candidates[0];
  return ((cand && cand.content && cand.content.parts) || []).map((p) => p.text || '').join('');
}

async function viaClaude({ system, content, maxTokens }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: CLAUDE_MODEL(), max_tokens: maxTokens, system, messages: [{ role: 'user',
      content: Array.isArray(content) ? content.map((c) => (c.type === 'image' && c.source.media_type === 'application/pdf' ? { type: 'document', source: { type: 'base64', ...c.source } } : c)) : content }] }),
  });
  if (!r.ok) { const e = new Error('ШІ тимчасово недоступний.'); e.status = 502; throw e; }
  const j = await r.json();
  return (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function askClaude({ system, content, maxTokens = 2000 }) {
  if (process.env.GEMINI_API_KEY) return viaGemini({ system, content, maxTokens });
  if (process.env.ANTHROPIC_API_KEY) return viaClaude({ system, content, maxTokens });
  const e = new Error('ШІ не налаштований (немає GEMINI_API_KEY).'); e.status = 503; throw e;
}

function parseJSON(text) {
  const t = String(text || '');
  const a = t.indexOf('{'); const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}

const str = (v, n = 120) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
const num = (v) => { const x = Number(String(v).replace(',', '.')); return isFinite(x) && x >= 0 ? Math.round(x * 100) / 100 : null; };
const isoDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}
module.exports = { askClaude, parseJSON, str, num, isoDate, send };
