drop policy if exists content_candidate_versions_deny_clients
  on public.content_candidate_versions;
create policy content_candidate_versions_deny_clients
  on public.content_candidate_versions
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists content_candidate_entries_deny_clients
  on public.content_candidate_entries;
create policy content_candidate_entries_deny_clients
  on public.content_candidate_entries
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists historian_content_reviews_deny_clients
  on public.historian_content_reviews;
create policy historian_content_reviews_deny_clients
  on public.historian_content_reviews
  for all
  to anon, authenticated
  using (false)
  with check (false);
