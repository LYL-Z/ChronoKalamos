# Sand & Cinnabar design QA

## current result: static gate passed; browser gate pending

The selected reference is `C:\\Users\\Lenovo\\.codex\\visualizations\\2026\\07\\18\\chronokalamos-options\\direction-sand.html`.

The local application builds successfully. The previous in-app browser attempt rejected both `http://localhost:4173/` and `http://terminal.local:4173/` with a client-side URL policy error. Because the prototype screenshot could not be captured, a same-viewport reference comparison and interaction QA remain unverified rather than marked as passed.

The private Sites deployment is live, but opening it from the browser reaches the required ChatGPT sign-in gate. No credentials were entered, so remote visual QA also remains blocked.

## Static checks completed

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`

## What is now covered without browser access

- The language selector changes and persists the interface skeleton across five locales.
- Low-motion state is persisted with a storage failure fallback.
- The setup dialog closes on Escape, restores focus, exposes a description, and marks selected options.
- The identity panel clearly separates Supabase configuration from the development simulator.
- The map remains explicitly labeled as a prototype layer, not a verified reconstruction.

## Required follow-up

Open the deployed private preview in a browser that can access the Sites checkpoint. Re-run the first-load, guest start, origin selection, email form, low-motion toggle, language selector, and mobile breakpoint checks before calling the design gate passed.
