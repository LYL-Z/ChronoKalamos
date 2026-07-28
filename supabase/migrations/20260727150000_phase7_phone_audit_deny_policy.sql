-- Keep the audit table intentionally service-role-only while making the
-- deny-by-default policy explicit to database advisors.
create policy phone_auth_audit_deny_client_access
  on public.phone_auth_audit
  for all
  to public
  using (false)
  with check (false);
