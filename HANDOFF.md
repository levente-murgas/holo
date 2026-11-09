# Holo gift: project handoff

A long-distance gift for Levente's partner: a phone "hologram". A phone lies flat under a 3D-printed stand that holds a CD case pane at an angle (Pepper's ghost). Each of them gets one stand and uses their own phone as the display. You send each other short holo video clips, with live holo calls planned later.

## Decisions so far
- **Phones only, no dedicated hardware.** Pi/ESP32 options were looked at and dropped because of cost.
- **Stand:** MakerWorld "Hologram Projector from a CD Case (Fat & Slim)": https://makerworld.com/en/models/834578. Print two, one per person. It's a single angled pane, not a 4-sided pyramid. Orientation (rotate/mirror) is set using the test pattern in the page.
- **One web page for everything.** No native app. It runs in Safari/Chrome on both phones, so no Apple developer account is needed and it works on Android too.
- **Video first, live calls later.** The MVP is recorded clips; live calls come once that works.

## Current state: MVP page (`index.html`)
A self-contained HTML page, no dependencies. It's saved alongside this doc in the project as `holo/index.html`.
- Modes: **Test pattern** (orientation setup), **Video** (pick or record a clip), **Message** (glowing heart plus text).
- Background removal is a luminance key (threshold plus soft edge) with an elliptical face mask and a brightness boost, processed on a 540p canvas every frame.
- Layouts: single pane (CD case) and 4-sided pyramid. Controls for rotate, mirror, size and position. Settings are saved in localStorage.
- Limitations: no sending (the clip stays on the device), no depth sensor (web pages can't access Face ID/TrueDepth), not yet tested on a real phone.
- It was published as a private claude.ai artifact, but the artifact sandbox blocks the camera and WebRTC, so the page needs real hosting.

## Target architecture (phone-only)
- **GitHub Pages:** hosts the page (static, free, public HTTPS URL).
- **Supabase (free tier):**
  - Storage bucket: raw video clips (background removal happens on the viewing phone, so only raw clips are stored)
  - Postgres `messages` table: inbox (id, sender, recipient, clip path, text, created_at, seen)
  - Realtime: pushes new messages to the other phone while the page is open
  - Later: WebRTC signaling for live calls, plus an Edge Function that issues short-lived Cloudflare TURN credentials (the API key never goes in the page)
- **Cloudflare Realtime TURN/STUN (later, for live calls):** STUN at stun.cloudflare.com is free; TURN is free up to 1,000 GB/month. Needed when a direct connection fails (e.g. eduroam at IST Lisbon).
- **Two users only:** simple auth (Supabase magic link or two fixed accounts), with row-level security so each person sees only messages to or from them.

## Next steps
1. Test the MVP page on both phones with the printed stand. Tune the defaults (rotation, mirror, key threshold).
2. Put the page in a GitHub repo and enable GitHub Pages.
3. Supabase: create the project, storage bucket, `messages` table, RLS policies and auth for two users.
4. Add an inbox to the page: record → upload → notify; the other phone gets a list of received clips and plays them in holo mode.
5. Optional: make it a PWA (add to home screen, full-screen, keep the screen awake).
6. Later: live holo calls with WebRTC, using Supabase Realtime for signaling and Cloudflare TURN.

## Effort estimates (from the chat)
- Inbox and syncing: about 8–15 hours.
- Live calls: about 25–40 hours on top of that.
