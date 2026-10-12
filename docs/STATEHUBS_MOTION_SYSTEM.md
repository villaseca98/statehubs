# StateHubs motion system — Phase 04

## Implemented
- CSS-only opt-in classes: `sh-glass`, `sh-press`, `sh-tilt`, `sh-skeleton`, `sh-enter`.
- `SHSkeleton` reusable, decorative loading placeholder. Parent should use `aria-busy` and visible/announced loading text.
- CRM module toggle buttons use `sh-press` and `sh-focus` while retaining `aria-pressed` and native disabled behavior.
- Shared button uses pressed-state microinteraction.
- Landing Reveal avoids hidden content when reduced motion is requested.
- CI workflow runs lint, tests and build for PRs and main.

## Performance and accessibility
- Tilt only on `hover:hover` with fine pointer; no forced 3D on touch devices.
- `prefers-reduced-motion: reduce` disables shimmer, entry and tilt.
- Keep heavy blur/glass off large scrolling CRM surfaces; use sparingly on landing and navigation.
- Focus remains visible for keyboard users; skeleton is `aria-hidden`.
- No new runtime dependency.

## Manual verification before shipping
1. On a real iPhone, ensure module buttons still toggle and navigation is usable.
2. Keyboard Tab/Enter/Space: focus visible, toggle state correct.
3. macOS/iOS Reduce Motion: no reveal invisibility or skeleton animation.
4. Check scroll smoothness and layout shift on landing, CRM and slow devices.
5. Inspect Vercel deployment of the merged SHA.
