# ChronoKalamos UX System v2

## Scope

Phase 12 does not change the historical content model or game rules. It turns the existing public beta into a coherent product surface. The visual system remains Sand & Cinnabar:

- sand paper carries the reading plane;
- cinnabar marks active state and warnings;
- indigo carries primary text and authoritative structure;
- brass marks focus, uncertainty, and controlled emphasis.

Decorative effects may not imply evidence. The map grid, seals, and paper texture are presentation only.

## Information architecture

The primary navigation now resolves to real routes:

| Route | Product responsibility |
|---|---|
| `/` | evidence map, identity boundary, origin selection, current chapter |
| `/saves` | current user’s RLS-filtered `game_sessions` |
| `/settings` | local display and language preferences |
| `/support` | capability boundaries, health state, recovery guidance |

The archive never substitutes demo records when Supabase is unavailable. It displays an explicit unconfigured, signed-out, empty, loading, or error state.

## Evidence map contract

The map supports:

- a year filter against `validFrom` and `validTo`;
- a source filter against `sourceIds`;
- the three historical classification labels;
- `low`, `medium`, and `high` geographic uncertainty;
- the location associated with the current edited event;
- publication status, attribution, and license disclosure.

The layer merges the published Supabase mirror with locally validated provisional Phase 11 nodes. Provisional nodes remain visibly marked. This merge does not publish new database rows.

Empty results state only that the current content package has no matching feature. It must not claim that historical activity was absent.

## Chapter timeline

The chapter rail derives its nodes from the active `EventTemplate` catalog. It reads:

- origin;
- content version;
- current event ID;
- completed event IDs;
- turn number.

It does not allow the user to jump past unpublished or uncompleted events. The rail is a state explanation, not a time-travel control.

## Recovery model

- Content sync failure keeps the locally validated package and exposes a retry.
- Offline state blocks new turn submission.
- Failed turn retry reuses the same `clientTurnId` and expected state version.
- A retry cannot create a second state transition because the server remains idempotent.
- A committed turn keeps the existing recap card and updates chapter state.

## Responsive behavior

At 840 px the three-column home layout becomes one column. At 620 px:

- filters become a vertical form;
- chapter events become a readable list;
- archive and support cards become one column;
- the evidence canvas remains bounded;
- the page must not gain horizontal overflow.

No route uses `overflow-x` as a substitute for a functioning layout. Tables use an explicitly labeled scroll region when their semantic columns cannot collapse.
