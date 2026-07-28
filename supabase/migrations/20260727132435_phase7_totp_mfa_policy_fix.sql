-- Repair the first TOTP policies: authenticated users cannot query rows
-- auth.mfa_factors directly. The SECURITY DEFINER helper exposes only the
-- current user's boolean admission result.

grant usage on schema private to authenticated;
grant execute on function private.session_meets_mfa() to authenticated;

drop policy if exists "profiles_require_mfa_when_enrolled" on public.profiles;
create policy "profiles_require_mfa_when_enrolled" on public.profiles
  as restrictive for all to authenticated
  using ((select private.session_meets_mfa()))
  with check ((select private.session_meets_mfa()));

drop policy if exists "game_sessions_require_mfa_when_enrolled" on public.game_sessions;
create policy "game_sessions_require_mfa_when_enrolled" on public.game_sessions
  as restrictive for all to authenticated
  using ((select private.session_meets_mfa()))
  with check ((select private.session_meets_mfa()));

drop policy if exists "game_turn_requests_require_mfa_when_enrolled" on public.game_turn_requests;
create policy "game_turn_requests_require_mfa_when_enrolled" on public.game_turn_requests
  as restrictive for all to authenticated
  using ((select private.session_meets_mfa()))
  with check ((select private.session_meets_mfa()));

drop policy if exists "game_turns_require_mfa_when_enrolled" on public.game_turns;
create policy "game_turns_require_mfa_when_enrolled" on public.game_turns
  as restrictive for all to authenticated
  using ((select private.session_meets_mfa()))
  with check ((select private.session_meets_mfa()));

drop policy if exists "game_checkpoints_require_mfa_when_enrolled" on public.game_checkpoints;
create policy "game_checkpoints_require_mfa_when_enrolled" on public.game_checkpoints
  as restrictive for all to authenticated
  using ((select private.session_meets_mfa()))
  with check ((select private.session_meets_mfa()));

drop policy if exists "user_uploads_require_mfa_when_enrolled" on public.user_uploads;
create policy "user_uploads_require_mfa_when_enrolled" on public.user_uploads
  as restrictive for all to authenticated
  using ((select private.session_meets_mfa()))
  with check ((select private.session_meets_mfa()));

drop policy if exists "storage_user_uploads_require_mfa_when_enrolled" on storage.objects;
create policy "storage_user_uploads_require_mfa_when_enrolled" on storage.objects
  as restrictive for all to authenticated
  using (
    bucket_id <> 'user-uploads'
    or (select private.session_meets_mfa())
  )
  with check (
    bucket_id <> 'user-uploads'
    or (select private.session_meets_mfa())
  );
