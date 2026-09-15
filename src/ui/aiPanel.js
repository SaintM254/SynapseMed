import { on, emit, store } from '../state.js';
import * as gemini from '../lib/gemini.js';
import * as extract from '../lib/extract.js';
import { pathOf } from '../lib/types.js';
import { icons } from './icons.js';
import { mdLite } from './markdown.js';

// Chat panel for per-document Q&A + one-click summaries, plus the
// cross-notes "ask across all my notes" mode. Grounded: answers come only
// from extracted note text, and extraction is cached per file.
export function createAiPanel({ onClose }) {
  const el = document.createElement('div');
  el.className = 'ai-panel';
  el.innerHTML = `
    <div class="ai-head">
      <span class="ai-ico">${icons.sparkle}</span>
      <div class="ai-head-main">
        <div class="ai-title">Study assistant</div>
        <div class="ai-doc">Open a file to ask about it</div>
      </div>
      <button class="icon-btn" type="button" data-close aria-label="Close assistant">${icons.close}</button>
    </div>
    <div class="ai-log" aria-live="polite"></div>
    <div class="ai-chips"></div>
    <form class="ai-form">
      <input class="text-input" type="text" placeholder="Ask a question…" autocomplete="off" spellcheck="false" aria-label="Ask a question"/>
      <button class="btn primary sq" type="submit" aria-label="Send">${icons.send}</button>
    </form>`;

  const logEl = el.querySelector('.ai-log');
  const titleEl = el.querySelector('.ai-title');
  const docEl = el.querySelector('.ai-doc');
  const chipsEl = el.querySelector('.ai-chips');
  const form = el.querySelector('.ai-form');
  const input = form.querySelector('input');

  let busy = false;
  let mode = 'doc';

  el.querySelector('[data-close]').addEventListener('click', () => onClose?.());

  const scrollBottom = () => {
    logEl.scrollTop = logEl.scrollHeight;
  };

  function addMsg(cls, content) {
    const div = document.createElement('div');
    div.className = `msg ${cls}`;
    div.textContent = content;
    logEl.appendChild(div);
    scrollBottom();
    return div;
  }

  function setChips(chips) {
    chipsEl.innerHTML = '';
    for (const [label, q] of chips) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = label;
      b.addEventListener('click', () => runDoc(q, { isSummary: q === '__summary__' }));
      chipsEl.appendChild(b);
    }
  }

  function reset(file) {
    if (busy) return; // don't wipe a conversation mid-answer
    mode = 'doc';
    logEl.innerHTML = '';
    titleEl.textContent = 'Study assistant';
    docEl.textContent = file ? file.name : 'Open a file to ask about it';
    docEl.title = file?.name || '';
    input.placeholder = file ? 'Ask about this file…' : 'Open a file first…';
    setChips(
      file
        ? [
            ['Summarize this file', '__summary__'],
            ['Key points', 'What are the key points in this document?'],
            ['Explain simply', 'Explain the main ideas of this document in plain language.']
          ]
        : []
    );
    if (file) {
      addMsg(
        'status-line',
        gemini.hasKey() ? 'Ask anything about the text, or let me summarize it.' : 'Add your Gemini key in Settings to enable answers.'
      );
    }
  }

  async function runDoc(q, { isSummary = false } = {}) {
    const file = store.currentFile;
    if (!file || busy) return;
    if (!gemini.hasKey()) {
      addMsg('status-line', 'Add your Gemini API key in Settings to use AI.');
      return;
    }
    busy = true;
    addMsg('user', isSummary ? 'Summarize this file' : q);
    const typing = addMsg('assistant typing', '…');
    try {
      const text = await extract.getText(file, { onStatus: (s) => (typing.textContent = s) });
      typing.textContent = 'Writing…';
      let answer;
      if (isSummary) {
        answer = await extract.getSummary(file);
        if (!answer) {
          answer = await gemini.summarizeDocument(file.name, text);
          await extract.setSummary(file, answer);
        }
      } else {
        answer = await gemini.askDocument(file.name, text, q);
      }
      typing.classList.remove('typing');
      typing.innerHTML = mdLite(answer);
    } catch (err) {
      typing.classList.remove('typing');
      typing.classList.add('is-error');
      typing.textContent = err.message || 'Something went wrong.';
    } finally {
      busy = false;
      scrollBottom();
    }
  }

  // Cross-notes retrieval: score files by name/path keywords, extract the
  // top matches on demand (cached afterwards), add cached-text matches.
  async function collectChunks(q, onStatus) {
    const tree = store.tree;
    if (!tree) return [];
    const terms = q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    if (!terms.length) return [];

    const scoreFor = (hay) => {
      const n = hay.toLowerCase();
      return terms.reduce((s, t) => s + (n.includes(t) ? 1 : 0), 0);
    };

    const named = Object.values(tree.files)
      .map((f) => ({ file: f, path: pathOf(tree, f.parentId), score: scoreFor(`${pathOf(tree, f.parentId)} ${f.name}`) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    let cached = [];
    try {
      const texts = await extract.cachedTexts();
      cached = texts
        .map((t) => {
          const f = tree.files[t.fileId];
          return f ? { file: f, text: t.text, score: scoreFor(`${f.name} ${t.text.slice(0, 4000)}`) } : null;
        })
        .filter(Boolean)
        .filter((x) => x.score > 0 && !named.some((n) => n.file.id === x.file.id))
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);
    } catch {}

    const chunks = [];
    for (const item of named) {
      try {
        onStatus(`Preparing “${item.file.name}”…`);
        const text = await extract.getText(item.file, { onStatus });
        chunks.push({ name: item.file.name, path: item.path, file: item.file, text: text.slice(0, 12000) });
      } catch {
        // unreadable formats are skipped quietly
      }
    }
    for (const item of cached) {
      chunks.push({
        name: item.file.name,
        path: pathOf(tree, item.file.parentId),
        file: item.file,
        text: item.text.slice(0, 12000)
      });
    }

    let total = 0;
    const capped = [];
    for (const c of chunks) {
      if (total + c.text.length > 40000) break;
      capped.push(c);
      total += c.text.length;
    }
    return capped;
  }

  async function runAcross(q) {
    if (busy || !q) return;
    mode = 'all';
    logEl.innerHTML = '';
    titleEl.textContent = 'Asking across your notes';
    docEl.textContent = 'closest matching files';
    setChips([]);
    if (!gemini.hasKey()) {
      addMsg('status-line', 'Add your Gemini API key in Settings, then try again.');
      return;
    }
    busy = true;
    addMsg('user', q);
    const typing = addMsg('assistant typing', 'Finding the right notes…');
    try {
      const chunks = await collectChunks(q, (s) => (typing.textContent = s));
      if (!chunks.length) {
        throw new Error('Nothing matched closely enough yet. Open a few files first so their text is cached, or try different keywords.');
      }
      typing.textContent = 'Reading excerpts…';
      const answer = await gemini.askAcrossNotes(q, chunks);
      typing.classList.remove('typing');
      typing.innerHTML = mdLite(answer);

      const srcWrap = document.createElement('div');
      srcWrap.className = 'ai-sources';
      srcWrap.innerHTML = '<span class="ai-sources-label">Sources</span>';
      for (const c of chunks) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.textContent = c.name;
        b.title = c.path ? `${c.path} / ${c.name}` : c.name;
        b.addEventListener('click', () => {
          store.currentFolderId = c.file.parentId;
          emit('folder', c.file.parentId);
          emit('file', c.file);
        });
        srcWrap.appendChild(b);
      }
      logEl.appendChild(srcWrap);
    } catch (err) {
      typing.classList.remove('typing');
      typing.classList.add('is-error');
      typing.textContent = err.message || 'Something went wrong.';
    } finally {
      busy = false;
      scrollBottom();
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q || busy) return;
    input.value = '';
    if (mode === 'all') mode = 'doc'; // next question is about the open file again
    runDoc(q);
  });

  on('file', reset);

  return {
    el,
    askAcross: (q) => runAcross(q),
    focusInput: () => input.focus({ preventScroll: true })
  };
}
