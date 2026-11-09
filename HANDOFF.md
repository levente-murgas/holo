# Holo gift: project handoff

A long-distance gift for Levente's partner: a phone "hologram". A phone lies flat under a 3D-printed stand that holds a CD case pane at an angle (Pepper's ghost). Each of them gets one stand and uses their own phone as the display. You send each other short holo video clips, with live holo calls planned later.

## Decisions so far
- **Phones only, no dedicated hardware.** Pi/ESP32 options were looked at and dropped because of cost.
- **Stand:** MakerWorld "Hologram Projector from a CD Case (Fat & Slim)": https://makerworld.com/en/models/834578. Print two, one per person. It's a single angled pane, not a 4-sided pyramid. Orientation (rotate/mirror) is set using the test pattern in the page.
- **One web page for everything.** No native app. It runs in Safari/Chrome on both phones, so no Apple developer account is needed and it works on Android too.
- **Video first, live calls later.** The MVP is recorded clips; live calls come once that works.
- **Internet holo videos are part of the MVP.** The user picks the video type (no auto-detection): *My recording*, *Holo · 1 view* or *Holo · 4 views*. Holo-ready videos keep the brightness cut (compressed "black" is often dark grey and would glow) but skip the face oval. For 4-view pyramid videos, one view is cropped out and shown on the single pane.
- **No build step.** Plain ES modules loaded by the browser; tests use Node's built-in runner, no dependencies.

## Repository
- GitHub: https://github.com/levente-murgas/holo (public), branch `main`.
- `.vibe-wise/` (local learning notes) is git-ignored.
- **Live page:** https://levente-murgas.github.io/holo/ (GitHub Pages, source: GitHub Actions).
- **CI/CD:** `.github/workflows/deploy.yml`. Every push and pull request runs `npm test` (Node 24). On `main`, the `deploy` job runs only if tests pass (`needs: test`) and publishes the whole repo as-is. Pull requests are test-only. Manual redeploy: Actions tab → "Test and deploy" → Run workflow.
- Every push to `main` that passes the tests goes live on both phones within about a minute; the tests only cover crop and cut maths, so UI breakage can still ship.

## Current state: MVP page
Code layout:

```
index.html            markup only, loads styles.css and js/main.js
styles.css            styles
js/main.js            entry point: loads settings, sets up screen + controls, runs the frame loop
js/settings.js        defaults, localStorage load/save, isHolo(), keyFor()
js/processing.js      pure maths: cropRect(), cutAlpha(), smoothstep(), ovalMask()
                      + createProcessor(): the canvas part that uses them
js/sources.js         video element + file loading, test pattern, message card
js/layout.js          stage canvas, single-pane / pyramid drawing
js/ui.js              panel, sliders, buttons, file picker, fullscreen
tests/processing.test.js   node:test tests for cropRect and cutAlpha
package.json          `npm test`, `npm run serve` (no dependencies)
.nojekyll             tells GitHub Pages to publish files as-is
```

- Modes: **Test pattern** (orientation setup), **Video** (pick or record a clip), **Message** (glowing heart plus text).
- Video types: *My recording* uses a luminance key (threshold plus soft edge) with an elliptical face mask; *Holo · 1 view* and *Holo · 4 views* use the key only, with their own saved cut settings (default 0.05 / 0.06). *Holo · 4 views* crops one edge cell of a 3x3 grid inside the centred square (Bottom/Top/Left/Right picker) and rotates it upright, assuming each figure's head points to the centre of the cross.
- Processing runs on a 540px canvas every frame, then a brightness boost.
- Layouts: single pane (CD case) and 4-sided pyramid. Controls for rotate, mirror, size and position. Settings are saved in localStorage.
- **Running locally:** `npm run serve`, then open http://localhost:8000. Opening `index.html` directly (file://) doesn't work because browsers block modules there.
- **Tests:** `npm test` (Node 24): 9 passing, covering crop geometry for square/16:9/portrait videos and the brightness cut ramp.
- **Verified so far:** headless Chrome renders all four views of a synthetic 4-view video upright with the grey background cut to black; test pattern and message render; no JS errors.
- **Limitations:** no sending (clips stay on the device); no depth sensor (web pages can't access Face ID/TrueDepth); not yet tested on a real phone, the real stand or a real internet holo video; the file picker hasn't been tested end to end (headless Chrome couldn't load a picked file).

## Target architecture (phone-only, proposed in the original chat)
- **GitHub Pages:** hosts the page (static, free, public HTTPS URL). Serves any static files but runs no server code, so all processing happens in the phone's browser.
- **Supabase (free tier):**
  - Storage bucket: raw video clips (background removal happens on the viewing phone, so only raw clips are stored)
  - Postgres `messages` table: inbox (id, sender, recipient, clip path, text, created_at, seen)
  - Realtime: pushes new messages to the other phone while the page is open
  - Later: WebRTC signaling for live calls, plus an Edge Function that issues short-lived Cloudflare TURN credentials (the API key never goes in the page)
- **Cloudflare Realtime TURN/STUN (later, for live calls):** STUN at stun.cloudflare.com is free; TURN is free up to 1,000 GB/month. Needed when a direct connection fails (e.g. eduroam at IST Lisbon).
- **Two users only:** simple auth (Supabase magic link or two fixed accounts), with row-level security so each person sees only messages to or from them.
- If heavier background removal is ever needed: in-browser ML (e.g. MediaPipe segmentation, OpenCV.js) still works on GitHub Pages; iPhone depth/infrared would need a native app.

## Next steps
1. Open https://levente-murgas.github.io/holo/ on both phones.
2. Test on both phones with the printed stand: tune defaults (rotation, mirror, key threshold), try a real internet holo video (1-view and 4-view) and confirm which view convention it uses.
3. Supabase: create the project, storage bucket, `messages` table, RLS policies and auth for two users.
4. Add an inbox to the page: record → upload → notify; the other phone gets a list of received clips and plays them in holo mode.
5. Optional: make it a PWA (add to home screen, full-screen, keep the screen awake).
6. Later: live holo calls with WebRTC, using Supabase Realtime for signaling and Cloudflare TURN.

## Effort estimates (from the original chat)
- Inbox and syncing: about 8–15 hours.
- Live calls: about 25–40 hours on top of that.
