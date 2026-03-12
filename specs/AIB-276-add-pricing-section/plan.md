# Implementation Plan: Add Pricing Section to Landing Page and Public Footer

**Branch**: `AIB-276-add-pricing-section` | **Date**: 2026-03-12 | **Spec**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-276-add-pricing-section/spec.md`
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-276-add-pricing-section/spec.md`

## Summary

Add a new pricing section with three public plan cards and a minimal FAQ to the existing landing page, positioned between the workflow and final CTA sections. Extend the existing global public footer so it includes Terms of Service, Privacy Policy, and a configurable GitHub repository link while preserving the current dark marketing design across the landing page and legal pages. No database changes, API routes, or billing flow changes are required.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, TailwindCSS 3.4, shadcn/ui, lucide-react
**Storage**: N/A (static marketing content only)
**Testing**: Vitest component tests for landing/footer UI plus Vitest integration coverage for public page HTML
**Target Platform**: Web (Vercel deployment)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Preserve current landing-page static rendering characteristics; added section should not introduce client-side data fetching or meaningful bundle growth
**Constraints**: Keep content on the existing landing page, maintain dark-theme public design language, keep CTA destinations on existing sign-in flow, expose repository URL as a configurable content source, and ensure mobile/desktop readability without horizontal scrolling
**Scale/Scope**: 1 new landing section component group, 1 existing landing page update, 1 footer update, 2-4 test updates

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All planned changes are TS/TSX component edits with explicit prop typing for static content models |
| II. Component-Driven Architecture | PASS | Pricing and FAQ fit the existing `/components/landing/` structure and footer remains in `/components/layout/` |
| III. Test-Driven Development | PASS | Existing footer and legal integration tests can be extended; landing-page coverage will be added at component/integration level, avoiding unnecessary E2E |
| IV. Security-First | PASS | No new user input, auth, secrets, or API surface; repository URL will be sourced from controlled configuration rather than inline request data |
| V. Database Integrity | PASS | No Prisma schema or persistence changes |
| V. Spec Clarification Guardrails | PASS | Spec already documents conservative auto-resolved decisions and bounded scope |
| VI. AI-First Development | PASS | All generated artifacts remain under `specs/AIB-276-add-pricing-section/`; no root-level human docs are introduced |

**Gate Result**: ALL PASS - proceed with research and design.

## Project Structure

### Documentation (this feature)

```text
specs/AIB-276-add-pricing-section/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── public-pages.md
```

### Source Code (repository root)

```text
app/
├── landing/
│   └── page.tsx                       # MODIFY: insert pricing section before CTA
└── legal/
    ├── privacy/page.tsx              # VERIFY: shared footer remains visible
    └── terms/page.tsx                # VERIFY: shared footer remains visible

components/
├── landing/
│   ├── pricing-section.tsx           # CREATE: pricing + FAQ section shell
│   ├── pricing-card.tsx              # CREATE: reusable public pricing card
│   └── pricing-faq.tsx               # CREATE: minimal FAQ block
└── layout/
    └── footer.tsx                    # MODIFY: add GitHub repository link and configurable source

lib/
└── config/
    └── public-site.ts                # CREATE: static public content config for footer/pricing copy

tests/
├── unit/components/
│   ├── footer.test.tsx               # MODIFY: assert repository link
│   └── landing-page.test.tsx         # CREATE or extend: pricing section and CTA labels
└── integration/
    ├── landing/
    │   └── public-marketing.test.ts  # CREATE: landing HTML contains pricing and FAQ content
    └── legal/
        └── pages.test.ts             # MODIFY: assert footer repository link on legal pages
```

**Structure Decision**: Use feature-local landing components and a small shared config module instead of embedding arrays directly in `app/landing/page.tsx` or `components/layout/footer.tsx`. This keeps public copy centralized, typed, and reusable across both the landing section and footer tests without adding a CMS or database dependency.

## Complexity Tracking

No constitution violations. No complexity justifications required.

## Phase 0: Research Focus

Research must resolve the following design questions before implementation:

1. Where static marketing copy should live so the footer repository URL remains configurable without introducing runtime fetches.
2. Whether the existing authenticated billing `PricingCards` component should be reused or whether a landing-specific server component is cleaner.
3. What test layer mix provides adequate confidence for landing content placement and footer consistency on legal pages.

## Phase 1 Design Summary

### Public Content Strategy

- Add a typed `lib/config/public-site.ts` module containing:
  - plan metadata for Free, Pro, and Team
  - minimal pricing FAQ entries
  - footer legal/repository links
- Keep the config server-safe and static so both the landing page and footer can consume the same source of truth.

### Landing Page Composition

- Create `PricingSection` as a Server Component rendered after `WorkflowSection` and before `CTASection`.
- Use shadcn/ui `Card` and `Button` primitives to present the three plans.
- Render FAQ content directly below the cards in the same section to satisfy FR-005 and FR-006.
- Reuse `/auth/signin` as the CTA target for all plans, with labels varying by plan.

### Footer Extension

- Update the existing shared `Footer` component to add the GitHub repository link beside the legal links.
- Keep footer styling aligned with the current Catppuccin/dark public theme.
- Use the shared config module for repository URL and labels so future repository changes are made in one place.

### Testing Strategy

- Component test: verify landing pricing section renders all plan names, capability lists, FAQ items, and CTA labels.
- Component test: extend existing footer test to include repository link label and external URL.
- Integration test: fetch `/` and assert pricing content sits in the rendered landing HTML along with FAQ topics.
- Integration test: extend legal page assertions to confirm footer includes repository link on public legal routes.
- No Playwright E2E is required because the feature does not depend on browser-only behavior.

## Post-Design Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | Static config and component props remain strongly typed |
| II. Component-Driven Architecture | PASS | New UI is isolated to landing and layout feature folders using existing primitives |
| III. Test-Driven Development | PASS | Design identifies concrete existing suites to extend and keeps tests at Vitest component/integration level |
| IV. Security-First | PASS | No new input processing or server endpoints; repository link is fixed config content |
| V. Database Integrity | PASS | No database changes introduced during design |
| V. Spec Clarification Guardrails | PASS | Research resolved scope and configurability decisions without expanding into checkout or CMS work |
| VI. AI-First Development | PASS | Design artifacts remain in the feature spec folder and do not add root-level documentation |

**Post-Design Gate Result**: ALL PASS - design is ready for task generation.
