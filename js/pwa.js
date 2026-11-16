// App install support: registers the service worker and keeps the screen awake while the page is visible.

// True when opened from the home-screen icon rather than a browser tab.
export const isInstalled = () =>
  matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;

// Android Chrome offers a one-tap install; keep its prompt for the setup screen's Install button.
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
export const canPromptInstall = () => !!installPrompt;
export async function promptInstall() {
  if (!installPrompt) return false;
  installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  installPrompt = null;
  return outcome === 'accepted';
}

// Something that must not be interrupted by an update reload (a call in progress).
let busy = () => false;
export function setBusyCheck(fn) { busy = fn; }

export function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(watchForUpdates).catch(() => { /* page still works without it */ });
  }
  keepAwake();
}

// The installed app is often resumed from memory instead of reloaded, so it would keep running an
// old version. Each deploy changes sw.js (the build id), so: when Holo comes to the front, ask the
// browser to check sw.js; when a new version takes over, reload once (later, if a call is on).
// But on a fresh launch the page was just fetched from the network, so it's usually the new build already;
// reloading then only flashes the screen twice (and on iPhone could leave the app a size too short). Ask the new
// worker its build and reload only when it differs from the one running.
const RUNNING = typeof __HOLO_BUILD__ === 'string' ? __HOLO_BUILD__ : '';

function workerBuild(sw) {
  return new Promise((done) => {
    const ch = new MessageChannel();
    const t = setTimeout(() => done(null), 1500);   // no answer: assume it's different
    ch.port1.onmessage = (e) => { clearTimeout(t); done(e.data); };
    try { sw.postMessage('build', [ch.port2]); } catch (_) { clearTimeout(t); done(null); }
  });
}

function watchForUpdates(reg) {
  const hadController = !!navigator.serviceWorker.controller;
  let pending = false;
  const reloadIfFree = () => { if (!busy()) location.reload(); else pending = true; };
  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    if (!hadController) return;
    const sw = navigator.serviceWorker.controller;
    if (RUNNING && sw && (await workerBuild(sw)) === RUNNING) return;   // already the newest: nothing to reload
    reloadIfFree();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (pending) reloadIfFree();
    reg.update().catch(() => {});
  });
}

// The phone is a display under the stand, so it must not dim or lock. The browser drops the
// lock whenever the page is hidden, so ask again each time it becomes visible.
function keepAwake() {
  if (!('wakeLock' in navigator)) return;
  const request = () => {
    if (document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').catch(() => { /* e.g. low battery mode: ignore */ });
  };
  document.addEventListener('visibilitychange', request);
  request();
}
