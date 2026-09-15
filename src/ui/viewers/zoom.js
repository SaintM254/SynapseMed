// Shared scroll-zoom (ctrl/cmd + wheel) and two-finger pinch handling.
// Of course we let normal touch scrolling pass through untouched.
export function attachGestures(target, getZoom, setZoom) {
  target.style.touchAction = 'pan-x pan-y';

  const onWheel = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom(getZoom() * (e.deltaY < 0 ? 1.12 : 0.89));
  };

  const pts = new Map();
  let startDist = 0;
  let startZoom = 1;
  let tick = false;

  const dist = () => {
    const [a, b] = [...pts.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onDown = (e) => {
    if (e.pointerType !== 'touch') return;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      startDist = dist();
      startZoom = getZoom();
    }
  };

  const onMove = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size !== 2 || !startDist) return;
    e.preventDefault();
    if (tick) return;
    tick = true;
    requestAnimationFrame(() => {
      tick = false;
      const d = dist();
      if (d > 0) setZoom(startZoom * (d / startDist));
    });
  };

  const onUp = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) startDist = 0;
  };

  target.addEventListener('wheel', onWheel, { passive: false });
  target.addEventListener('pointerdown', onDown);
  target.addEventListener('pointermove', onMove);
  target.addEventListener('pointerup', onUp);
  target.addEventListener('pointercancel', onUp);

  return () => {
    target.removeEventListener('wheel', onWheel);
    target.removeEventListener('pointerdown', onDown);
    target.removeEventListener('pointermove', onMove);
    target.removeEventListener('pointerup', onUp);
    target.removeEventListener('pointercancel', onUp);
  };
}
