import './styles.css';
import { on } from './state.js';
import { mountHero } from './ui/hero.js';
import { mountShell } from './ui/shell.js';

const app = document.getElementById('app');

function showHero() {
  document.body.dataset.screen = 'hero';
  app.replaceChildren();
  const el = document.createElement('div');
  el.className = 'screen screen-hero';
  app.appendChild(el);
  mountHero(el, { onReady: showApp });
}

async function showApp() {
  document.body.dataset.screen = 'app';
  app.replaceChildren();
  const el = document.createElement('div');
  el.className = 'screen screen-app';
  app.appendChild(el);
  try {
    await mountShell(el);
  } catch (err) {
    console.error(err);
    const box = document.createElement('div');
    box.className = 'fatal-box';
    box.innerHTML = `
      <h2>Something went wrong.</h2>
      <p>${err?.message || 'The workspace could not start.'}</p>
      <button class="btn ghost" type="button">Back to start</button>`;
    box.querySelector('button').addEventListener('click', showHero);
    el.appendChild(box);
  }
}

// Sign-out wipes state, so restart clean rather than unwiring every listener.
on('app:signout', () => window.location.reload());

showHero();
