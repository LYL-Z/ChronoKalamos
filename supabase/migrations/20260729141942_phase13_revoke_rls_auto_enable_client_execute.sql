revoke all on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon, authenticated;
grant execute on function public.rls_auto_enable() to postgres;

comment on function public.rls_auto_enable() is
  'Internal event-trigger function that enables RLS on new public tables. Browser and API roles must not execute it directly.';
