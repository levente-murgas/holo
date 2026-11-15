-- Sticker holograms: a GIPHY sticker is sent as its transparent GIF with src 'sticker'.
alter table public.messages drop constraint messages_src_check;
alter table public.messages add constraint messages_src_check check (src in ('rec', 'holo1', 'holo4', 'gif', 'sticker'));
update storage.buckets set allowed_mime_types = array['video/*', 'image/gif'] where id = 'clips';
