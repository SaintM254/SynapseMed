import { downloadFile, recallData, rememberData } from '../../lib/drive.js';
import { createProgress } from './loading.js';

// DOCX -> clean semantic HTML via mammoth.js. Lighter and faster than
// emulating Word, and better for reading.
export async function render(container, file, hooks) {
  // Pre-bundled browser build — the package's main entry pulls in node builtins.
  const mod = await import('mammoth/mammoth.browser.js');
  const mammoth = mod.default || mod;

  const progress = createProgress(container, `Downloading “${file.name}”`);
  let buf = recallData(file.id);
  if (!buf) {
    buf = await downloadFile(file.id, (got, total) => progress.update(got, total));
    rememberData(file.id, buf);
  }

  const { value: html, messages } = await mammoth.convertToHtml({ arrayBuffer: buf });
  progress.done();
  if (messages?.length) console.debug('[mammoth]', messages);

  const scroller = document.createElement('div');
  scroller.className = 'docx-scroll';
  const page = document.createElement('article');
  page.className = 'docx-page';
  page.innerHTML = html; // mammoth output is sanitised semantic HTML
  scroller.appendChild(page);
  container.appendChild(scroller);

  hooks.setCounter(null);
  hooks.ready();
  return () => {};
}
