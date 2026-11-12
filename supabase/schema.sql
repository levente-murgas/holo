´-- Holo inbox schema. Run once in the Supabase SQL editor (see SETUP.md).
-- Security model: the page and its publishable key are public, so access is enforced here with RLS.
-- Only users listed in public.members (the two of you) can read or write anything.

-- ---------- members: the allow-list ----------
create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name    text not null
);
alter table public.members enable row level security;

-- security definer so policies can check membership without recursing into members' own RLS
create or replace function public.is_member()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.members where user_id = (select auth.uid()));
$$;

create policy "members see members" on public.members
  for select to authenticated using ((select public.is_member()));
-- no insert/update/delete policies: members are added by you in the SQL editor only

-- ---------- messages: the inbox ----------
create table public.messages (
  id         bigint generated always as identity primary key,
  sender     uuid not null default auth.uid() references public.members (user_id),
  recipient  uuid not null references public.members (user_id),
  clip_path  text,                                   -- path in the 'clips' bucket, null for text-only
  text       text check (char_length(text) <= 200),
  src        text not null default 'rec' check (src in ('rec', 'holo1', 'holo4')),
  view       text not null default 'bottom' check (view in ('bottom', 'top', 'left', 'right')),
  created_at timestamptz not null default now(),
  seen_at    timestamptz,
  check (clip_path is not null or text is not null)
);
create index messages_recipient_created on public.messages (recipient, created_at desc);
alter table public.messages enable row level security;

create policy "read own messages" on public.messages
  for select to authenticated
  using ((select public.is_member()) and (select auth.uid()) in (sender, recipient));

create policy "send as yourself" on public.messages
  for insert to authenticated
  with check (
    (select public.is_member())
    and sender = (select auth.uid())
    and (clip_path is null or split_part(clip_path, '/', 1) = (select auth.uid())::text)
  );

create policy "recipient marks seen" on public.messages
  for update to authenticated
  using (recipient = (select auth.uid()))
  with check (recipient = (select auth.uid()));
-- the recipient may only change seen_at
revoke update on public.messages from authenticated;
grant update (seen_at) on public.messages to authenticated;

-- live inserts for the open page (Realtime respects the select policy above)
alter publication supabase_realtime add table public.messages;

-- ---------- storage: private 'clips' bucket ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clips', 'clips', false, 52428800, array['video/*']);   -- 50 MB per clip

-- upload only into your own folder: clips/<your user id>/...
create policy "members upload own clips" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'clips'
    and (select public.is_member())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- both members can download clips (there are only two of you)
create policy "members read clips" on storage.objects
  for select to authenticated
  using (bucket_id = 'clips' and (select public.is_member()));

-- the sender can delete their own clip (used to clean up if saving the message fails)
create policy "members delete own clips" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'clips'
    and (select public.is_member())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
