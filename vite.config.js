// Build: React + Tailwind, published as static files to GitHub Pages (dist/).
// base './' keeps every URL relative, so the same build works at levente-murgas.github.io/holo/ and on localhost.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

// The service worker caches the app shell for offline use. Vite gives the built files hashed names,
// so the list can't be written by hand: after the build, put the real file names and a build id into dist/sw.js.
// The build id changes on every deploy, which is how phones notice a new version (js/pwa.js).
function serviceWorkerShell() {
  let outDir = 'dist';
  return {
    name: 'holo-sw-shell',
    apply: 'build',
    configResolved(c) { outDir = resolve(c.root, c.build.outDir); },
    closeBundle() {
      const files = walk(outDir)
        .map((f) => relative(outDir, f).split(sep).join('/'))
        .filter((f) => f !== 'sw.js' && !f.endsWith('.map'))
        .filter((f) => !f.endsWith('.woff2') || f.includes('latin'));   // fonts: only the subsets this page uses
      const build = (process.env.GITHUB_SHA || '').slice(0, 12) || 'local-' + Date.now().toString(36);
      const sw = join(outDir, 'sw.js');
      const src = readFileSync(sw, 'utf8')
        .replace("const BUILD = '__BUILD__'", 'const BUILD = ' + JSON.stringify(build))
        .replace("const SHELL = ['__SHELL__']", 'const SHELL = ' + JSON.stringify(['./', ...files]));
      writeFileSync(sw, src);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), serviceWorkerShell()],
  server: { port: 8000, strictPort: true },    // http://localhost:8000/ is an allowed Supabase redirect URL
  preview: { port: 8000, strictPort: true },
});
