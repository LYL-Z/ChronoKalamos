# Sand & Cinnabar design QA

## Current result: phase 5 desktop and mobile screens passed local visual QA

Selected reference:

`C:\Users\Lenovo\.codex\visualizations\2026\07\18\chronokalamos-options\direction-sand.html`

On 25 July 2026, the reference and the rendered application were captured at the same 1440 × 1000 viewport and reviewed together. The implementation retains the selected sandpaper, cinnabar, indigo, and brass system. The map, evidence panel, and timeline remain the dominant archive structure. The phase 5 game screen extends that system with one indigo rule column, one paper narrative column, and one indigo world-state column.

The reference uses decorative route lines. The implementation replaces them with published feature nodes, uncertainty labels, source IDs, validity dates, and license data. This is a deliberate product change. It supports the evidence-bound brief and does not alter the selected visual language.

## Browser checks

Chrome rendered the local authenticated test preview at:

- desktop: 1440 × 1000;
- mobile: 390 × 844.

Verified states:

1. the timed boot reaches the archive page;
2. the public homepage shows five published map features and three bounded origins;
3. the new-session dialog works at desktop and mobile widths;
4. an unauthenticated visitor is upgraded to a real anonymous Supabase user;
5. session creation uses the authoritative `create_or_get_game_session` RPC;
6. the phase 5 game screen renders the rule pipeline, candidate narrative, choices, free input, private-image input, world state, reputation, time axis, and source boundary;
7. a missing `DEEPSEEK_API_KEY` produces a visible `本回合未提交` state;
8. the failed turn leaves the session at state version `v0`;
9. desktop and mobile have no horizontal overflow;
10. mobile map-node labels are suppressed while their accessible labels and evidence panel remain available, eliminating the visible label collisions found in the first mobile capture.

The live production site at `https://chronokalamos.com/` returned HTTP 200. Chrome confirmed `SUPABASE / PUBLISHED MIRROR`, the visible email-login entry, verification-link mode, password mode, and guest entry. The phase 5 source state was not deployed during this phase.

## Static and integration checks

- `npm run content:validate`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:unit`
- `npm run test:contracts`
- `npm run test:supabase:live`
- `npm test`

The publishable-key Supabase live suite verified two-user isolation, private upload isolation, session RPC idempotency, and that a signed-in browser cannot call the commit RPC. A separate management-API transaction smoke test verified the service-only wrapper: reservation status `reserved`, committed version `1`, world-state turn `1`, then owner cleanup returned `true`.

## Known deployment risk

The Windows `vinext start` server returned HTTP 200 for HTML but 404 for the generated `/assets/*` path. The Vite development server served the same asset correctly. This appears limited to the local Windows production server path. It is not evidence that the Cloudflare worker is broken, because the existing Sites deployment serves its assets and the production page renders correctly. A phase 6 deployment check must still verify every current asset URL after the phase 5 source is saved and deployed.

## Remaining gate

The repository has no `DEEPSEEK_API_KEY` or `SUPABASE_SECRET_KEY`. The browser failure boundary and database service-wrapper transaction are verified, but a real DeepSeek model turn is not. Phase 5 cannot be declared fully complete until both server-only keys are configured and the 60-case model evaluation suite runs against the selected model.
