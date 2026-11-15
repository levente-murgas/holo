// How words look on the stage: a few typefaces (like a story's text styles) and a colour. Pure data and helpers,
// so the stage, the controls and the tests share them. The faces themselves are loaded in src/styles.css.

export const INK = '#f2dcae';   // the warm default, the controls' brass lit up

// scale: each face at the same visual size (Pacifico and Archivo Black run large, Bebas Neue small).
// lh: line height as a share of the size.
export const FONTS = {
  classic: { label: 'Classic', family: '"Geist Variable", -apple-system, Helvetica, Arial, sans-serif', weight: 500, scale: 1, lh: 1.16 },
  serif: { label: 'Serif', family: '"Playfair Display Variable", Georgia, serif', weight: 500, scale: 1, lh: 1.2 },
  typewriter: { label: 'Typewriter', family: '"Courier Prime", "Courier New", monospace', weight: 400, scale: 0.95, lh: 1.2 },
  script: { label: 'Script', family: 'Pacifico, cursive', weight: 400, scale: 0.82, lh: 1.5 },
  strong: { label: 'Strong', family: '"Archivo Black", Impact, sans-serif', weight: 400, scale: 0.84, lh: 1.2 },
  modern: { label: 'Modern', family: '"Bebas Neue", Impact, sans-serif', weight: 400, scale: 1.2, lh: 1 },
};

// Colours that glow well in the reflection (black is invisible there, so no dark ones).
export const COLORS = ['#f2dcae', '#ffffff', '#ff5fa2', '#ff4d4d', '#ff9f43', '#ffe066', '#7bed9f', '#4dd8ff', '#6c8cff', '#c38bff'];

const HEX = /^#[0-9a-f]{6}$/i;

/** A style from anywhere (settings, a received message) made safe: unknown fonts and colours fall back. */
export function cleanStyle(st) {
  const font = st && FONTS[st.font] ? st.font : 'classic';
  const color = st && HEX.test(st.color || '') ? st.color.toLowerCase() : INK;
  return { font, color };
}

// The message and the countdown each keep their own look in the settings.
export const STYLE_KEYS = { message: { font: 'font', color: 'color' }, countdown: { font: 'cdFont', color: 'cdColor' } };

/** The look of one kind (message | countdown) from the settings. */
export function styleOf(s, kind) {
  const k = STYLE_KEYS[kind];
  return cleanStyle({ font: s[k.font], color: s[k.color] });
}

/** Settings patch that gives a kind this look. */
export function stylePatch(kind, st) {
  const k = STYLE_KEYS[kind], { font, color } = cleanStyle(st);
  return { [k.font]: font, [k.color]: color };
}

/** The canvas font string for a face at a size in px. */
export function fontCss(key, px) {
  const f = FONTS[key] || FONTS.classic;
  return f.weight + ' ' + Math.round(px * f.scale) + 'px ' + f.family;
}

/** Whole days from today to a 'YYYY-MM-DD' date, both in local time; null when the date isn't valid. */
export function daysUntil(date, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!m) return null;
  const then = new Date(+m[1], +m[2] - 1, +m[3]);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((then - today) / 86400000);   // round: a daylight-saving day is 23 or 25 hours
}

/** What the countdown says: a big line and a small one. */
export function countdownLines(n) {
  if (n === null) return { big: '?', small: 'pick a date' };
  if (n > 1) return { big: String(n), small: 'days until we meet' };
  if (n === 1) return { big: '1', small: 'day until we meet' };
  if (n === 0) return { big: 'Today', small: 'we meet' };
  return { big: 'See you', small: 'soon' };
}
