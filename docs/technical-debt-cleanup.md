# MinhLab — technical debt cleanup & hygiene

## Overview

Cleanup of legacy single-page/Vite artifacts, unused prototypes, and unreferenced components after the complete migration to Next.js 14 App Router. Established standard Git exclusion rules, configured ESLint for Next.js 14, and harmonized design system documentation with production implementation.

## Removed files and directories

All listed files were audited across `app/`, `src/`, and `components/` to verify zero active App Router imports before deletion:

- `src/App.tsx` (legacy Vite SPA root, replaced by App Router `app/page.tsx`)
- `src/main.tsx` & `index.html` (legacy Vite entrypoints, unreferenced in App Router)
- `src/components/lab-journey/LabJourneyContainer.tsx` (superseded by `LabScrollytelling.tsx`; note: `LabCanvas.tsx` is preserved and active)
- `src/components/scrollytelling/` (`CinematicScrollyStage.tsx`, unreferenced prototype)
- `src/components/workshop-tour/` (`WorkshopTour.tsx`, unreferenced prototype)
- `src/components/home/SteppedConsultantExperience.tsx` (unreferenced prototype)
- `src/components/quality/` (`FinishingQuality.tsx`, unreferenced)
- `src/components/ondemand/` (`OnDemandPrinting.tsx`, unreferenced)
- `components/minhlab/` (`MinhLabMascot.tsx`, `MinhLabMascotCanvas.tsx`, `MinhLabMascotLoader.tsx` — superseded by `src/components/home/ConsultantMascot.tsx` & `ConsultantMascotCanvas.tsx`)
- `src/components/hero/` (`Hero.tsx`, legacy hero only imported by dead `App.tsx`)

## Configurations & Documentation

- `.gitignore`: Added standard Next.js 14 gitignore covering `node_modules/`, `.next/`, `.DS_Store`, `__pycache__/`, `*.tsbuildinfo`, `next-env.d.ts`, `dist/`, `build/`.
- `.eslintrc.json`: Created with `next/core-web-vitals` ruleset. Installed `eslint@^8.57.0` and `eslint-config-next@14.2.35` in `devDependencies`.
- `AGENTS.md`: Updated Section 4 "Design Direction" to align with `tailwind.config.js` and `docs/studio-redesign.md`: Primary accent is Brand Red `#EB4037` (`brand.DEFAULT`), while Champagne Gold `#C8A261` serves as secondary accent for luxury badges, eyebrows, and CTA highlights in `studio.module.css`. Updated Section 3 directory tree to match current App Router codebase.

## Verification commands

```sh
npx tsc --noEmit
npm run lint
node scripts/test-studio-scroll.cjs
node scripts/test-scene-customization.cjs
node scripts/test-home-chapters.cjs
npm run build
```
