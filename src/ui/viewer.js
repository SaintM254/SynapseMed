import { on } from '../state.js';
import { typeOfFile, TYPE_LABEL } from '../lib/types.js';
import { icons, typeIcon } from './icons.js';
import { escapeHtml, reducedMotion } from '../lib/utils.js';
import { recallData, downloadFile } from '../lib/drive.js';

// One shared viewer panel: swaps the renderer based on file type and keeps
// perceived speed high — skeleton first, content streams in, cross-fade on switch.
const RENDERERS = {
  pdf: () => import('./viewers/pdf.js'),
  docx: () => import('./viewers/docx.js'),
  pptx: () => import('./viewers/embed.js'),
  gslides: () => import('./viewers/embed.js'),
  gdoc: () => import('./viewers/embed.js'),
  image: () => import('./viewers/image.js'),
  other: () => import('./viewers/other.js')
};

export function createViewer(rootEl, { onAiToggle, onMessage }) {
  rootEl.innerHTML = `
    <div class="viewer-toolbar">
      <span class="vt-ico" id="vt-ico" hidden></span>
      <div class="vt-title-wrap"><span class="vt-title" id="vt-title">Nothing open yet</span></div>
      <span class="vt-counter" id="vt-counter" hidden></span>
      <span class="vt-spacer"></span>
      <button class="icon-btn" id="vt-zoom-out" type="button" title="Zoom out" hidden>${icons.zoomOut}</button>
      <button class="icon-btn" id="vt-zoom-in" type="button" title="Zoom in" hidden>${icons.zoomIn}</button>
      <button class="icon-btn" id="vt-download" type="button" title="Download original" hidden>${icons.download}</button>
      <a class="icon-btn" id="vt-open" title="Open in Drive" target="_blank" rel="noopener" hidden>${icons.external}</a>
      <button class="btn primary sm" id="vt-ai" type="button" hidden>${icons.sparkle}<span class="hide-sm">Ask AI</span></button>
    </div>
    <div class="viewer-body">
      <div class="viewer-stage" id="viewer-stage"></div>
      <div class="viewer-skel" id="viewer-skel" hidden>
        <div class="skel skel-head"></div>
        <div class="skel skel-block"></div>
        <div class="skel skel-line w70"></div>
        <div class="skel skel-line w50"></div>
      </div>
      <div class="viewer-empty" id="viewer-empty">
        <div class="ve-mark">${icons.logo}</div>
        <p class="ve-title">Pick something to read.</p>
        <p class="ve-sub">Files stream straight from your Drive — nothing is copied or uploaded anywhere else.</p>
      </div>
      <div class="viewer-error" id="viewer-error" hidden></div>
    </div>`;

  const stage = rootEl.querySelector('#viewer-stage');
  const skelEl = rootEl.querySelector('#viewer-skel');
  const emptyEl = rootEl.querySelector('#viewer-empty');
  const errEl = rootEl.querySelector('#viewer-error');
  const icoEl = rootEl.querySelector('#vt-ico');
  const titleEl = rootEl.querySelector('#vt-title');
  const counterEl = rootEl.querySelector('#vt-counter');
  const zoomInBtn = rootEl.querySelector('#vt-zoom-in');
  const zoomOutBtn = rootEl.querySelector('#vt-zoom-out');
  const dlBtn = rootEl.querySelector('#vt-download');
  const openA = rootEl.querySelector('#vt-open');
  const aiBtn = rootEl.querySelector('#vt-ai');

  let current = null;
  let destroyFn = null;
  let zoomCtl = null;
  let openSeq = 0;

  const hooks = {
    ready() {
      skelEl.hidden = true;
    },
    setCounter(cur, total) {
      if (cur == null || total == null) {
        counterEl.hidden = true;
        return;
      }
      counterEl.hidden = false;
      counterEl.textContent = `${cur} / ${total}`;
    },
    enableZoom(ctl) {
      zoomCtl = ctl || null;
      zoomInBtn.hidden = zoomOutBtn.hidden = !ctl;
    }
  };

  function cleanup() {
    try {
      destroyFn?.();
    } catch {}
    destroyFn = null;
  }

  async function openFile(file) {
    if (current?.id === file.id) return;
    current = file;
    const seq = ++openSeq;
    const type = typeOfFile(file);

    // toolbar
    icoEl.innerHTML = typeIcon(type);
    icoEl.className = `vt-ico t-${type}`;
    icoEl.hidden = false;
    titleEl.textContent = file.name;
    titleEl.title = `${file.name} — ${TYPE_LABEL[type]}`;
    openA.href = file.webViewLink;
    openA.hidden = false;
    dlBtn.hidden = false;
    aiBtn.hidden = false;
    emptyEl.hidden = true;
    errEl.hidden = true;
    hooks.setCounter(null);
    hooks.enableZoom(null);

    // cross-fade: fade old content out, swap, fade in
    stage.classList.add('is-fading');
    if (!reducedMotion()) await new Promise((r) => setTimeout(r, 150));
    if (seq !== openSeq) return; // superseded by a newer open
    cleanup();
    stage.classList.remove('is-fading');
    skelEl.hidden = false;

    try {
      const mod = await RENDERERS[type]();
      if (seq !== openSeq) return;
      destroyFn = await mod.render(stage, file, hooks);
    } catch (err) {
      if (seq !== openSeq) return;
      console.error('viewer error', err);
      skelEl.hidden = true;
      showError(err, file);
    }
  }

  function showError(err, file) {
    errEl.innerHTML = `
      <div class="errbox">
        <div class="err-title">Couldn’t open this file</div>
        <p>${escapeHtml(err?.message || 'Something went wrong.')}</p>
        <a class="btn ghost" href="${file.webViewLink}" target="_blank" rel="noopener">${icons.external} Open in Drive</a>
      </div>`;
    errEl.hidden = false;
  }

  on('file', (f) => {
    if (f) openFile(f);
  });

  zoomInBtn.addEventListener('click', () => zoomCtl?.zoomIn());
  zoomOutBtn.addEventListener('click', () => zoomCtl?.zoomOut());

  aiBtn.addEventListener('click', () => onAiToggle?.());

  dlBtn.addEventListener('click', async () => {
    if (!current) return;
    dlBtn.classList.add('busy');
    try {
      const buf = recallData(current.id) || (await downloadFile(current.id));
      const blob = new Blob([buf], { type: current.mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = current.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      onMessage?.(e.message || 'Download failed.');
    } finally {
      dlBtn.classList.remove('busy');
    }
  });
}
