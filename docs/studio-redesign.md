# MinhLab — studio scrollytelling

## Implementation

The homepage uses `StudioExperience` and `useStudioScroll`: existing Lenis 1.0.42,
GSAP ScrollTrigger, native touch scrolling, a CSS-sticky introductory scene,
scroll-linked image parallax and content reveals. There are seven real document
sections; links, product data and cart remain normal React components.
Other routes do not mount the homepage scrolling controller.

References: [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/),
[Lenis integration](https://github.com/darkroomengineering/lenis).

## Edited image assets

Built-in image generation/edit tool was used (not the CLI/API fallback).
Original PNGs remain intact. New project assets:

- `public/images/minhlab-lab-resin-v2.png`
- `public/images/minhlab-mascot-free-v2.png`

Edit specification / prompt set used for both views:

> Preserve the original voxel workshop viewpoint, composition, monkey identity,
> clothing, proportions, floor, furniture and lighting. Remove the entire handheld
> nozzle and its curved cable from the monkey's raised hand, leaving both hands
> empty; preserve the tail. Keep the left FDM printer and its filament spool.
> Replace the right FDM printer and spool with a compact resin printer: black
> base, small front screen, translucent deep amber UV hood, Z-axis, build platform
> and vat. Exactly two printers: one FDM, one resin. Change the white MINHLAB
> wordmark to brand red #EB4037, retaining spelling and block-letter styling.
> No unrelated additions, watermarks or redesign.

The wide image was edited from `minhlab-lab-preview.png`; the close-up was
edited from `minhlab-mascot-detail.png` with the same constraints.

The equivalent real-time 3D changes are applied to scene clones through
`src/lib/scene-customization.ts`. The original GLBs and LAB_WAYPOINTS are unchanged.

## Verification commands

```sh
npx tsc --noEmit --incremental false
node scripts/test-studio-scroll.cjs
node scripts/test-scene-customization.cjs
node scripts/test-home-chapters.cjs
npm run build
```

The pre-existing `npm run lint` opens the Next.js ESLint setup wizard because
the repository has no ESLint configuration/dependencies. This is not a passing
lint result. No unrelated lint/dependency setup is included in this redesign.
