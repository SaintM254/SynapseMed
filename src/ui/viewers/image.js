import { fetchBlobUrl } from '../../lib/drive.js';
import { attachGestures } from './zoom.js';
import { clamp } from '../../lib/utils.js';

// Images: fast thumbnail preview first, full bytes only on zoom/click.
export async function render(container, file, hooks) {
  const scroller = document.createElement('div');
  scroller.className = 'img-scroll';
  const img = document.createElement('img');
  img.className = 'img-main';
  img.alt = file.name;
  img.draggable = false;
  scroller.appendChild(img);
  container.appendChild(scroller);

  let destroyed = false;
  let zoom = 1;
  let baseW = 0;
  let fullLoaded = false;

  const previewUrl = await fetchBlobUrl(file.id, { thumbnail: true, width: 1600 });
  if (destroyed) {
    URL.revokeObjectURL(previewUrl);
    return () => {};
  }
  img.src = previewUrl;
  hooks.setCounter(null);
  hooks.ready();

  await img.decode().catch(() => {});
  if (destroyed) return () => {};

  const fitBase = () => {
    const cw = Math.max(200, scroller.clientWidth - 32);
    baseW = Math.min(img.naturalWidth || cw, cw);
    apply();
  };
  const apply = () => {
    img.style.width = `${Math.round(baseW * zoom)}px`;
  };
  fitBase();

  async function ensureFull() {
    if (fullLoaded || destroyed) return;
    fullLoaded = true;
    try {
      const url = await fetchBlobUrl(file.id);
      if (destroyed) {
        URL.revokeObjectURL(url);
        return;
      }
      img.src = url;
    } catch (err) {
      console.warn('full image load failed, keeping thumbnail', err);
    }
  }

  const setZoom = (z) => {
    zoom = clamp(z, 0.5, 4);
    apply();
    if (zoom > 1.2) ensureFull();
  };

  const gestureCleanup = attachGestures(scroller, () => zoom, setZoom);
  const onClick = () => setZoom(zoom > 1 ? 1 : 2);
  img.addEventListener('click', onClick);

  const resizeObs = new ResizeObserver(() => {
    if (zoom === 1) fitBase();
  });
  resizeObs.observe(scroller);

  hooks.enableZoom({
    zoomIn: () => setZoom(zoom * 1.25),
    zoomOut: () => setZoom(zoom / 1.25)
  });

  return () => {
    destroyed = true;
    gestureCleanup();
    resizeObs.disconnect();
    img.removeEventListener('click', onClick);
  };
}
