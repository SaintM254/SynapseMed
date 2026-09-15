import * as drive from '../lib/drive.js';
import { getClientId, loadSettings, saveSettings, clearSettings } from '../lib/settings.js';
import { clearKey, hasKey, setKey } from '../lib/gemini.js';
import { clearTreeCaches, idbClear } from '../lib/cache.js';
import { emit } from '../state.js';
import { mountFolderPicker } from './folderPicker.js';
import { icons } from './icons.js';
import { escapeHtml } from '../lib/utils.js';

export function createSettingsModal(host, { onMessage }) {
  let isOpen = false;

  function render() {
    const settings = loadSettings();
    host.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Settings">
      <header class="modal-head">
        <h2 class="modal-title">Settings</h2>
        <button class="icon-btn" type="button" data-close aria-label="Close settings">${icons.close}</button>
      </header>
      <div class="modal-body">
        <section class="set-section">
          <h3>Google Drive</h3>
          <p class="set-note">Connected with read-only access. Files are listed and streamed, never copied away.</p>
          <div class="set-row">
            <div class="set-grow">
              <span class="set-label">Notes folder</span>
              <p class="set-value">${escapeHtml(settings.rootFolderName || '(not set)')}
                <a href="#" class="set-link" data-change-folder>change</a></p>
            </div>
          </div>
          <div class="set-picker" id="set-picker-host" hidden></div>
          <div class="set-row">
            <label class="field set-grow">
              <span class="field-label">OAuth client ID</span>
              <input id="set-client" class="text-input mono" type="text" value="${escapeHtml(getClientId())}" spellcheck="false"/>
            </label>
            <button class="btn ghost" data-save-client type="button">Save</button>
          </div>
        </section>

        <section class="set-section">
          <h3>Gemini</h3>
          <p class="set-note">The key is stored only in this browser’s local storage and is sent only to Google’s
          Generative Language API. Nothing passes through any other server.</p>
          <div class="set-row">
            <label class="field set-grow">
              <span class="field-label">API key</span>
              <input id="set-key" class="text-input mono" type="password" autocomplete="off" spellcheck="false"
                     placeholder="${hasKey() ? '•••••••••••••• (saved)' : 'AIza…'}"/>
            </label>
            <div class="set-btns">
              <button class="btn ghost" data-save-key type="button">Save key</button>
              <button class="btn ghost danger" data-clear-key type="button" ${hasKey() ? '' : 'disabled'}>Clear key</button>
            </div>
          </div>
          <p class="set-note" data-key-status>${hasKey() ? 'A key is saved in this browser.' : 'No key saved yet.'}</p>
        </section>

        <section class="set-section">
          <h3>Cache</h3>
          <p class="set-note">Folder listings are cached for 10 minutes; extracted text is cached offline so
          re-reading is instant. Cached data never leaves this browser.</p>
          <button class="btn ghost" data-clear-cache type="button">Clear cached data</button>
        </section>

        <section class="set-section">
          <h3>Session</h3>
          <button class="btn danger-solid" data-disconnect type="button">Sign out &amp; reset</button>
          <p class="set-note">Removes the Google sign-in, saved settings, API key and all cached data from this browser.</p>
        </section>
      </div>
    </div>`;
    wire();
  }

  function wire() {
    host.querySelectorAll('[data-close]').forEach((node) => node.addEventListener('click', close));

    host.querySelector('[data-save-client]').addEventListener('click', () => {
      const v = host.querySelector('#set-client').value.trim();
      if (!v) return onMessage?.('Client ID can’t be empty.');
      saveSettings({ clientId: v });
      onMessage?.('Client ID saved.');
    });

    host.querySelector('[data-change-folder]').addEventListener('click', (e) => {
      e.preventDefault();
      const box = host.querySelector('#set-picker-host');
      box.hidden = !box.hidden;
      if (!box.hidden && !box.hasChildNodes()) {
        mountFolderPicker(box, {
          onPick: ({ id, name }) => {
            saveSettings({ rootFolderId: id, rootFolderName: name });
            close();
            onMessage?.(`Notes folder set to “${name}”. Syncing…`);
            emit('app:folder-changed');
          }
        });
      }
    });

    host.querySelector('[data-save-key]').addEventListener('click', () => {
      const v = host.querySelector('#set-key').value.trim();
      if (!v) return onMessage?.('Paste the key first.');
      setKey(v);
      onMessage?.('Gemini key saved in this browser.');
      render();
    });

    host.querySelector('[data-clear-key]').addEventListener('click', () => {
      clearKey();
      onMessage?.('Gemini key cleared.');
      render();
    });

    host.querySelector('[data-clear-cache]').addEventListener('click', async () => {
      clearTreeCaches();
      try {
        await idbClear();
      } catch {}
      onMessage?.('Cached data cleared.');
    });

    host.querySelector('[data-disconnect]').addEventListener('click', () => {
      drive.signOut();
      clearTreeCaches();
      idbClear().catch(() => {});
      clearSettings();
      emit('app:signout');
    });
  }

  function onKey(e) {
    if (isOpen && e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);

  function open() {
    isOpen = true;
    render();
  }

  function close() {
    isOpen = false;
    host.innerHTML = '';
  }

  return { open, close };
}
