import { on, emit, store } from '../state.js';
import { icons } from './icons.js';
import { escapeHtml } from '../lib/utils.js';

// Left pane: a folder tree that actually looks like one —
// indentation + subtle connecting lines, no card grid.
export function createTree(el) {
  const statusEl = el.querySelector('#tree-status');
  const metaEl = el.querySelector('#tree-meta');
  const host = el.querySelector('#tree-host');

  function setStatus(text) {
    statusEl.hidden = !text;
    if (text) statusEl.textContent = text;
  }

  function setMeta(text) {
    metaEl.hidden = !text;
    if (text) metaEl.textContent = text;
  }

  function render() {
    if (!store.tree) return;
    host.innerHTML = '';
    const ul = document.createElement('ul');
    ul.className = 'ftree';
    ul.appendChild(node(store.tree.rootId));
    host.appendChild(ul);
  }

  function node(folderId) {
    const tree = store.tree;
    const folder = tree.folders[folderId];
    const kids = (tree.childrenOf[folderId] || []).filter((k) => k.kind === 'folder');
    const expanded = store.expanded.has(folderId);

    const li = document.createElement('li');
    li.className = 'ftree-item';

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'ftree-row';
    row.setAttribute('aria-expanded', kids.length ? String(expanded) : 'false');
    if (store.currentFolderId === folderId) row.setAttribute('aria-current', 'true');
    row.title = folder.name;
    row.innerHTML = `
      <span class="ftree-caret ${kids.length ? '' : 'is-leaf'}">${icons.caret}</span>
      <span class="ftree-ico">${icons.folder}</span>
      <span class="ftree-name">${escapeHtml(folder.name)}</span>`;
    row.addEventListener('click', () => {
      store.currentFolderId = folderId;
      if (kids.length) {
        if (store.expanded.has(folderId)) store.expanded.delete(folderId);
        else store.expanded.add(folderId);
      }
      emit('folder', folderId);
    });
    li.appendChild(row);

    if (kids.length && expanded) {
      const sub = document.createElement('ul');
      sub.className = 'ftree-sub';
      for (const k of kids) sub.appendChild(node(k.id));
      li.appendChild(sub);
    }
    return li;
  }

  on('tree', () => {
    setStatus(null);
    render();
  });
  on('tree:expanded', render);
  on('folder', render);

  return { render, setStatus, setMeta };
}
