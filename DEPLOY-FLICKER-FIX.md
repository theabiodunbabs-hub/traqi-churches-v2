# Flicker fix: how to put it live

No database changes.

## 1. Upload to GitHub
Replace these with the ones in this zip:
- the `src` folder
- the `public` folder (it has the new `sw.js`)
- `next.config.mjs`
- `package.json` and `package-lock.json`

## 2. Let Vercel deploy, then check
- Open Traqi in a browser where it used to flicker. The first visit after the update installs the fixed version
  and clears the old saved files; from the next page load it behaves.
- If one browser still misbehaves after two refreshes: open the site, then in Chrome press F12 › Application ›
  Service workers › Unregister, and refresh. (Rarely needed.)

## What changed
- The offline helper (service worker) no longer stores or serves the app's own files, only whole pages for offline use.
- The app loads your church once at a time instead of twice in a race.
- Signed in but still loading? The app waits instead of bouncing between Home and Log in.
- A dropped connection keeps your last saved copy on screen with a message, instead of signing you out.
- Your church's colours paint first, instead of flashing the default purple then switching.
