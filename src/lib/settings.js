// Settings persisted in localStorage. API keys never leave the browser:
// the Gemini key goes only to generativelanguage.googleapis.com, and the
// Google client ID only identifies this app to Google's sign-in.
const KEY = 'synapsemed.settings.v1';

export function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('Could not save settings', err);
  }
  return next;
}

export function clearSettings() {
  localStorage.removeItem(KEY);
}

// Optional build-time default. A *web* OAuth client ID is not a secret —
// it just identifies the app, so baking it into the bundle is safe.
// Users can always override it on the connect screen / in Settings.
export function getClientId() {
  return loadSettings().clientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
}
