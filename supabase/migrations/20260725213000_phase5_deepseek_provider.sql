alter table public.game_turns
  drop constraint if exists game_turns_provider_check;

-- Phase 5 provider cutover: existing turns are retained as historical records,
-- but the only provider accepted for new commits is DeepSeek.
update public.game_turns
set provider = 'deepseek-chat'
where provider = 'openai-responses';

alter table public.game_turns
  alter column provider set default 'deepseek-chat';

alter table public.game_turns
  add constraint game_turns_provider_check
  check (provider = 'deepseek-chat');

-- The original transaction function names the previous provider literally.
-- Normalize that legacy value at the table boundary without reopening any
-- client write privilege or changing the transaction contract.
create or replace function public.normalize_game_turn_provider()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.provider = 'openai-responses' then
    new.provider := 'deepseek-chat';
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_game_turn_provider on public.game_turns;
create trigger normalize_game_turn_provider
before insert or update of provider on public.game_turns
for each row
execute function public.normalize_game_turn_provider();
