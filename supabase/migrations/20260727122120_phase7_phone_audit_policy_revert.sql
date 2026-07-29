-- Keep phone_auth_audit deny-by-default without an RLS policy; access is
-- already restricted by RLS plus service-role-only table/function grants.
drop policy if exists phone_auth_audit_deny_client_access
  on public.phone_auth_audit;
