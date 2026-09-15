import { getClientId, loadSettings, saveSettings } from '../lib/settings.js';
import * as drive from '../lib/drive.js';
import { hasKey, setKey } from '../lib/gemini.js';
import { mountFolderPicker } from './folderPicker.js';
import { icons } from './icons.js';
import { escapeHtml } from '../lib/utils.js';

// Landing page + one-time connect flow:
//   1. Sign in with Google (read-only Drive scope)
//   2. Pick the study-notes folder   (only on first run)
//   3. Optional Gemini key           (only if not saved yet)
export function mountHero(rootEl, { onReady }) {
  rootEl.innerHTML = `
    <div class="hero">
      <header class="hero-top">
        <div class="brand-mark">${icons.logo}<span>SynapseMed</span></div>
        <span class="hero-tag">a private study workspace</span>
      </header>

      <main class="hero-main">
        <section class="hero-copy">
          <h1 class="display">Your notes,<br>gently reopened.</h1>
          <p class="lede">A quiet workspace for revisiting your nursing degree notes — folder by folder, at your
          own pace. SynapseMed reads your Google Drive and keeps notes, slides and summaries side by side, without
          the tab juggling.</p>

          <ol class="hero-steps">
            <li>
              <span class="step-n">1</span>
              <div>Connect your notes folder
                <small>Read-only. Files stay in Drive and are only listed and streamed when you open them.</small>
              </div>
            </li>
            <li>
              <span class="step-n">2</span>
              <div>Read in the built-in viewer
                <small>PDFs, documents, slides and images — rendered right here, fast enough to just sit and read.</small>
              </div>
            </li>
            <li>
              <span class="step-n">3</span>
              <div>Ask, when it helps
                <small>An optional Gemini key — stored only in this browser — powers summaries and questions.</small>
              </div>
            </li>
          </ol>

          <div class="connect-card" id="connect"></div>
        </section>

        <aside class="hero-art" aria-hidden="true">${heroArt()}</aside>
      </main>

      <footer class="hero-foot">
        <p>SynapseMed is a static site — there is no SynapseMed server. Your settings and Gemini key are stored only in
        this browser and are sent nowhere except Google's own APIs.</p>
      </footer>
    </div>`;

  const card = rootEl.querySelector('#connect');
  renderSignin();

  // ---- Step 1: Google sign-in ----
  function renderSignin() {
    const settings = loadSettings();
    const resume = Boolean(settings.rootFolderId);
    const clientId = getClientId();

    card.innerHTML = `
      <div class="cc-head">
        <h2>${resume ? 'Welcome back' : 'Connect your library'}</h2>
        <p>${resume
          ? `Sign in again to reopen <strong>${escapeHtml(settings.rootFolderName || 'your notes folder')}</strong>.`
          : 'Sign in with the Google account that holds your study notes.'}</p>
      </div>
      <label class="field">
        <span class="field-label">Google OAuth client ID</span>
        <input class="text-input mono" id="cc-client" type="text" value="${escapeHtml(clientId)}"
               placeholder="12345…apps.googleusercontent.com" autocomplete="off" spellcheck="false"/>
        <span class="field-hint">Identifies this app to Google — it isn’t a secret. Creating one takes about two
        minutes; the README walks through it.</span>
      </label>
      <button class="btn primary wide" id="cc-signin" type="button">${icons.google}<span>Sign in with Google</span></button>
      <p class="cc-error" id="cc-error" hidden></p>
      <p class="cc-fine">Read-only access — SynapseMed can list and download files from the folder you choose, and
      nothing else.</p>`;

    const btn = card.querySelector('#cc-signin');
    const err = card.querySelector('#cc-error');
    btn.addEventListener('click', async () => {
      const val = card.querySelector('#cc-client').value.trim();
      if (!val) {
        err.textContent = 'Enter your Google OAuth client ID first — the README shows how to create one.';
        err.hidden = false;
        return;
      }
      if (!val.endsWith('.apps.googleusercontent.com')) {
        err.textContent = 'That doesn’t look like a client ID — it usually ends with .apps.googleusercontent.com';
        err.hidden = false;
        return;
      }
      err.hidden = true;
      btn.disabled = true;
      btn.querySelector('span').textContent = 'Waiting for Google…';
      try {
        saveSettings({ clientId: val });
        await drive.signIn(val);
        const fresh = loadSettings();
        if (!fresh.rootFolderId) return renderFolder();
        if (!hasKey()) return renderKey();
        onReady();
      } catch (e) {
        btn.disabled = false;
        btn.querySelector('span').textContent = 'Sign in with Google';
        err.textContent = e.message || 'Sign-in failed.';
        err.hidden = false;
      }
    });
  }

  // ---- Step 2: pick the notes folder ----
  function renderFolder() {
    card.innerHTML = `
      <div class="cc-head">
        <h2>Pick your notes folder</h2>
        <p>Choose the Drive folder that holds your study notes. Subfolders — Clinical Pharmacology, Year 1–4, and so
        on — are picked up automatically.</p>
      </div>
      <div id="cc-picker"></div>`;
    mountFolderPicker(card.querySelector('#cc-picker'), {
      onPick: ({ id, name }) => {
        saveSettings({ rootFolderId: id, rootFolderName: name });
        if (hasKey()) return onReady();
        renderKey();
      }
    });
  }

  // ---- Step 3: optional Gemini key ----
  function renderKey() {
    card.innerHTML = `
      <div class="cc-head">
        <h2>Add your Gemini key <span class="cc-optional">optional</span></h2>
        <p>Powers “Summarize” and “Ask”. The key goes straight from this browser to Google’s API and is stored only
        in local storage — you can clear it any time in Settings.</p>
      </div>
      <label class="field">
        <span class="field-label">Gemini API key</span>
        <input class="text-input mono" id="cc-key" type="password" placeholder="AIza…" autocomplete="off" spellcheck="false"/>
        <span class="field-hint">Get a free key at aistudio.google.com.</span>
      </label>
      <div class="cc-actions">
        <button class="btn primary" id="cc-save" type="button">Save key &amp; open workspace</button>
        <button class="btn ghost" id="cc-skip" type="button">Skip for now</button>
      </div>
      <p class="cc-error" id="cc-error" hidden></p>`;

    card.querySelector('#cc-save').addEventListener('click', () => {
      const v = card.querySelector('#cc-key').value.trim();
      const err = card.querySelector('#cc-error');
      if (!v) {
        err.textContent = 'Paste your key, or choose “Skip for now”.';
        err.hidden = false;
        return;
      }
      setKey(v);
      onReady();
    });
    card.querySelector('#cc-skip').addEventListener('click', onReady);
  }
}

