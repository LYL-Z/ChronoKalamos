-- Cover the composite enrollment ownership foreign key reported by the
-- Supabase performance advisor.

create index if not exists playtest_events_enrollment_owner_idx
  on public.playtest_events (enrollment_id, owner_id);

