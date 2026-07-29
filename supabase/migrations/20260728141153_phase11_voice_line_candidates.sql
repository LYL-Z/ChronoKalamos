alter table public.content_candidate_entries
  drop constraint if exists content_candidate_entries_entry_type_check;

alter table public.content_candidate_entries
  add constraint content_candidate_entries_entry_type_check
  check (entry_type in (
    'source',
    'chapter',
    'event',
    'npc',
    'item',
    'risk',
    'claim',
    'map-feature',
    'voice-line'
  ));

update public.content_candidate_versions
set expected_counts = expected_counts || '{
      "voiceLines": 27,
      "citationLinks": 100,
      "cinematicScenes": 27,
      "productionEvents": 27,
      "productionNpcs": 12,
      "productionLocations": 8,
      "phase11Evaluations": 240
    }'::jsonb,
    updated_at = now()
where scenario_id = 'tang-changan-742'
  and content_version = '11.0.0';
