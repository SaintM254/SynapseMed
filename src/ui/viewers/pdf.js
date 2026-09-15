import { getPdfjs } from '../../lib/pdfjs.js';
import { downloadFile, recallData, rememberData } from '../../lib/drive.js';
import { attachGestures } from './zoom.js';
import { createProgress } from './loading.js';
import { clamp } from '../../lib/utils.js';

// Virtualized PDF renderer: only pages near the viewport get a canvas,
// distant canvases are recycled, and zoom re-renders lazily.
export async function render(container, file, hooks) {
  const pdfjs = await getPdfjs();

  const progress = createProgress(container, `Downloading “${file.name}”`);
  let data = recallData(file.id);
  if (!data) {
    data = await downloadFile(file.id, (got, total) => progress.update(got, total));
    rememberData(file.id, data);
  }
  progress.done();

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const total = pdf.numPages;

  const scroller = document.createElement('div');
  scroller.className = 'pdf-scroll';
  const wrap = document.createElement('div');
  wrap.className = 'pdf-pages';
  scroller.appendChild(wrap);
  container.appendChild(scroller);

  let destroyed = false;
  let readySent = false;
  let currentPage = 1;
  let fitScale = 1;
  let zoom = 1;
  let activeRenders = 0;
  let rerenderTimer = 0;

  const sizes = new Map(); // page -> {w, h} at scale 1
  const entries = new Map(); // page -> {canvas, stale}
  const queue = [];
  const inQueue = new Set();

  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
  const scale = () => fitScale * zoom;

  async function pageSize(n) {
    if (sizes.has(n)) return sizes.get(n);
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const s = { w: vp.width, h: vp.height };
    sizes.set(n, s);
    return s;
  }

  const s1 = await pageSize(1);

  const wrappers = [null];
  for (let i = 1; i <= total; i++) {
    const d = document.createElement('div');
    d.className = 'pdf-page';
    d.dataset.n = String(i);
    wrap.appendChild(d);
    wrappers[i] = d;
  }

  const contentWidth = () => Math.max(200, scroller.clientWidth - 48);
  fitScale = contentWidth() / s1.w;
  layout();

  function layout() {
    const s = scale();
    for (let i = 1; i <= total; i++) {
      const sz = sizes.get(i) || s1;
      wrappers[i].style.width = `${Math.round(sz.w * s)}px`;
      wrappers[i].style.height = `${Math.round(sz.h * s)}px`;
    }
  }

  // ---- page visibility: render near, recycle far ----
  const observer = new IntersectionObserver(
    (obs) => {
      for (const o of obs) {
        if (o.isIntersecting) enqueue(Number(o.target.dataset.n));
      }
      updateCurrentPage();
      evictFar();
    },
    { root: scroller, rootMargin: '85% 0px 85% 0px' }
  );
  for (let i = 1; i <= total; i++) observer.observe(wrappers[i]);

  function enqueue(n, force = false) {
    const e = entries.get(n);
    if (e && !e.stale && !force) return;
    if (inQueue.has(n)) return;
    inQueue.add(n);
    queue.push(n);
    queue.sort((a, b) => Math.abs(a - currentPage) - Math.abs(b - currentPage));
    pump();
  }

  function pump() {
    while (queue.length && activeRenders < 2 && !destroyed) {
      const n = queue.shift();
      inQueue.delete(n);
      activeRenders++;
      renderPage(n)
        .catch((err) => {
          if (!destroyed) console.warn(`page ${n} render failed`, err);
        })
        .finally(() => {
          activeRenders--;
          pump();
        });
    }
  }

  async function renderPage(n) {
    if (destroyed) return;
    const entry = entries.get(n);
    if (entry && !entry.stale) return;

    const page = await pdf.getPage(n);
    if (destroyed) return;

    const vpu = page.getViewport({ scale: 1 });
    const prev = sizes.get(n);
    sizes.set(n, { w: vpu.width, h: vpu.height });
    if (!prev && (Math.abs(vpu.width - s1.w) > 1 || Math.abs(vpu.height - s1.h) > 1)) layout();

    const vp = page.getViewport({ scale: scale() * dpr() });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(vp.width));
    canvas.height = Math.max(1, Math.floor(vp.height));
    const ctx = canvas.getContext('2d', { alpha: false });
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    if (destroyed || !wrappers[n].isConnected) return;

    entries.set(n, { canvas, stale: false });
    wrappers[n].replaceChildren(canvas);

    if (!readySent) {
      readySent = true;
      hooks.ready();
    }
  }

  let scrollTick = false;
  const onScroll = () => {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(() => {
      scrollTick = false;
      if (destroyed) return;
      updateCurrentPage();
      evictFar();
    });
  };
  scroller.addEventListener('scroll', onScroll, { passive: true });

  function updateCurrentPage() {
    const y = scroller.scrollTop + scroller.clientHeight * 0.35;
    let n = 1;
    for (let i = 1; i <= total; i++) {
      if (wrappers[i].offsetTop <= y) n = i;
      else break;
    }
    if (n !== currentPage) {
      currentPage = n;
      hooks.setCounter(n, total);
      queue.sort((a, b) => Math.abs(a - currentPage) - Math.abs(b - currentPage));
    }
  }

  function evictFar() {
    // never hold more than a handful of canvases
    for (const [n, e] of entries) {
      if (Math.abs(n - currentPage) > 4) {
        e.canvas.remove();
        entries.delete(n);
      }
    }
  }

  // ---- zoom ----
  function setZoom(z) {
    const next = clamp(z, 0.5, 4);
    if (Math.abs(next - zoom) < 0.01) return;
    const n = currentPage;
    const w = wrappers[n];
    const ratio = w ? (scroller.scrollTop - w.offsetTop) / Math.max(1, w.offsetHeight) : 0;
    zoom = next;
    layout();
    // stretched until re-rendered at the new scale — instant visual feedback
    for (const e of entries.values()) e.stale = true;
    if (w) scroller.scrollTop = w.offsetTop + ratio * w.offsetHeight;
    clearTimeout(rerenderTimer);
    rerenderTimer = setTimeout(() => {
      if (destroyed) return;
      for (let k = Math.max(1, n - 1); k <= Math.min(total, n + 2); k++) enqueue(k, true);
      evictFar();
    }, 220);
  }

  hooks.enableZoom({
    zoomIn: () => setZoom(zoom * 1.25),
    zoomOut: () => setZoom(zoom / 1.25)
  });
  const gestureCleanup = attachGestures(scroller, () => zoom, setZoom);

  // refit on pane resize
  const resizeObs = new ResizeObserver(() => {
    if (destroyed) return;
    const newFit = contentWidth() / s1.w;
    if (Math.abs(newFit - fitScale) > 0.01) {
      fitScale = newFit;
      layout();
      for (const e of entries.values()) e.stale = true;
      for (let k = Math.max(1, currentPage - 1); k <= Math.min(total, currentPage + 1); k++) enqueue(k, true);
    }
  });
  resizeObs.observe(scroller);

  hooks.setCounter(1, total);
  enqueue(1, true); // first page fast

  return () => {
    destroyed = true;
    clearTimeout(rerenderTimer);
    observer.disconnect();
    resizeObs.disconnect();
    gestureCleanup();
    scroller.removeEventListener('scroll', onScroll);
    try {
      pdf.destroy();
    } catch {}
  };
}
