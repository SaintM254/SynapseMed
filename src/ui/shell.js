import { store, on, emit } from '../state.js';
import * as cache from '../lib/cache.js';
import * as drive from '../lib/drive.js';
import { loadSettings } from '../lib/settings.js';
import { hasKey } from '../lib/gemini.js';
import { createTree } from './tree.js';
import { createFileList } from './fileList.js';
import { createViewer } from './viewer.js';
import { createAiPanel } from './aiPanel.js';
import { createSettingsModal } from './settingsModal.js';
import { icons, typeIcon } from './icons.js';
import { typeOfFile, pathOf } from '../lib/types.js';
import { debounce, escapeHtml, timeAgo } from '../lib/utils.js';

const MOBILE_QUERY = '(max-width: 899px)';

// The app shell: topbar (search / sync / settings) + three panes
// (folder tree, file list, viewer + AI), with a single-pane,
// bottom-nav-driven flow on mobile.
export async function mountShell(rootEl) {
  const settings = loadSettings();
  store.rootFolderId = settings.rootFolderId;

  rootEl.innerHTML = `
    <header class="topbar">
      <button class="icon-btn only-mobile" id="tb-back" type="button" aria-label="Back">${icons.back}</button>
      <div class="tb-brand">${icons.logo}<span class="tb-name">SynapseMed</span></div>
      <div class="tb-search">
        <span class="icon tb-search-ico">${icons.search}</span>
        <input id="search-input" class="tb-search-input" type="search" autocomplete="off" spellcheck="false"
               placeholder="Search notes…" aria-label="Search your notes"/>
        <div class="search-results" id="search-results" hidden>
          <div class="sr-list" id="sr-list" role="listbox"></div>
          <button class="sr-ask" id="sr-ask" type="button">${icons.sparkle}<span>Ask across all my notes</span></button>
        </div>
      </div>
      <button class="btn ghost tb-btn" id="btn-sync" type="button" title="Re-sync from Drive">
        ${icons.sync}<span class="hide-sm">Sync</span>
      </button>
      <button class="icon-btn" id="btn-settings" type="button" aria-label="Settings">${icons.gear}</button>
    </header>

    <div class="workspace">
      <aside class="pane pane-tree" id="pane-tree" aria-label="Folders">
        <div class="pane-head">
          <span>Folders</span>
          <span class="pane-head-meta" id="tree-meta" hidden></span>
        </div>
        <div class="tree-status" id="tree-status">Loading your folders…</div>
        <div class="tree-host" id="tree-host"></div>
      </aside>
      <section class="pane pane-list" id="pane-list" aria-label="Files"></section>
      <section class="pane pane-viewer" id="pane-viewer" aria-label="Viewer">
        <div class="viewer-main" id="viewer-main"></div>
        <div class="ai-dock" id="ai-dock" hidden></div>
      </section>
    </div>

    <nav class="bottomnav only-mobile" id="bottomnav" aria-label="Navigate">
      <button type="button" data-pane="tree">${icons.folder}<span>Folders</span></button>
      <button type="button" data-pane="list">${icons.file}<span>Files</span></button>
      <button type="button" data-pane="viewer">${icons.ft_pdf}<span>Viewer</span></button>
    </nav>

    <div class="ai-sheet only-mobile" id="ai-sheet" hidden>
      <div class="ai-sheet-grab"><span></span></div>
      <div class="ai-sheet-body" id="ai-sheet-body"></div>
    </div>

    <div class="toast" id="toast" role="status" hidden></div>
    <div id="modal-host"></div>`;

  const $ = (sel) => rootEl.querySelector(sel);
  const treePane = $('#pane-tree');
  const listPane = $('#pane-list');
  const viewerPane = $('#pane-viewer');
  const viewerMain = $('#viewer-main');
  const aiDock = $('#ai-dock');
  const aiSheet = $('#ai-sheet');
  const aiSheetBody = $('#ai-sheet-body');
  const backBtn = $('#tb-back');
  const bottomNav = $('#bottomnav');
  const toastEl = $('#toast');

  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), 3800);
  }

  // ---- modules ----
  const ai = createAiPanel({ onClose: () => toggleAi(false) });
  createViewer(viewerMain, { onAiToggle: () => toggleAi(!store.aiOpen), onMessage: toast });
  createFileList(listPane);
  const treeMod = createTree(treePane);
  const settingsModal = createSettingsModal($('#modal-host'), { onMessage: toast });

  // search index — invalidated whenever a fresh tree lands (declared early
  // because setTree() below clears it)
  let flat = null;

  // ---- mobile pane flow ----
  const mq = window.matchMedia(MOBILE_QUERY);

  function setPane(name) {
    store.mobilePane = name;
    treePane.classList.toggle('active', name === 'tree');
    listPane.classList.toggle('active', name === 'list');
    viewerPane.classList.toggle('active', name === 'viewer');
    bottomNav.querySelectorAll('button').forEach((b) => b.classList.toggle('current', b.dataset.pane === name));
    backBtn.style.visibility = name === 'tree' ? 'hidden' : 'visible';
  }

  backBtn.addEventListener('click', () => setPane(store.mobilePane === 'viewer' ? 'list' : 'tree'));
  bottomNav.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setPane(b.dataset.pane)));

  on('folder', () => {
    if (mq.matches && store.mobilePane === 'tree') setPane('list');
  });
  on('file', () => {
    if (mq.matches) setPane('viewer');
  });

  // ---- AI panel placement (dock on desktop, bottom sheet on mobile) ----
  function toggleAi(open) {
    store.aiOpen = open;
    if (mq.matches) {
      if (open && ai.el.parentElement !== aiSheetBody) aiSheetBody.appendChild(ai.el);
      aiSheet.hidden = !open;
      aiSheet.classList.toggle('open', open);
      aiDock.hidden = true;
      viewerPane.classList.remove('with-ai');
    } else {
      if (open && ai.el.parentElement !== aiDock) aiDock.appendChild(ai.el);
      aiDock.hidden = !open;
      viewerPane.classList.toggle('with-ai', open);
      aiSheet.hidden = true;
      aiSheet.classList.remove('open');
    }
    if (open) ai.focusInput();
  }
  mq.addEventListener('change', () => {
    if (store.aiOpen) toggleAi(true);
  });

  // ---- tree loading / sync ----
  function setTree(tree) {
    store.tree = tree;
    if (!store.expanded.size) store.expanded.add(tree.rootId);
    if (!store.currentFolderId || !tree.folders[store.currentFolderId]) {
      store.currentFolderId = tree.rootId;
    }
    flat = []; // invalidate search index
    emit('tree');
    emit('folder', store.currentFolderId);
    const fileCount = Object.keys(tree.files).length;
    treeMod.setMeta(`${fileCount} ${fileCount === 1 ? 'file' : 'files'} · synced ${timeAgo(tree.builtAt)}`);
  }

  const syncBtn = $('#btn-sync');

  async function resync() {
    if (store.syncing) return;
    store.syncing = true;
    syncBtn.classList.add('busy');
    treeMod.setStatus('Syncing your Drive…');
    try {
      const tree = await drive.buildTree(store.rootFolderId, ({ folders, files }) => {
        treeMod.setStatus(`Syncing — ${folders} ${folders === 1 ? 'folder' : 'folders'}, ${files} files so far…`);
      });
      cache.setCachedTree(store.rootFolderId, tree);
      treeMod.setStatus(null);
      setTree(tree);
    } catch (err) {
      treeMod.setStatus(store.tree ? null : 'Could not load your folders.');
      toast(err.message || 'Sync failed.');
    } finally {
      store.syncing = false;
      syncBtn.classList.remove('busy');
    }
  }

  syncBtn.addEventListener('click', resync);
  $('#btn-settings').addEventListener('click', () => settingsModal.open());

  on('app:folder-changed', () => {
    const fresh = loadSettings();
    store.rootFolderId = fresh.rootFolderId;
    store.currentFolderId = null;
    store.expanded.clear();
    store.currentFile = null;
    resync();
  });

  const cachedTree = cache.getCachedTree(store.rootFolderId);
  if (cachedTree) setTree(cachedTree);
  else await resync();

  // ---- global search (client-side, debounced) ----
  const searchInput = $('#search-input');
  const searchResults = $('#search-results');
  const srList = $('#sr-list');
  const srAsk = $('#sr-ask');
  let currentResults = [];
  let activeIdx = -1;

  function searchIndex() {
    const t = store.tree;
    if (!t) return [];
    const idx = [];
    for (const f of Object.values(t.folders)) {
      idx.push({ kind: 'folder', id: f.id, name: f.name, path: pathOf(t, f.parentId) });
    }
    for (const f of Object.values(t.files)) {
      idx.push({ kind: 'file', id: f.id, name: f.name, path: pathOf(t, f.parentId), file: f });
    }
    return idx;
  }

  function runSearch(q) {
    if (!q || q.length < 2 || !store.tree) return closeResults();
    if (!flat) flat = searchIndex();
    const needle = q.toLowerCase();
    currentResults = flat
      .filter((e) => e.name.toLowerCase().includes(needle))
      .sort(
        (a, b) =>
          a.name.toLowerCase().indexOf(needle) - b.name.toLowerCase().indexOf(needle) ||
          a.name.localeCompare(b.name)
      )
      .slice(0, 12);
    renderResults(q);
  }

  const debouncedSearch = debounce(() => runSearch(searchInput.value.trim()), 150);
  searchInput.addEventListener('input', debouncedSearch);
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length >= 2) runSearch(searchInput.value.trim());
  });

  function renderResults(q) {
    activeIdx = -1;
    srList.innerHTML = currentResults.length
      ? currentResults
          .map(
            (r, i) => `
          <button class="sr-row" data-i="${i}" type="button" role="option">
            <span class="sr-ico">${r.kind === 'folder' ? icons.folder : typeIcon(typeOfFile(r.file))}</span>
            <span class="sr-main">
              <span class="sr-name">${escapeHtml(r.name)}</span>
              ${r.path ? `<span class="sr-path">${escapeHtml(r.path)}</span>` : ''}
            </span>
          </button>`
          )
          .join('')
      : `<div class="sr-empty">No files match “${escapeHtml(q)}”.</div>`;

    srList.querySelectorAll('.sr-row').forEach((b) =>
      b.addEventListener('click', () => choose(Number(b.dataset.i)))
    );
    srAsk.hidden = !(q.length >= 3 && hasKey());
    searchResults.hidden = false;
  }

  function setActive(i) {
    activeIdx = i;
    srList.querySelectorAll('.sr-row').forEach((row, idx) => {
      row.classList.toggle('active', idx === activeIdx);
      if (idx === activeIdx) row.scrollIntoView({ block: 'nearest' });
    });
  }

  function choose(i) {
    const r = currentResults[i];
    if (!r) return;
    closeResults();
    searchInput.blur();
    expandAncestors(r.kind === 'folder' ? r.id : r.file.parentId);
    if (r.kind === 'folder') {
      store.currentFolderId = r.id;
      emit('folder', r.id);
    } else {
      store.currentFolderId = r.file.parentId;
      emit('folder', r.file.parentId);
      emit('file', r.file);
    }
  }

  function expandAncestors(folderId) {
    if (!store.tree) return;
    let pid = folderId;
    let guard = 0;
    while (pid && store.tree.folders[pid] && guard++ < 40) {
      store.expanded.add(pid);
      pid = store.tree.folders[pid].parentId;
    }
    emit('tree:expanded');
  }

  function closeResults() {
    searchResults.hidden = true;
  }

  searchInput.addEventListener('keydown', (e) => {
    if (searchResults.hidden) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(currentResults.length - 1, activeIdx + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(0, activeIdx - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0) choose(activeIdx);
      else if (currentResults.length) choose(0);
    } else if (e.key === 'Escape') {
      closeResults();
      searchInput.blur();
    }
  });

  document.addEventListener('pointerdown', (e) => {
    if (!searchResults.hidden && !e.target.closest('.tb-search')) closeResults();
  });

  srAsk.addEventListener('click', () => {
    const q = searchInput.value.trim();
    if (!q) return;
    closeResults();
    searchInput.value = '';
    toggleAi(true);
    ai.askAcross(q);
  });

  setPane('tree');
}
