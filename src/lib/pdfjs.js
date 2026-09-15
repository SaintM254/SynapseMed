// Lazy single-loader for pdf.js — it only gets bundled into the PDF chunk,
// so the app shell stays small.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let pdfjsPromise = null;

export function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}
