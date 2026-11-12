-- Push notifications: one row per device (browser / installed app) that turned notifications on.
-- The browser hands out a subscription = an endpoint URL at Apple's/Google's push service plus two
-- keys used to encrypt the notification for that one device. The 'notify' Edge Function reads these
-- rows (with the secret key) to notify the recipient of a new message.

create table public.push_subscriptions (
  endpoint   text primary key,                       -- unique per device and browser
  user_id    uuid not null default auth.uid() references public.members (user_id) on delete cascade,
  p256dh     text not null,                          -- device's public key (encrypts the payload)
  auth       text not null,                          -- device's auth secret
  user_agent text,                                   -- just to tell devices apart when debugging
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

-- Members manage only their own devices. Nobody can read anyone else's subscriptions from the page;
-- the Edge Function uses the secret key to look up the recipient's.
create policy "own subscriptions: read" on public.push_subscriptions
  for select to authenticated
  using ((select public.is_member()) and user_id = (select auth.uid()));

create policy "own subscriptions: add" on public.push_subscriptions
  for insert to authenticated
  with check ((select public.is_member()) and user_id = (select auth.uid()));

create policy "own subscriptions: update" on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check ((select public.is_member()) and user_id = (select auth.uid()));

create policy "own subscriptions: remove" on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));
