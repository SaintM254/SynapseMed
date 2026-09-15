import * as drive from '../lib/drive.js';
import { icons } from './icons.js';
import { escapeHtml } from '../lib/utils.js';

// Reusable "pick a Drive folder" widget: paste a link/ID, or browse My Drive.
// Calls onPick({ id, name }) when the user confirms.
export function mountFolderPicker(container, { onPick }) {
  container.innerHTML = `
    <div class="fp">
      <div class="fp-paste">
        <input class="text-input mono" id="fp-input" type="text" spellcheck="false" autocomplete="off"
               placeholder="Paste a Drive folder link or ID" aria-label="Drive folder link or ID"/>
        <button class="btn ghost" id="fp-use" type="button">Use</button>
      </div>
      <div class="fp-or"><span>or browse My Drive</span></div>
      <div class="fp-crumbs" id="fp-crumbs"></div>
      <div class="fp-list" id="fp-list" role="listbox" aria-label="Folders"></div>
      <div class="fp-foot">
        <span class="fp-msg" id="fp-msg" role="status"></span>
        <button class="btn primary sm" id="fp-select" type="button" disabled>Select this folder</button>
      </div>
    </div>`;

  const input = container.querySelector('#fp-input');
  const useBtn = container.querySelector('#fp-use');
  const crumbsEl = container.querySelector('#fp-crumbs');
  const listEl = container.querySelector('#fp-list');
  const msgEl = container.querySelector('#fp-msg');
  const selectBtn = container.querySelector('#fp-select');

  const stack = [{ id: null, name: 'My Drive' }]; // null id = Drive root
  let loading = false;

  const current = () => stack[stack.length - 1];

  function setMsg(msg, isError) {
    msgEl.textContent = msg || '';
    msgEl.classList.toggle('is-error', Boolean(isError));
  }

  function renderCrumbs() {
    crumbsEl.innerHTML = stack
      .map(
        (f, i) => `
        <button class="fp-crumb ${i === stack.length - 1 ? 'current' : ''}" data-i="${i}" type="button">
          ${icons.folder}<span>${escapeHtml(f.name)}</span>
        </button>`
      )
      .join('<span class="fp-sep">/</span>');
    crumbsEl.querySelectorAll('.fp-crumb').forEach((b) =>
      b.addEventListener('click', () => {
        const i = Number(b.dataset.i);
        stack.length = i + 1;
        load();
      })
    );
    const cur = current();
    selectBtn.disabled = !cur.id || loading;
    selectBtn.textContent = cur.id ? `Select “${cur.name}”` : 'Select a folder';
  }

  async function load() {
    loading = true;
    renderCrumbs();
    setMsg('Loading folders…');
    listEl.innerHTML = '<div class="fp-loading"><span class="skel skel-line"></span><span class="skel skel-line w70"></span></div>';
    try {
      const folders = await drive.listFolders(current().id || 'root');
      loading = false;
      setMsg(folders.length ? '' : 'This folder has no subfolders.');
      listEl.innerHTML = folders.length
        ? folders
            .map(
              (f) => `
            <button class="fp-row" data-id="${f.id}" data-name="${escapeHtml(f.name)}" type="button">
              <span class="fp-row-ico">${icons.folder}</span>
              <span class="fp-row-name">${escapeHtml(f.name)}</span>
              <span class="fp-row-go">${icons.caret}</span>
            </button>`
            )
            .join('')
        : '';
      listEl.querySelectorAll('.fp-row').forEach((row) =>
        row.addEventListener('click', () => {
          stack.push({ id: row.dataset.id, name: row.dataset.name });
          load();
        })
      );
    } catch (err) {
      loading = false;
      listEl.innerHTML = '';
      setMsg(err.message || 'Could not list folders.', true);
    }
    renderCrumbs();
  }

  useBtn.addEventListener('click', async () => {
    const id = drive.parseFolderInput(input.value);
    if (!id) {
      setMsg('That doesn’t look like a Drive folder link or ID.', true);
      return;
    }
    setMsg('Checking that folder…');
    useBtn.disabled = true;
    try {
      const meta = await drive.getFolderMeta(id);
      stack.length = 1;
      stack.push({ id: meta.id, name: meta.name });
      input.value = '';
      setMsg('');
      load();
    } catch (err) {
      setMsg(err.message || 'Could not open that folder.', true);
    } finally {
      useBtn.disabled = false;
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      useBtn.click();
    }
  });

  selectBtn.addEventListener('click', () => {
    const cur = current();
    if (cur.id) onPick({ id: cur.id, name: cur.name });
  });

  load();
}
