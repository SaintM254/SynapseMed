// PPTX + Google-native files: Drive's own embed. Google's renderer is fast,
// accurate and free — and the reader stays inside SynapseMed.
export async function render(container, file, hooks) {
  const wrap = document.createElement('div');
  wrap.className = 'embed-wrap';

  const note = document.createElement('p');
  note.className = 'embed-note';
  note.innerHTML = `Rendered by Google Drive. If it stays blank, your browser may be
    blocking the embedded sign-in — use <a href="${file.webViewLink}" target="_blank" rel="noopener">Open in Drive</a>.`;

  const frame = document.createElement('iframe');
  frame.className = 'embed-frame';
  frame.title = file.name;
  frame.loading = 'lazy';
  frame.allowFullscreen = true;
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
  frame.src = `https://drive.google.com/file/d/${file.id}/preview`;
  frame.addEventListener('load', () => hooks.ready(), { once: true });
  // Some browsers fire no load event for cross-origin sandboxes; don't
  // leave a skeleton up forever.
  const fallback = setTimeout(() => hooks.ready(), 5000);

  wrap.appendChild(note);
  wrap.appendChild(frame);
  container.appendChild(wrap);
  hooks.setCounter(null);

  return () => {
    clearTimeout(fallback);
    frame.src = 'about:blank';
  };
}
