// Google Identity Services + Drive v3 REST (no gapi dependency).
// Files are never copied anywhere — only listed and streamed on demand.

export const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const API = 'https://www.googleapis.com/drive/v3';

let gisReady = null;
let accessToken = null;
let tokenExpiresAt = 0;
let activeClientId = null;

// Small session-only buffer cache so opening a file and then asking a
// question about it doesn't download the bytes twice.
const dataCache = new Map(); // fileId -> ArrayBuffer (max 3 entries)
export function recallData(id) {
  return dataCache.get(id) || null;
}
export function rememberData(id, buf) {
  if (dataCache.size >= 3) dataCache.delete(dataCache.keys().next().value);
  dataCache.set(id, buf);
}

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisReady) {
    gisReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load Google sign-in. Check your connection and try again.'));
      document.head.appendChild(s);
    });
  }
  return gisReady;
}

export function isSignedIn() {
  return Boolean(accessToken);
}

// silent: no consent prompt (used for token refreshes and resume flow).
export async function signIn(clientId, { silent = false } = {}) {
  await loadGis();
  activeClientId = clientId;
  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        accessToken = resp.access_token;
        tokenExpiresAt = Date.now() + Math.max(0, (resp.expires_in || 3599) - 60) * 1000;
        resolve(accessToken);
      },
      error_callback: (err) => {
        reject(
          new Error(
            err?.type === 'popup_closed' ? 'Sign-in was cancelled.' : 'Google sign-in failed. Please try again.'
          )
        );
      }
    });
    tokenClient.requestAccessToken({ prompt: silent ? '' : 'consent' });
  });
}

export function signOut() {
  if (accessToken && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    } catch {}
  }
  accessToken = null;
  tokenExpiresAt = 0;
}

export function hasValidToken() {
  return Boolean(accessToken) && Date.now() < tokenExpiresAt;
}

async function ensureToken() {
  if (hasValidToken()) return accessToken;
  // Refresh silently — works because the user has already consented.
  return signIn(activeClientId, { silent: true });
}

async function driveFetch(url, { method = 'GET', retry = true } = {}) {
  await ensureToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, method });
  if (res.status === 401 && retry) {
    accessToken = null;
    await ensureToken();
    return driveFetch(url, { method, retry: false });
  }
  return res;
}

export class DriveError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function errorMessage(status) {
  if (status === 401) return 'Your Google sign-in expired. Sign in again from the connect screen.';
  if (status === 403)
    return 'Drive refused access. Make sure the Drive API is enabled for your Google Cloud project and the folder belongs to this account.';
  if (status === 404) return 'That folder or file was not found. Check the link and its sharing permissions.';
  if (status === 429) return 'Drive rate limit reached. Wait a moment and try again.';
  return `Drive request failed (${status}).`;
}

const LIST_FIELDS = 'nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, webViewLink)';

export async function listChildren(folderId) {
  const out = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: LIST_FIELDS,
      pageSize: '1000',
      orderBy: 'folder, name'
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await driveFetch(`${API}/files?${params}`);
    if (!res.ok) throw new DriveError(errorMessage(res.status), res.status);
    const data = await res.json();
    out.push(...(data.files || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return out;
}

export async function listFolders(folderId) {
  const items = await listChildren(folderId);
  return items.filter((f) => f.mimeType === FOLDER_MIME);
}

export async function getFolderMeta(folderId) {
  const res = await driveFetch(`${API}/files/${folderId}?fields=id,name`);
  if (!res.ok) throw new DriveError(errorMessage(res.status), res.status);
  return res.json();
}

async function getMeta(id, fields) {
  const res = await driveFetch(`${API}/files/${id}?fields=${encodeURIComponent(fields)}`);
  if (!res.ok) throw new DriveError(errorMessage(res.status), res.status);
  return res.json();
}

function normalizeEntry(it, parentId) {
  return {
    id: it.id,
    name: it.name,
    mimeType: it.mimeType,
    parentId,
    modifiedTime: it.modifiedTime || null,
    size: Number(it.size) || 0,
    thumbnailLink: it.thumbnailLink || null,
    webViewLink: it.webViewLink || `https://drive.google.com/file/d/${it.id}/view`
  };
}

// Recursively walk the chosen root folder and build a plain-object tree
// (safe to JSON-cache client-side).
export async function buildTree(rootId, onProgress) {
  const folders = {};
  const files = {};
  const childrenOf = {};
  const queue = [rootId];

  try {
    const meta = await getFolderMeta(rootId);
    folders[rootId] = { id: rootId, name: meta.name, parentId: null, isRoot: true };
  } catch {
    folders[rootId] = { id: rootId, name: 'My notes', parentId: null, isRoot: true };
  }

  while (queue.length) {
    const batch = queue.splice(0, 4); // a little parallelism, no request storms
    await Promise.all(
      batch.map(async (fid) => {
        const items = await listChildren(fid);
        childrenOf[fid] = [];
        for (const it of items) {
          const entry = normalizeEntry(it, fid);
          if (it.mimeType === FOLDER_MIME) {
            folders[it.id] = entry;
            queue.push(it.id);
            childrenOf[fid].push({ kind: 'folder', id: it.id });
          } else {
            files[it.id] = entry;
            childrenOf[fid].push({ kind: 'file', id: it.id });
          }
        }
        onProgress?.({ folders: Object.keys(folders).length, files: Object.keys(files).length });
      })
    );
  }

  const byName = (ea, eb) => ea.name.localeCompare(eb.name, undefined, { sensitivity: 'base', numeric: true });
  for (const fid of Object.keys(childrenOf)) {
    childrenOf[fid].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      const ea = a.kind === 'folder' ? folders[a.id] : files[a.id];
      const eb = b.kind === 'folder' ? folders[b.id] : files[b.id];
      return byName(ea, eb);
    });
  }

  return { rootId, folders, files, childrenOf, builtAt: Date.now() };
}

export async function downloadFile(id, onProgress) {
  const res = await driveFetch(`${API}/files/${id}?alt=media`);
  if (!res.ok) throw new DriveError(errorMessage(res.status), res.status);
  if (!res.body || !onProgress) return res.arrayBuffer();

  const total = Number(res.headers.get('Content-Length')) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(received, total);
  }
  const buf = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.length;
  }
  return buf.buffer;
}

// Drive can export Google-native files (Docs) to plain text.
export async function exportText(id) {
  const res = await driveFetch(`${API}/files/${id}/export?mimeType=${encodeURIComponent('text/plain')}`);
  if (!res.ok) throw new DriveError(errorMessage(res.status), res.status);
  return res.text();
}

// Note: fetchFileMeta kept for future exportLinks use.
export async function fetchFileMeta(id, fields) {
  return getMeta(id, fields);
}

export async function fetchBlobUrl(id, { thumbnail = false, width = 1400 } = {}) {
  let url = `${API}/files/${id}?alt=media`;
  if (thumbnail) {
    // thumbnailLink ends in "=s220"; swap in a larger size for a crisper preview.
    const meta = await getMeta(id, 'thumbnailLink');
    if (meta.thumbnailLink) url = meta.thumbnailLink.replace(/=s\d+$/, `=s${width}`);
  }
  const res = await driveFetch(url);
  if (!res.ok) throw new DriveError(errorMessage(res.status), res.status);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// Accept either a raw folder ID or a full Drive URL.
export function parseFolderInput(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  const m = str.match(/folders\/([-\w]+)/) || str.match(/^([-\w]{20,})$/);
  return m ? m[1] : null;
}
