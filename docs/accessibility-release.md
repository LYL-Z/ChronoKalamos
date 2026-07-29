# Phase 12 accessibility release

## Implemented controls

- A skip link is the first focusable control on product and game pages.
- Focus indicators cover links, buttons, inputs, selects, textareas, radios, checkboxes, and focusable scroll regions.
- The setup dialog keeps its existing Escape and focus-return behavior.
- `prefers-reduced-motion` remains authoritative.
- The in-product low-motion preference defaults to the operating-system preference on first use.
- Settings expose a larger text scale without changing evidence or game rules.
- Offline, loading, error, empty, committed, and failed states use semantic live regions where appropriate.
- The evidence map has a non-visual name, labeled filters, pressed state, and a text evidence panel.
- The chapter timeline uses `aria-current="step"` for the current event.

## Automated coverage

`tests/e2e/phase12.spec.ts` runs:

- axe WCAG A/AA rules on `/`, `/saves`, `/settings`, and `/support`;
- keyboard skip-link and route navigation;
- 390 × 844 and 768 × 1024 overflow checks;
- font fallback and `document.fonts` checks;
- evidence-filter behavior;
- settings persistence signals;
- public health and recovery content;
- a bounded page-load resource budget.

Automated axe checks are not a claim of complete WCAG 2.2 conformance. They do not replace testing with screen readers, magnification, switch access, or people with disabilities.

## Manual checks before each public release

1. Complete one session using only a keyboard.
2. Verify the setup dialog focus does not escape behind the modal.
3. Verify 200% browser zoom on home, archives, settings, support, and game.
4. Verify Windows High Contrast or forced colors.
5. Verify a screen reader announces map filters, current event, turn failure, and retry.
6. Verify reduced motion stops the current-location pulse and cinematic drift.
7. Verify no flash sequence exceeds the project’s safety boundary.

## Known boundary

The project uses system font stacks. Exact glyph rendering varies by operating system. The tests verify loaded fallback families, not identical raster output across platforms.
