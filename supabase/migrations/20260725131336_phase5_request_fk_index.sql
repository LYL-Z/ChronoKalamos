-- Cover the composite session-owner foreign key used by turn requests.
create index if not exists game_turn_requests_session_owner_idx
  on public.game_turn_requests (session_id, owner_id);
