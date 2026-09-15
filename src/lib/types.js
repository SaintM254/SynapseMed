// Drive mimeType -> viewer type mapping.
export function typeOfFile(file) {
  const m = file?.mimeType || '';
  if (m === 'application/pdf') return 'pdf';
  if (m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (m === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';
  // Google-native files aren't downloadable binaries — render via Drive's
  // own embed and export their text when needed.
  if (m === 'application/vnd.google-apps.document') return 'gdoc';
  if (m === 'application/vnd.google-apps.presentation') return 'gslides';
  if (m === 'image/png' || m === 'image/jpeg' || m === 'image/webp' || m === 'image/gif') return 'image';
  return 'other';
}

export const TYPE_LABEL = {
  pdf: 'PDF',
  docx: 'Document',
  pptx: 'Slides',
  gdoc: 'Google Doc',
  gslides: 'Google Slides',
  image: 'Image',
  other: 'File'
};

export function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function pathOf(tree, folderId) {
  if (!tree) return '';
  const parts = [];
  let cur = tree.folders[folderId];
  let guard = 0;
  while (cur && guard++ < 40) {
    if (!cur.isRoot) parts.unshift(cur.name);
    cur = cur.parentId ? tree.folders[cur.parentId] : null;
  }
  return parts.join(' / ');
}
