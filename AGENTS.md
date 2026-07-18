# ChronoKalamos project rules

## Product boundary

- The first playable slice is Chang'an in 742 CE.
- The prototype uses three bounded origins: western-market Sogdian merchant household, Chang'an craft apprentice, and Jingzhao clerical household.
- Treat historical claims as `史料记载`, `合理重建`, or `叙事虚构`. Never present generated connective prose as a primary source.
- Keep the interface in Chinese first. English labels may support the prototype. French, Greek, and Russian remain translation-ready, not content-complete.

## Privacy and safety

- Camera, microphone, payments, SMS, WeChat, and QQ remain disabled until the corresponding consent, provider, and policy work is complete.
- Guest saves must disclose browser-data loss. Do not imply cross-device recovery before Supabase Auth and RLS are implemented.
- Do not place API keys, source prompts, private images, or service credentials in client bundles.
- Motion must respect `prefers-reduced-motion` and the in-product low-motion toggle. No repeated flash effects.

## Verification

- Run `npm run lint`, `npx tsc --noEmit`, and `npm test` before claiming a completed phase.
- A successful build is not historical validation. Content releases require a source ledger and a license review.
