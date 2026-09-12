-- Align playtest enrollment and event version checks with shipped APP_RELEASE 40.
-- Existing 36 rows are rewritten so the new CHECK can be applied.

update public.playtest_events
  set app_release = '40'
  where app_release = '36';

update public.playtest_enrollments
  set app_release = '40'
  where app_release = '36';

alter table public.playtest_enrollments
  drop constraint if exists playtest_enrollments_app_release_check;
alter table public.playtest_enrollments
  add constraint playtest_enrollments_app_release_check
  check (app_release = '40');

alter table public.playtest_events
  drop constraint if exists playtest_events_app_release_check;
alter table public.playtest_events
  add constraint playtest_events_app_release_check
  check (app_release = '40');

drop policy if exists playtest_enrollments_insert_own on public.playtest_enrollments;
create policy playtest_enrollments_insert_own
  on public.playtest_enrollments
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = owner_id
    and app_release = '40'
    and content_version = '11.0.0'
    and scenario_id = 'tang-changan-742'
    and scenario_version = '1.0.0'
    and consent_version = 'phase14-v1'
    and cohort = 'small-public-beta'
  );
