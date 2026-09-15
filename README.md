# SynapseMed

A quiet study workspace for nursing graduates who want to *reread* their
bachelor's-degree notes — not to cram, but to rebuild competence and a
reading habit. SynapseMed reads your own Google Drive folder live, renders
your PDFs, documents, slides, and images in one calm three-pane app, and
offers optional Gemini-powered summaries and questions.

No streaks. No countdowns. No gamification. Just your notes, gently reopened.

---

## What it does

- **Reads your Drive folder live** (read-only). Files are never copied or
  uploaded anywhere — they are only listed and streamed on demand when you
  open them. The folder listing is cached client-side for 10 minutes and
  refreshed with a manual **Sync** button.
- **Three-pane library** — folder tree, file list, and a built-in viewer,
  collapsing to a single-pane flow with bottom navigation on mobile.
- **Fast built-in viewer**
  - **PDF** — pdf.js with virtualized per-page canvases (only the pages near
    your scroll position are rendered), scroll-zoom / pinch-zoom, page counter.
  - **DOCX** — converted client-side to clean semantic HTML with mammoth.js.
    Much lighter than emulating Word, and better for reading.
  - **PPTX / Google Slides / Google Docs** — rendered by Google Drive's own
    embed in a sandboxed frame (fast and accurate), so you never leave the app.
  - **Images** — instant thumbnail preview, full resolution only when you zoom.
  - Everything else gets a honest "Open in Drive" escape hatch instead of a
    broken render.
- **Gentle AI (optional, yours)** — with your own Gemini key:
  - *Summarize this file* — short, plain-language summaries built for
    re-reading (cached per file version).
  - *Ask about this file* — Q&A grounded strictly in the document's text.
  - *Ask across all my notes* — pulls the most relevant excerpts and
    answers with links back to the source files.
  - Extracted text is cached offline (IndexedDB, keyed by file ID + modified
    time), so re-opening a file is instant and free. Gemini is only ever
    called on explicit action — never on page load.
- **Instant search** across every file and folder name (debounced, client-side).

## The key-handling model (please read)

This is a **static site — there is no SynapseMed server**. That means:

- Your **Gemini API key** is pasted once on the connect screen and stored
  *only in this browser's localStorage*. It is sent nowhere except Google's
  Generative Language API (`generativelanguage.googleapis.com`). A
  **Clear key** button lives in Settings at all times.
- **Google Drive** is accessed through Google sign-in (OAuth) with the
  read-only `drive.readonly` scope. SynapseMed can never upload, modify, or
  delete anything. Sign out & reset in Settings wipes every trace from the browser.
- A **web OAuth client ID is not a secret** — it only identifies the app to
  Google — so baking it in (see below) or committing it is safe. API *keys*
  and *client secrets* must never be committed, and this app doesn't use them.
- Folder listings and extracted text are cached **only in your browser**
  (localStorage / IndexedDB) for speed — never on any server.

## Setup (about 10 minutes)

### 1. Create a Google OAuth client ID

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   create a project (e.g. `synapsemed`), or reuse any existing one.
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen**:
   - User type **External**, app name anything (e.g. "SynapseMed"), your email
     for the contact fields. No logo needed.
   - Scopes: add `.../auth/drive.readonly`.
   - Test users: add **your own Gmail address** (while in "Testing", only these
     users can sign in — perfect for a personal app).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `https://<your-github-username>.github.io`
     - `http://localhost:5173` (for local development)
5. Copy the client ID (`…apps.googleusercontent.com`).

> The "Google hasn't verified this app" warning on first sign-in is normal for
> unverified personal apps — click through (you're the app owner).

### 2. Get a Gemini API key (optional)

1. Go to [aistudio.google.com](https://aistudio.google.com) → **Get API key**
   → create one in the same (or any) project.
2. You'll paste it into the app once — it stays in your browser only.

### 3. Deploy to GitHub Pages

1. Push this repo to GitHub, then in the repo go to
   **Settings → Pages → Source: GitHub Actions** (the workflow in
   `.github/workflows/deploy.yml` does the rest on every push to `main`).
2. Optional convenience: **Settings → Secrets and variables → Actions →
   Variables** → add `VITE_GOOGLE_CLIENT_ID` with your client ID, so the
   connect screen comes prefilled. (It is not a secret; an Actions *variable*
   is used on purpose.) If you skip this, the app just asks for the client ID
   once and remembers it in your browser.
3. Open `https://<your-github-username>.github.io/<repo-name>/`, sign in with
   Google, pick your study-notes folder, and read.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
npm run preview    # serve the production build locally
```

You can also create a `.env` file for local dev (it is gitignored):

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

## Stack

Plain **Vite + vanilla JS** — no framework, no UI kit, hand-written CSS
(Fraunces display serif + Manrope UI sans on an ink-navy palette with one
teal-mint accent). Heavy libraries (pdf.js, mammoth) are code-split and load
only when their file type is opened; the app shell is ~19 KB gzipped.

- Google Identity Services for OAuth, Drive v3 REST for data
- pdf.js (virtualized canvas rendering), mammoth.js (DOCX → HTML)
- Gemini via the Generative Language REST API

## Notes & known limits

- **Slides previews stay blank?** Some browsers block Google's embedded
  sign-in inside cross-origin iframes (third-party cookie restrictions).
  The viewer shows an "Open in Drive" fallback for exactly this case.
- **Sign-in lasts about an hour** (Google's token lifetime). The app refreshes
  tokens silently while it can; otherwise it will ask you to sign in again.
- Scanned PDFs without a text layer can't be summarized (they still display
  fine) — there is simply no text to read back.
