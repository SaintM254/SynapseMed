import { icons } from '../icons.js';
import { escapeHtml } from '../../lib/utils.js';

// Fallback for anything we deliberately don't render: honest message,
// escape hatch to Drive.
export async function render(container, file, hooks) {
  hooks.setCounter(null);
  hooks.ready();
  const wrap = document.createElement('div');
  wrap.className = 'other-wrap';
  wrap.innerHTML = `
    <div class="other-icon">${icons.file}</div>
    <p class="other-title">SynapseMed can’t preview this file type.</p>
    <p class="other-sub">${escapeHtml(file.mimeType || 'Unknown format')}</p>
    <a class="btn primary" href="${file.webViewLink}" target="_blank" rel="noopener">${icons.external} Open in Drive</a>`;
  container.appendChild(wrap);
  return () => {};
}
