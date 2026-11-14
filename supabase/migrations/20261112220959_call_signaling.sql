-- Live calls: the two phones exchange call set-up messages (ring, accept, WebRTC offer/answer,
-- network candidates, hang up) over a private Realtime Broadcast channel with the topic 'holo-call'.
-- Realtime Authorization checks these policies when a client joins a channel created with
-- { config: { private: true } }, so only the two members can listen or send on it.

create policy "members listen on holo-call" on realtime.messages
  for select to authenticated
  using (
    (select realtime.topic()) = 'holo-call'
    and realtime.messages.extension = 'broadcast'
    and (select public.is_member())
  );

create policy "members send on holo-call" on realtime.messages
  for insert to authenticated
  with check (
    (select realtime.topic()) = 'holo-call'
    and realtime.messages.extension = 'broadcast'
    and (select public.is_member())
  );
