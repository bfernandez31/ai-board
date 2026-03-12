# Implementation Summary: Add pricing section to landing page & footer

**Branch**: `AIB-276-add-pricing-section` | **Date**: 2026-03-12
**Spec**: [spec.md](spec.md)

## Changes Summary

Added a shared `public-site` config, a new landing pricing section with Free/Pro/Team cards and FAQ content, and a footer driven by shared legal/repository links. Extended unit coverage for landing/footer content and added targeted integration tests for landing and legal pages.

## Key Decisions

Used a static typed config in `lib/config/public-site.ts` as the single source of truth for pricing, FAQ, and footer links. Built landing-specific server-rendered pricing components instead of reusing authenticated billing UI, and kept all plan CTAs on `/auth/signin`.

## Files Modified

`lib/config/public-site.ts`, `components/landing/pricing-card.tsx`, `components/landing/pricing-faq.tsx`, `components/landing/pricing-section.tsx`, `app/landing/page.tsx`, `components/layout/footer.tsx`, `tests/unit/components/landing-page.test.tsx`, `tests/unit/components/footer.test.tsx`, `tests/integration/landing/public-marketing.test.ts`, `tests/integration/legal/pages.test.ts`, `specs/AIB-276-add-pricing-section/tasks.md`

## ⚠️ Manual Requirements

Rerun `tests/integration/landing/public-marketing.test.ts` and `tests/integration/legal/pages.test.ts` outside this sandbox. Next.js `bun run dev` could not bind to a local port here (`listen EPERM`).
