import { escapeHtml } from '../../lib/utils.js';

// Slim progress line shown while a file downloads.
export function createProgress(container, label = 'Loading…') {
  const el = document.createElement('div');
  el.className = 'load-progress';
  el.innerHTML = `
    <div class="load-progress-bar"><span style="width:0%"></span></div>
    <p class="load-progress-text">${escapeHtml(label)}</p>`;
  container.appendChild(el);
  const bar = el.querySelector('span');
  const txt = el.querySelector('.load-progress-text');

  return {
    update(got, total) {
      if (total) {
        const pct = Math.min(100, Math.round((got / total) * 100));
        bar.style.width = `${pct}%`;
        txt.textContent = `${label} — ${pct}%`;
      } else {
        txt.textContent = `${label} — ${(got / 1048576).toFixed(1)} MB`;
      }
    },
    done() {
      el.remove();
    }
  };
}
