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

## Using it
- **Install it first** (recommended): iPhone: Safari → Share → *Add to Home Screen*. Android: Chrome menu → *Add to Home screen* / *Install app*. Open Holo from the icon.
- *Inbox* → enter your email → *Email me a sign-in link* → type the **code** from the email into the box that appears (or, in a normal browser tab, tap the link instead). You stay signed in on that phone after that. The installed app and the browser tab are signed in separately.
- Load a video (and pick its *Video type*) or write a message, then *Send this … to <name>*.
- The other phone gets it instantly if the page is open; otherwise it's in the Inbox list next time the page opens (new ones are highlighted). Tapping a message plays it with the sender's video type.
- With only one member added, messages go to yourself: handy for testing alone.

## Limits worth knowing
- Clips up to 50 MB each; the free tier has 1 GB storage in total. Old clips aren't deleted automatically yet.
- Supabase's built-in email sender is rate-limited (a few sign-in emails per hour). Fine for two people who sign in once per phone; set up custom SMTP if it gets in the way.
- No push notifications: the receiver only sees new clips while the page is open or the next time they open it.
- Sign-in links and codes work once and expire after about an hour; asking for a new one cancels the old one.
