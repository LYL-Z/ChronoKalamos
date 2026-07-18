# Sand & Cinnabar design QA

## current result: desktop core gate passed; cloud and mobile gates pending

The selected reference is `C:\\Users\\Lenovo\\.codex\\visualizations\\2026\\07\\18\\chronokalamos-options\\direction-sand.html`.

The local application builds successfully. On 18 July 2026, the in-app browser reached the Vite development server at `http://127.0.0.1:4322/` and captured a full-page desktop screenshot. The rendered direction retains the selected sandpaper, cinnabar, indigo, and brass system. The map and timeline remain the dominant visual structure.

The browser run verified six core flows:

1. the timed boot reaches the archive page;
2. the five-language selector changes the interface skeleton;
3. low-motion mode changes state and exposes `aria-pressed`;
4. the setup dialog receives focus, closes on Escape, and restores focus;
5. an origin can be selected and loaded into the game simulator;
6. the unconfigured guest path opens the simulator while retaining the Supabase warning.

The Windows `vinext start` process served the HTML shell but returned 404 for generated `/assets/*` paths during this run. The Vite development server did not reproduce the failure. The local package code builds static cache keys with Windows path separators, so this is treated as a Vinext Windows production-server limitation, not as proof that the deployed Linux worker is broken. It remains a deployment-risk item until upstream or a pinned upgrade resolves it.

The private Sites deployment is live, but opening it from the isolated browser reaches the required ChatGPT sign-in gate. No credentials were entered, so remote visual QA remains unverified.

## Static checks completed

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`

## Browser and static coverage

- The language selector changes and persists the interface skeleton across five locales.
- Low-motion state is persisted with a storage failure fallback.
- The setup dialog closes on Escape, restores focus, exposes a description, and marks selected options.
- The identity panel clearly separates Supabase configuration from the development simulator.
- The map remains explicitly labeled as a prototype layer, not a verified reconstruction.

## Required follow-up

Open the deployed private site in a signed-in browser and repeat the core flow against the production worker. Run the mobile breakpoint and real Supabase email/upload flows. Until those checks exist, the desktop prototype gate is passed but the complete phase 2 and phase 3 exit conditions are not.
