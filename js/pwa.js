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

export function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* page still works without it */ });
  }
  keepAwake();
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