// The one bold visual moment: an abstract branching network of
// dendrite lines converging into a single glowing node.
function heroArt() {
  const ink = '#39415A';
  const dim = '#2A3247';
  const line = (d, i, accent) =>
    `<path d="${d}" class="hero-line${accent ? ' hero-line-accent' : ''}" style="--i:${i}" pathLength="1" fill="none"
      stroke="${accent ? '#5EEAD4' : ink}" stroke-width="${accent ? 2 : 1.4}" stroke-linecap="round"/>`;
  const tip = (cx, cy, i, teal) =>
    `<circle class="hero-tip" style="--i:${i}" cx="${cx}" cy="${cy}" r="3" fill="${teal ? '#5EEAD4' : dim}"
      stroke="${ink}" stroke-width="1.2"/>`;

  return `
  <svg class="hero-svg" viewBox="0 0 460 380" role="img" aria-label="Abstract network of branching lines converging into one glowing node">
    <defs>
      <radialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#5EEAD4" stop-opacity="0.5"/>
        <stop offset="45%" stop-color="#5EEAD4" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#5EEAD4" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle class="hero-halo" cx="392" cy="190" r="92" fill="url(#heroGlow)"/>
    ${line('M30 50 C 118 58, 208 104, 352 176', 0)}
    ${line('M30 108 C 112 116, 214 146, 356 184', 1)}
    ${line('M30 190 C 132 190, 252 190, 358 190', 2)}
    ${line('M30 270 C 112 264, 214 234, 356 196', 3)}
    ${line('M30 330 C 118 322, 208 276, 352 204', 4)}
    ${line('M150 126 C 186 96, 214 84, 252 74', 5)}
    ${line('M150 254 C 186 284, 216 296, 254 306', 6)}
    ${line('M112 152 C 144 130, 170 120, 202 114', 7)}
    ${line('M112 230 C 144 252, 172 260, 204 266', 8)}
    ${line('M358 190 L 378 190', 9, true)}
    ${tip(30, 50, 2)}${tip(30, 108, 3)}${tip(30, 190, 4)}${tip(30, 270, 5)}${tip(30, 330, 6)}
    ${tip(254, 73, 8)}${tip(256, 307, 9)}${tip(204, 113, 10)}${tip(206, 267, 11)}
    <circle class="hero-ring" cx="392" cy="190" r="17" fill="none" stroke="#5EEAD4" stroke-opacity="0.35" stroke-width="1.5"/>
    <circle class="hero-node" cx="392" cy="190" r="7.5" fill="#5EEAD4"/>
  </svg>`;
}
