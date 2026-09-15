// Text extraction per file type, cached in IndexedDB keyed by
// Drive file ID + modifiedTime, so reopening a file is free.
import { idbGet, idbSet, idbEntries } from './cache.js';
import * as drive from './drive.js';
import { getPdfjs } from './pdfjs.js';
import { typeOfFile } from './types.js';

const textKey = (file) => `text:${file.id}:${file.modifiedTime || 'v0'}`;
const summaryKey = (file) => `sum:${file.id}:${file.modifiedTime || 'v0'}`;

export async function isTextCached(file) {
  return (await idbGet(textKey(file))) != null;
}

export async function getSummary(file) {
  return idbGet(summaryKey(file));
}
export async function setSummary(file, summary) {
  await idbSet(summaryKey(file), summary);
}

export async function getText(file, { onStatus } = {}) {
  const cached = await idbGet(textKey(file));
  if (cached) return cached;

  const type = typeOfFile(file);
  let text = '';

  if (type === 'pdf') {
    onStatus?.('Reading the PDF text…');
    const buf = drive.recallData(file.id) || (await drive.downloadFile(file.id));
    drive.rememberData(file.id, buf);
    text = await extractPdf(buf);
  } else if (type === 'docx') {
    onStatus?.('Reading the document…');
    const buf = drive.recallData(file.id) || (await drive.downloadFile(file.id));
    drive.rememberData(file.id, buf);
    text = await extractDocx(buf);
  } else if (type === 'gdoc') {
    onStatus?.('Asking Drive for a text version…');
    text = await drive.exportText(file.id).catch(() => '');
  }

  text = (text || '').replace(/[ \t]+\n/g, '\n').trim();
  if (!text) {
    throw new Error(
      'This file has no extractable text (it may be scanned images or a format Drive cannot convert). The built-in viewer still works.'
    );
  }
  await idbSet(textKey(file), text);
  return text;
}

async function extractPdf(arrayBuffer) {
  const pdfjs = await getPdfjs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const parts = [];
  const max = Math.min(pdf.numPages, 300);
  let budget = 200000;
  for (let i = 1; i <= max && budget > 0; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const line = content.items.map((it) => it.str).join(' ');
    if (line.trim()) {
      parts.push(line);
      budget -= line.length;
    }
  }
  try {
    pdf.destroy();
  } catch {}
  return parts.join('\n\n');
}

async function extractDocx(arrayBuffer) {
  // Pre-bundled browser build — the package's main entry pulls in node builtins.
  const mod = await import('mammoth/mammoth.browser.js');
  const mammoth = mod.default || mod;
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value || '';
}

// For cross-notes search: every cached extracted text we already have.
export async function cachedTexts() {
  const entries = await idbEntries('text:');
  return entries.map(({ key, value }) => {
    const [, fileId, mod] = key.split(':');
    return { fileId, modifiedTime: mod, text: value };
  });
}
