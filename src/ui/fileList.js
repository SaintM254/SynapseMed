import { on, emit, store } from '../state.js';
import { icons, typeIcon } from './icons.js';
import { typeOfFile, TYPE_LABEL, formatSize, formatDate, pathOf } from '../lib/types.js';
import { escapeHtml } from '../lib/utils.js';

// Middle pane: the contents of the selected folder.
export function createFileList(el) {
  el.innerHTML = `
    <div class="list-head">
      <div class="list-crumbs" id="list-crumbs"></div>
      <h2 class="list-title" id="list-title"></h2>
    </div>
    <div class="list-host" id="list-host"></div>`;

  const crumbsEl = el.querySelector('#list-crumbs');
  const titleEl = el.querySelector('#list-title');
  const host = el.querySelector('#list-host');

  function render(folderId) {
    const tree = store.tree;
    if (!tree || !tree.folders[folderId]) return;
    const folder = tree.folders[folderId];

    titleEl.textContent = folder.isRoot ? 'All folders' : folder.name;
    crumbsEl.textContent = pathOf(tree, folderId) || store.rootFolderId && tree.folders[tree.rootId]?.name || '';

    const kids = tree.childrenOf[folderId] || [];
    host.innerHTML = '';
    if (!kids.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-note';
      empty.innerHTML = `<p>This folder is empty.</p><p class="empty-sub">Subfolders and study files will appear here once Drive is synced.</p>`;
      host.appendChild(empty);
      return;
    }

    for (const k of kids) {
      if (k.kind === 'folder') host.appendChild(folderRow(tree.folders[k.id]));
      else host.appendChild(fileRow(tree.files[k.id]));
    }
    highlight();
  }

  function folderRow(folder) {
    const fileCount = (store.tree.childrenOf[folder.id] || []).filter((c) => c.kind === 'file').length;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'frow frow-folder';
    row.title = folder.name;
    row.innerHTML = `
      <span class="frow-ico t-folder">${icons.folder}</span>
      <span class="frow-main">
        <span class="frow-name">${escapeHtml(folder.name)}</span>
        <span class="frow-meta"><span>${fileCount} ${fileCount === 1 ? 'file' : 'files'}</span></span>
      </span>
      <span class="frow-go">${icons.caret}</span>`;
    row.addEventListener('click', () => {
      store.currentFolderId = folder.id;
      emit('folder', folder.id);
    });
    return row;
  }

  function fileRow(file) {
    const type = typeOfFile(file);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'frow';
    row.dataset.file = file.id;
    row.title = file.name;
    const size = formatSize(file.size);
    const date = formatDate(file.modifiedTime);
    row.innerHTML = `
      <span class="frow-ico t-${type}">${typeIcon(type)}</span>
      <span class="frow-main">
        <span class="frow-name">${escapeHtml(file.name)}</span>
        <span class="frow-meta">
          <span class="frow-type">${TYPE_LABEL[type]}</span>
          ${size ? `<span>${size}</span>` : ''}
          ${date ? `<span>${date}</span>` : ''}
        </span>
      </span>`;
    row.addEventListener('click', () => emit('file', file));
    return row;
  }

  function highlight() {
    host.querySelectorAll('.frow[data-file]').forEach((r) => {
      if (r.dataset.file === store.currentFile?.id) r.setAttribute('aria-current', 'true');
      else r.removeAttribute('aria-current');
    });
  }

  on('folder', render);
  on('tree', () => {
    if (store.currentFolderId) render(store.currentFolderId);
  });
  on('file', (f) => {
    store.currentFile = f;
    highlight();
  });

  return { render };
}
