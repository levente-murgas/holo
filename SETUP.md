# Supabase setup (one time, about 15 minutes)

The page works without this; the Inbox just says "Sending is not set up yet". These steps turn on sending.

1. **Create a project** at https://supabase.com (free tier). Pick a region close to you both (e.g. Frankfurt). Save the database password somewhere, but it's not needed by the page.
2. **Create the tables, bucket and security rules:** open *SQL Editor*, paste the whole of `supabase/schema.sql`, click *Run*.
3. **Block strangers from signing up:** *Authentication → Sign In / Providers* → turn off **Allow new users to sign up**.
4. **Create your two accounts:** *Authentication → Users → Add user → Create new user*. Enter each email, tick **Auto confirm user**. A password isn't needed: the page signs in by emailed link.
5. **Put both of you on the members list:** in *SQL Editor*, run (with your real emails and names):
   ```sql
   insert into public.members (user_id, name)
   select id, 'Levente' from auth.users where email = 'you@example.com'
   union all
   select id, 'Partner' from auth.users where email = 'partner@example.com';
   ```
   The name is what the page shows ("Send this video to Partner").
6. **Allow the sign-in link to return to the page:** *Authentication → URL Configuration*:
   - Site URL: `https://levente-murgas.github.io/holo/`
   - Redirect URLs: add `https://levente-murgas.github.io/holo/` and `http://localhost:8000/`
7. **Connect the page:** *Project Settings → API Keys* (and *Data API* for the URL). Copy the **Project URL** and the **publishable** key (`sb_publishable_…`, or the legacy `anon` key) into `js/config.js`. Both are safe to commit: the RLS rules from step 2 do the protecting. **Never** put the `secret` / `service_role` key in the page.
8. Commit and push; the Actions workflow tests and deploys.
9. **Put a sign-in code in the email** (needed for the installed app): *Authentication → Emails → Templates → Magic Link*. Add a line to the body, e.g.
   ```html
   <p>Or type this code in Holo: <strong>{{ .Token }}</strong></p>
   ```
   and save. The installed app on iPhone can't use the link (it opens Safari, which keeps its own sign-in), so it signs in with this code instead.

## Notifications (one time, with the Supabase CLI)

Run these from the repo root in a normal Terminal. Install the CLI with `brew install supabase/tap/supabase`, or put `npx supabase@latest` wherever it says `supabase`.

```sh
supabase login                                          # opens the browser once
supabase link --project-ref lyvdwzokcyathfebfgch        # asks for the database password

# 1. the push_subscriptions table (supabase/migrations/*_push_subscriptions.sql)
supabase db push --remote --dry-run                     # should list only the push_subscriptions migration
supabase db push --remote

# 2. VAPID keys: generated and stored as secrets in one go, the private key is never printed
eval "$(npx -y web-push@3.6.7 generate-vapid-keys --json | node -e 'const k=JSON.parse(require("fs").readFileSync(0));console.log(`supabase secrets set VAPID_PUBLIC_KEY=${k.publicKey} VAPID_PRIVATE_KEY=${k.privateKey}`)')"
supabase secrets set VAPID_SUBJECT=mailto:you@example.com   # your email: push services contact it if something goes wrong

# 3. the function that sends the notifications (supabase/functions/notify)
supabase functions deploy notify --use-api              # --use-api: no Docker needed
```

Notes:
- `supabase/schema.sql` was applied by hand earlier, so it is **not** a migration; `db push` only applies files in `supabase/migrations/`. New database changes go there (`supabase migration new <name>`).
- In CLI v3, `db push` targets a local database unless you pass `--remote`.
- Generate the VAPID keys **once**. New keys make every existing subscription invalid, so each phone would have to turn notifications off and on again.
- `verify_jwt = false` for `notify` in `supabase/config.toml` is intentional: the platform check only understands the legacy keys, so the function checks the signed-in user itself (`withSupabase({ auth: 'user' })`).

Then on each phone (installed app): sign in → *Turn on* in the dialog (or ⚙︎ Settings → *Turn on notifications*) → *Send a test*.

## Using it
- **Install it first** (recommended): iPhone: Safari → Share → *Add to Home Screen*. Android: Chrome menu → *Add to Home screen* / *Install app*. Open Holo from the icon.
- *Inbox* → enter your email → *Email me a sign-in link* → type the **code** from the email into the box that appears (or, in a normal browser tab, tap the link instead). You stay signed in on that phone after that. The installed app and the browser tab are signed in separately.
- Load a video (and pick its *Video type*) or write a message, then *Send this … to <name>*.
- The other phone gets it instantly if the page is open; otherwise it's in the Inbox list next time the page opens (new ones are highlighted). Tapping a message plays it with the sender's video type.
- With only one member added, messages go to yourself: handy for testing alone.

## Limits worth knowing
- Clips up to 50 MB each; the free tier has 1 GB storage in total. Old clips aren't deleted automatically yet.
- Supabase's built-in email sender is rate-limited (a few sign-in emails per hour). Fine for two people who sign in once per phone; set up custom SMTP if it gets in the way.
- Push notifications work only where the browser supports them: on iPhone only in the installed app (iOS 16.4+), on Android in Chrome. A device that never turned them on only sees new clips when Holo is open.
- Sign-in links and codes work once and expire after about an hour; asking for a new one cancels the old one.
