# Holo gift: project handoff

A long-distance gift for Levente's partner: a phone "hologram". A phone lies flat under a 3D-printed stand that holds a CD case pane at an angle (Pepper's ghost). Each of them gets one stand and uses their own phone as the display. You send each other short holo video clips, with live holo calls planned later.

## Decisions so far
- **Phones only, no dedicated hardware.** Pi/ESP32 options were looked at and dropped because of cost.
- **Stand:** MakerWorld "Hologram Projector from a CD Case (Fat & Slim)": https://makerworld.com/en/models/834578. Print two, one per person. It's a single angled pane, not a 4-sided pyramid. Orientation (rotate/mirror) is set using the test pattern in the page.
- **One web page for everything.** No native app. It runs in Safari/Chrome on both phones, so no Apple developer account is needed and it works on Android too.
- **Video first, live calls later.** The MVP is recorded clips; live calls come once that works.
- **Internet holo videos are part of the MVP.** The user picks the video type (no auto-detection): *My recording*, *Holo · 1 view* or *Holo · 4 views*. Holo-ready videos keep the brightness cut (compressed "black" is often dark grey and would glow) but skip the face oval. For 4-view pyramid videos, one view is cropped out and shown on the single pane.
- **No build step.** Plain ES modules loaded by the browser; tests use Node's built-in runner, no dependencies.
- **Inbox on Supabase, two members only.** Clips go to a private Storage bucket, messages to a Postgres table; the open page gets new ones via Realtime and catches up with a query on open (subscribe first, then fetch, de-duplicated). Sign-in is by emailed magic link with sign-ups disabled; RLS restricts everything to users in a `members` allow-list. The page and its publishable key are public by design.
- **Hosting stays on GitHub Pages (2026-11-12).** Checked against a future UI upgrade (Valet's stack: React, Tailwind, Radix, etc.): all of it builds to static files. Vercel would only replace page hosting, not Supabase (no Realtime or Auth), so there is no reason to move. A UI upgrade means adding a build step (e.g. Vite) and publishing `dist/` from the workflow.
- **Learning mode paused (2026-11-09):** the user switched to shipping mode; the inbox design below was made by Claude, not reasoned through by the user.

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
js/pwa.js             service worker registration, isInstalled(), screen wake lock
sw.js                 service worker: network-first for own files, cached copy when offline
manifest.webmanifest  app name, icons, full-screen display
icons/                icon.svg (source) + PNGs rendered from it with headless Chrome
js/push.js            push on this device: permission, subscribe, save/remove the subscription
js/push-logic.js      pure helpers: keyToBytes, subscriptionRow, pushStatus, shouldAsk
js/surprise.js        Surprise mode: instruction overlay until the phone is face down (deviceorientation)
js/surprise-logic.js  pure helpers: isFaceDown (with hysteresis), isSurprise
js/setup.js           first-time setup screen (welcome, install, sign in, notifications, stand, Surprise mode, done)
js/setup-logic.js     pure helpers: STEPS, shouldShow, nextStep, platformOf
js/orientation.js     watchFaceDown() + motion permission, shared by Surprise mode and calls
js/call.js            call engine: WebRTC + signaling over private Realtime Broadcast 'holo-call', per-device addressing
js/call-logic.js      pure call state machine (idle/outgoing/incoming/connecting/active/ended), replyTo, formatDuration
js/call-ui.js         Call button, ringing/in-call screen, callHologram() for main.js
supabase/functions/turn/  Edge Function: short-lived Cloudflare TURN credentials (falls back to STUN)
tests/browser/call-loopback.html  two call engines + fake channel in one page (headless Chrome with fake camera)
js/settings-ui.js     Settings page (⚙︎ in the panel header: notifications, account/sign out) + one-time notifications dialog
supabase/config.toml  Supabase CLI project config (from `supabase init`); [functions.notify] verify_jwt = false
supabase/migrations/  CLI migrations (push_subscriptions); schema.sql was applied by hand and is not a migration
supabase/functions/notify/  Edge Function: sends web push to the recipient's devices (npm:web-push for encryption, fetch to send)
js/config.js          Supabase URL + publishable key (empty = sending off)
js/inbox.js           Supabase client: sign-in, send, live receive + catch-up, download, mark seen
js/inbox-logic.js     pure helpers: clipPath, mergeMessages, unseenCount, partnerOf, timeAgo
js/inbox-ui.js        Inbox panel: sign-in form, Send button, message list, playing a message
supabase/schema.sql   members, messages, RLS policies, Realtime publication, private 'clips' bucket
SETUP.md              one-time Supabase setup steps
tests/*.test.js       node:test tests for crop/cut maths and inbox helpers
package.json          `npm test`, `npm run serve` (no dependencies)
.nojekyll             tells GitHub Pages to publish files as-is
```

- Modes: **Test pattern** (orientation setup), **Video** (pick or record a clip), **Message** (glowing heart plus text).
- Video types: *My recording* uses a luminance key (threshold plus soft edge) with an elliptical face mask; *Holo · 1 view* and *Holo · 4 views* use the key only, with their own saved cut settings (default 0.05 / 0.06). *Holo · 4 views* crops one edge cell of a 3x3 grid inside the centred square (Bottom/Top/Left/Right picker) and rotates it upright, assuming each figure's head points to the centre of the cross.
- Processing runs on a 540px canvas every frame, then a brightness boost.
- Layouts: single pane (CD case) and 4-sided pyramid. Controls for rotate, mirror, size and position. Settings are saved in localStorage.
- **Running locally:** `npm run serve`, then open http://localhost:8000. Opening `index.html` directly (file://) doesn't work because browsers block modules there.
- **Inbox:** sign in by email link, then *Send* sends the loaded video (with its video type/view) or the message text to the partner. Messages list shows sent and received, unseen highlighted; tapping one downloads and plays it. supabase-js 2.118.0 is loaded from jsDelivr only when `js/config.js` is filled in. A failed sign-in link (`#error=...` in the URL, e.g. `otp_expired`) is shown under Inbox and stripped from the address (`authErrorFromUrl` in `js/inbox.js`).

## Supabase: live (set up 2026-11-12)
- Project `lyvdwzokcyathfebfgch`; URL and publishable key are in `js/config.js` (public by design, RLS does the protecting). The secret key (`sb_secret_...`) must never be committed; `.env` is git-ignored for local use.
- Schema from `supabase/schema.sql` is applied; sign-ups disabled; both users and their `members` rows exist; redirect URL is `https://levente-murgas.github.io/holo/`.
- Levente is signed in on laptop (Chrome) and phone. The partner has not signed in yet.
- **Email limits:** Supabase's built-in sender allows only a few emails per hour per project ("email rate limit exceeded"). The user reports custom SMTP is now configured (Authentication → Emails → SMTP Settings), which lifts that.
- **Magic links are single-use and expire (~1 h);** requesting a new one cancels older ones. Email scanners that pre-open links cause `otp_expired`. Code sign-in is built (`verifyCode` → `verifyOtp({ email, token, type: 'email' })`; the code box appears after requesting a link) and avoids both scanners and the iPhone app/Safari storage split, but it needs `{{ .Token }}` in the Magic Link email template (SETUP.md step 9).
- **Sign-in without email (admin fallback):** run in a normal Terminal (not Claude Code's `!`, which can't read input), with the secret key:
  ```
  read -rs "KEY?Secret key: " && echo && curl -s -X POST "https://lyvdwzokcyathfebfgch.supabase.co/auth/v1/admin/generate_link" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{"type":"magiclink","email":"<EMAIL>","redirect_to":"https://levente-murgas.github.io/holo/"}' | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("action_link") or d, end="")' | pbcopy; unset KEY
  ```
  It copies a one-time sign-in link; open it once in the browser to sign in. Parse the JSON (as above): copying the raw `action_link` keeps `&` instead of `&` and fails with "Verify requires a verification type".
- **Tests:** `npm test` (Node 24): 34 passing, covering crop geometry, the brightness cut ramp, inbox helpers (clip paths, merge/de-dup of live vs fetched messages, unseen count, partner lookup, time labels) and push helpers (key decoding, subscription rows, status, when to ask) and Surprise mode (face-down detection, which messages) setup step order and the call state machine.
- **Verified so far:** headless Chrome renders all four views of a synthetic 4-view video upright with the grey background cut to black; test pattern and message render; no JS errors.
- **Limitations:** sign-in verified on two devices, but sending/receiving between two different accounts (live Realtime delivery to the recipient) is not yet tested; no push notifications; old clips are never deleted; no depth sensor (web pages can't access Face ID/TrueDepth); not yet tested on a real phone, the real stand or a real internet holo video; the file picker hasn't been tested end to end (headless Chrome couldn't load a picked file).

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
3. Inbox testing: send a text and a clip from the laptop, reload on the phone and play the sent clip (checks upload, RLS and playback across devices). Live delivery can only be tested once the partner signs in; delete test rows in Table Editor → `messages` beforehand if you don't want them in the partner's inbox.
4. PWA (built 2026-11-12, verified in headless Chrome: service worker active, 19 files cached, no installability errors; not yet installed on a real phone): add `{{ .Token }}` to the Magic Link email template (SETUP.md step 9), install on both phones, sign in inside the app with the code, check full screen and that the screen stays awake. When files are added, add them to `SHELL` in `sw.js`; bump `CACHE` only to force-drop old copies.
5. Push notifications: live and verified on Levente's phone (2026-11-12): migration pushed, VAPID secrets set, `notify` deployed with the CLI. Design: after sending, the page calls `notify` with the message id (no database trigger); the function checks the caller is the sender, reads the recipient's `push_subscriptions` with the secret key, sends, and deletes subscriptions that return 404/410. The dialog shows once per device (`localStorage holo.pushAsked`); "Not now" leaves it in Settings only. Sign-out removes this device's subscription row. Verified: web-push encryption under Deno 2 (decrypted round trip), function type-checks, dialog/settings flow in headless Chrome; not yet on a real phone.
6. Surprise mode (built 2026-11-12, Settings toggle, saved per device in `S.surprise`): a received message opened from the inbox stays behind a full-screen instruction until the phone has been face down (|beta| > 150° for 0.7 s), then the clip starts from the beginning (falls back to muted if the browser refuses sound). "Show it now" for no sensor / no motion permission; "Later" puts it away. A second toggle, "Also for messages I sent" (`S.surpriseOwn`, shown only while Surprise mode is on), applies it to your own messages too, for testing alone. The user says the phone sits **face down** in the stand. Verified in headless Chrome and on Levente's phone in the stand (2026-11-12).
7. First-time setup screen (built 2026-11-12): shown once per device (`localStorage holo.setupDone`; the installed iPhone app has its own storage, so the setup continues there after Add to Home Screen), re-runnable from Settings. Steps already done are skipped (`nextStep` decides at each move); sign-in by code advances on its own; Android gets a one-tap Install via `beforeinstallprompt`; the post-sign-in notifications dialog is suppressed while the setup runs. Verified in headless Chrome at phone size (full walk-through, peek on the stand step, stays closed after reload); not yet on a real phone or by the partner.
8. Clip clean-up (storage is 1 GB).
9. Live calls (built 2026-11-12, needs the SETUP.md "Live calls" steps before the page is pushed). Decisions (user): **take turns** for video (a face-down phone's front camera only sees the inside of the stand), Cloudflare TURN now, ring by push + in-app. How it works: audio both ways always; held phone = call screen and sends its camera; face down (≥0.7 s) = sends no video (`track.enabled = false`), tells the other side (`stand` message) and shows the partner as a hologram through the normal 'rec' processing (or "<name> is listening ♥" if they are in their stand too). Caller repeats `ring` every 2 s for 45 s so a phone opened from the notification still catches it. Each message carries the sending device; after accept, messages are addressed `to` one device, so a second open device stops ringing ("Answered on another device"). Settings → "Test calls between my own devices" (`S.callSelf`) for testing alone. Verified: state machine tests; two engines + fake channel + fake camera in headless Chrome connect over real WebRTC, ring both callee devices, stop the second, disable video in the stand, hang up. Not yet on real phones / real Supabase channel / TURN.

## Effort estimates (from the original chat)
- Inbox and syncing: about 8–15 hours.
- Live calls: about 25–40 hours on top of that.
