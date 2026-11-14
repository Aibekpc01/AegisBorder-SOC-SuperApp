# Aegis interface refinement

## Changes

- Reuse the existing Aegis SVG between institutional emblems in the shared identity component, including the public-emblem opt-out case.
- Add responsive sizing for the landing page, login, introduction, commission and footer.
- Refine hero spacing, typography, card depth and background grid.
- Reveal below-fold landing blocks once with IntersectionObserver; release observers and respect reduced motion.
- Animate changing educational examples and preserve keyboard focus outlines.
- Use the existing centered dialog animation and a separate opacity-only overlay animation.
- Add a module-search empty state with a reset action and announce menu expansion.
- Give the startup screen the Aegis mark, actual two-check progress, a distinct failure icon and a stopped loading ring on failure.
- Tighten mobile login spacing and maintain readable form controls.

## Verification

- Frontend production build and ESLint.
- Vitest: 27 tests across seven files passed.
- Edge/Playwright: landing at 1440, 768 and 390 px, no horizontal overflow; educational example switching; reduced-motion animations disabled.
- Edge/Playwright: module search empty state/reset, Escape dismissal, login at 1440 and 390 px, startup error and successful retry; no page errors or horizontal overflow.
- Browser checks use mocked health/auth responses; they validate presentation and interaction, not a live backend or authentication.

Run the Vite dev server on port 5173, then from `frontend` run `node scripts/design-review.mjs` and `node scripts/design-dialog-check.mjs`. Screenshots are written to `docs/design-*.png`.

Design reference: https://www.pentagram.com/digital-design (identity consistency and restrained digital composition).

Changes are local; no deployment was performed. Existing unrelated working-tree changes were retained.
