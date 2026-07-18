# Sand & Cinnabar design QA

## final result: blocked

The selected reference is `C:\\Users\\Lenovo\\.codex\\visualizations\\2026\\07\\18\\chronokalamos-options\\direction-sand.html`.

The local application builds successfully, but the Codex in-app browser rejected both `http://localhost:4173/` and `http://terminal.local:4173/` with a client-side URL policy error. Because the prototype screenshot could not be captured, a same-viewport reference comparison and interaction QA could not be completed.

## Static checks completed

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`

## Required follow-up

Open the deployed private preview in a browser that can access the Sites checkpoint. Re-run the first-load, guest start, origin selection, email form, low-motion toggle, language selector, and mobile breakpoint checks before calling the design gate passed.
