// Gemini (Generative Language API). The key lives only in this browser's
// localStorage and is sent only to Google's API — there is no backend.
const KEY_LS = 'synapsemed.geminiKey';
const MODEL = 'gemini-2.5-flash';

export function getKey() {
  try {
    return localStorage.getItem(KEY_LS) || '';
  } catch {
    return '';
  }
}
export function setKey(k) {
  try {
    localStorage.setItem(KEY_LS, String(k).trim());
  } catch {}
}
export function clearKey() {
  try {
    localStorage.removeItem(KEY_LS);
  } catch {}
}
export function hasKey() {
  return Boolean(getKey());
}

export class GeminiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

function friendly(status, detail) {
  if (status === 400 && (/API key not valid/i.test(detail) || /API_KEY_INVALID/i.test(detail)))
    return 'That Gemini API key is not valid. Check it in Settings.';
  if (status === 403) return 'Gemini refused the request. Check that the Generative Language API is enabled for this key.';
  if (status === 404) return 'The Gemini model was not found for this key. The app may need an update.';
  if (status === 429) return 'Gemini rate limit reached. Wait a moment and try again.';
  if (status >= 500) return 'Gemini is having trouble right now. Try again in a moment.';
  return `Gemini request failed (${status}). Please try again.`;
}

// Keep answers grounded: the whole point is rereading *their* notes.
const GROUNDED_SYSTEM = [
  'You are SynapseMed, a calm study assistant inside a private nursing notes library.',
  'Answer ONLY from the document text provided by the user.',
  'If the answer is not covered in the provided text, say plainly that it is not covered.',
  'Do not guess, do not use outside knowledge, and do not invent citations.',
  'Use plain language, short paragraphs, and small headings when helpful.',
  'The reader is a nursing graduate rereading for competence, not cramming — favour clarity over exhaustive detail.'
].join(' ');

async function generate(userText, { temperature = 0.3, maxTokens = 1024, system = GROUNDED_SYSTEM } = {}) {
  const key = getKey();
  if (!key) throw new GeminiError('No Gemini API key is saved yet. Add one in Settings to use AI features.', 0);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens }
      })
    });
  } catch {
    throw new GeminiError('Could not reach Gemini. Check your connection and try again.', 0);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new GeminiError(friendly(res.status, detail), res.status);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) throw new GeminiError('Gemini returned an empty answer. Try rephrasing the question.', res.status);
  return text.trim();
}

function clip(text, max = 100000) {
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[...document truncated for length...]`;
}

export async function summarizeDocument(name, text) {
  return generate(
    `Summarize this study document in plain language.\n\nStructure the reply as:\n- A one-paragraph overview\n- Key ideas as short bullet points\n- Anything worth keeping in mind while reading\n\nKeep it under 250 words.\n\nFile name: "${name}"\n\n---\n\n${clip(text)}`,
    { maxTokens: 1200 }
  );
}

export async function askDocument(name, text, question) {
  return generate(
    `Document: "${name}"\n\n---\n\n${clip(text)}\n\n---\n\nQuestion: ${question}`,
    { maxTokens: 1024 }
  );
}

export async function askAcrossNotes(question, chunks) {
  const excerpts = chunks.map((c, i) => `Excerpt ${i + 1} — from "${c.name}":\n${c.text}`).join('\n\n');
  return generate(
    `You are answering a question using excerpts from the reader's private notes.\nAnswer only from the excerpts below, and mention which file(s) the answer comes from.\nIf the excerpts do not cover the question, say so plainly.\n\n${excerpts}\n\nQuestion: ${question}`,
    { maxTokens: 1200 }
  );
}
