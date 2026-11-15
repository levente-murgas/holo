-- GIF holograms: a GIPHY GIF is sent as its MP4 clip with src 'gif'.
alter table public.messages drop constraint messages_src_check;
alter table public.messages add constraint messages_src_check check (src in ('rec', 'holo1', 'holo4', 'gif'));
