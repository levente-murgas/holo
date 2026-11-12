// First-time setup: which steps to show, in which order (pure, tested in Node).

export const STEPS = ['welcome', 'install', 'signin', 'notify', 'stand', 'surprise', 'done'];

// ctx: { phone, installed, configured, signedIn, push }  push: 'on' | 'off' | 'blocked' | 'unsupported'
export function shouldShow(step, ctx) {
  switch (step) {
    case 'install': return !!(ctx.phone && !ctx.installed);   // laptops don't need the home-screen app
    case 'signin': return !!(ctx.configured && !ctx.signedIn);
    case 'notify': return !!(ctx.configured && ctx.push === 'off');
    default: return true;
  }
}

// The step after `from` (or the first one) that applies right now. Decided at each move, because
// signing in or installing changes what is left to do.
export function nextStep(from, ctx) {
  for (let i = from ? STEPS.indexOf(from) + 1 : 0; i < STEPS.length; i++) {
    if (shouldShow(STEPS[i], ctx)) return STEPS[i];
  }
  return null;
}

// Rough platform for the install instructions.
export function platformOf(ua = '', touchPoints = 0) {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}
