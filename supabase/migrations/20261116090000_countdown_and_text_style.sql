-- Countdown holograms (text holds the visit date, YYYY-MM-DD) and the look of the words (face and colour).
alter table public.messages drop constraint messages_src_check;
alter table public.messages add constraint messages_src_check
  check (src in ('rec', 'holo1', 'holo4', 'gif', 'sticker', 'countdown'));
alter table public.messages add column style jsonb check (style is null or octet_length(style::text) <= 200);
