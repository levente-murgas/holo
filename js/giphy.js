// GIPHY search for the GIF and Sticker holograms. A GIF comes as an MP4 (GIPHY makes one for every GIF), so it
// plays through the same video pipeline as a clip. A sticker comes as the GIF itself, because only the GIF keeps
// its transparent background (js/sticker.js plays it).

import { GIPHY_KEY } from './config.js';

export const isGiphyConfigured = () => !!GIPHY_KEY;

/** One page of results, trending when the query is empty. kind: gifs | stickers.
 *  -> { items: [{ id, title, thumb, mp4, gif }], next } */
export async function searchGifs(query, offset = 0, limit = 24, kind = 'gifs') {
  const q = (query || '').trim();
  const params = new URLSearchParams({ api_key: GIPHY_KEY, limit: String(limit), offset: String(offset), rating: 'pg-13' });
  if (q) params.set('q', q);
  const res = await fetch('https://api.giphy.com/v1/' + kind + '/' + (q ? 'search' : 'trending') + '?' + params);
  if (!res.ok) throw new Error('GIPHY answered ' + res.status);
  const { data, pagination } = await res.json();
  const items = data.map(kind === 'stickers' ? toSticker : toItem).filter(Boolean);
  const total = pagination ? pagination.total_count : 0;
  const next = offset + data.length < total ? offset + data.length : null;
  return { items, next };
}

export function toItem(g) {
  const im = g.images || {};
  const mp4 = (im.original_mp4 && im.original_mp4.mp4) || (im.original && im.original.mp4) || (im.fixed_height && im.fixed_height.mp4);
  const t = im.fixed_width_small || im.fixed_width || im.original || {};
  const thumb = t.webp || t.url;
  if (!mp4 || !thumb) return null;
  return { id: g.id, title: (g.title || '').replace(/\s+GIF.*$/i, '') || 'GIF', thumb, mp4 };
}

// The original GIF (transparent), or a smaller rendition when the original is very large.
const MAX_STICKER_BYTES = 8 * 1024 * 1024;
export function toSticker(g) {
  const im = g.images || {};
  const t = im.fixed_width_small || im.fixed_width || im.original || {};
  const big = im.original && +im.original.size > MAX_STICKER_BYTES;
  const gif = (!big && im.original && im.original.url) || (im.fixed_height && im.fixed_height.url) || (im.original && im.original.url);
  const thumb = t.webp || t.url;
  if (!gif || !thumb) return null;
  return { id: g.id, title: (g.title || '').replace(/\s+Sticker.*$/i, '') || 'Sticker', thumb, gif };
}

/** A sticker's GIF as a File, to play and to send. */
export async function fetchStickerFile(item) {
  const res = await fetch(item.gif);
  if (!res.ok) throw new Error('Could not load the sticker (' + res.status + ')');
  const blob = await res.blob();
  return new File([blob], 'giphy-' + item.id + '.gif', { type: 'image/gif' });
}

/** The GIF's MP4 as a File, to play and to send. */
export async function fetchGifFile(item) {
  const res = await fetch(item.mp4);
  if (!res.ok) throw new Error('Could not load the GIF (' + res.status + ')');
  const blob = await res.blob();
  return new File([blob], 'giphy-' + item.id + '.mp4', { type: 'video/mp4' });
}
