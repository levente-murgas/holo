-- Doodle holograms: the strokes are sent as a small JSON file in the clips bucket, with src 'doodle'.
alter table public.messages drop constraint messages_src_check;
alter table public.messages add constraint messages_src_check
  check (src in ('rec', 'holo1', 'holo4', 'gif', 'sticker', 'countdown', 'doodle'));
update storage.buckets set allowed_mime_types = array['video/*', 'image/gif', 'application/json'] where id = 'clips';
