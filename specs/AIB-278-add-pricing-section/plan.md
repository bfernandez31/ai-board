# Implementation Plan: Landing Page Pricing Section

**Branch**: `AIB-278-add-pricing-section` | **Date**: 2026-03-12 | **Spec**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/spec.md`
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/spec.md`

## Summary

Add a server-rendered pricing section to the existing landing page between the workflow and final CTA sections, using three responsive plan cards for Free, Pro, and Team, a minimal two-item FAQ, and an in-page pricing anchor exposed from the global footer. The implementation will reuse canonical plan details from `/home/runner/work/ai-board/ai-board/target/lib/billing/plans.ts`, preserve the current marketing dark-theme styling, and avoid new API or database changes.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0, Next.js 16 App Router, React 18  
**Primary Dependencies**: Next.js App Router Server Components, shadcn/ui `Button` and `Card`, TailwindCSS 3.4 semantic tokens, lucide-react, NextAuth.js (existing marketing header auth state)  
**Storage**: N/A (presentation-only feature; no persistence)  
**Testing**: Vitest + React Testing Library for landing-page component behavior, Playwright only if responsive anchor navigation needs browser validation  
**Target Platform**: Web application, responsive mobile/tablet/desktop landing page  
**Project Type**: Web application  
**Performance Goals**: Preserve current landing-page render profile, keep pricing content server-rendered, and avoid introducing client-side state for static marketing content  
**Constraints**: Must use existing semantic Tailwind tokens only, must preserve dark-theme coherence, must not create new API routes or Prisma changes, must keep footer links visible alongside pricing navigation  
**Scale/Scope**: One landing-page section, one FAQ block, one footer navigation addition, and small header/navigation alignment updates across existing marketing components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. TypeScript-First Development ✅
- **Status**: PASS
- **Verification**: The feature is limited to typed React component composition and shared view-model constants; no `any` usage is required.

### II. Component-Driven Architecture ✅
- **Status**: PASS
- **Verification**: The design fits `/home/runner/work/ai-board/ai-board/target/components/landing/` with Server Components by default and shadcn/ui primitives for CTA buttons and card shells.

### III. Test-Driven Development ✅
- **Status**: PASS
- **Verification**: The implementation can extend existing landing-page coverage with component tests for section order, CTA labels, FAQ copy, and footer anchor behavior; Playwright remains optional and only for browser-specific scroll validation.

### IV. Security-First Design ✅
- **Status**: PASS
- **Verification**: The feature introduces no form input, no new secrets, no data mutation, and no exposed sensitive data.

### V. Database Integrity ✅
- **Status**: PASS
- **Verification**: No Prisma schema, migration, or database query changes are required.

### VI. AI-First Development Model ✅
- **Status**: PASS
- **Verification**: All artifacts remain inside `/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/`; no root-level human documentation is introduced.

**Overall Gate Status**: ✅ **PASS**

## Project Structure

### Documentation (this feature)

```
/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── landing-pricing-contract.md
└── tasks.md
```

### Source Code (repository root)

```
/home/runner/work/ai-board/ai-board/target/app/
├── landing/
│   └── page.tsx                         # MODIFY: insert pricing section between workflow and CTA
└── page.tsx                            # UNCHANGED: continues to route unauthenticated users to landing page

/home/runner/work/ai-board/ai-board/target/components/
├── landing/
│   ├── pricing-section.tsx             # CREATE: section wrapper, heading, cards, FAQ
│   ├── pricing-card.tsx                # CREATE: reusable marketing plan card
│   └── pricing-faq.tsx                 # CREATE or inline helper: two-entry FAQ block
├── layout/
│   ├── header.tsx                      # MODIFY: add pricing anchor link to marketing navigation
│   └── footer.tsx                      # MODIFY: add pricing anchor link while preserving legal links
└── billing/
    └── pricing-cards.tsx               # REFERENCE ONLY: current subscription-management implementation, not reused directly

/home/runner/work/ai-board/ai-board/target/lib/
└── billing/
    └── plans.ts                        # REUSE: canonical plan names, prices, trial flags, and features

/home/runner/work/ai-board/ai-board/target/tests/
├── unit/components/                    # MODIFY/EXTEND: landing-page component coverage if present
└── e2e/                                # OPTIONAL: only if fragment navigation requires browser validation
```

**Structure Decision**: Use the existing Next.js web-app structure. Marketing pricing UI belongs under `/home/runner/work/ai-board/ai-board/target/components/landing/`, while source-of-truth plan metadata continues to live in `/home/runner/work/ai-board/ai-board/target/lib/billing/plans.ts`. No backend or data-layer expansion is needed.

## Complexity Tracking

*No constitution violations or justified exceptions are required.*

## Phase 0: Research & Technology Decisions

### Research Tasks

1. **Plan metadata source**
   - Determine whether landing pricing content should be hardcoded locally or derived from `/home/runner/work/ai-board/ai-board/target/lib/billing/plans.ts`.
2. **Marketing pricing component strategy**
   - Determine whether `/home/runner/work/ai-board/ai-board/target/components/billing/pricing-cards.tsx` can be reused or whether a dedicated landing component is cleaner.
3. **Anchor navigation pattern**
   - Confirm the lightest-weight pattern for header/footer navigation to `#pricing` while preserving accessibility and responsive behavior.
4. **FAQ source alignment**
   - Confirm the minimal BYOK and supported-agent copy from existing specifications and legal text so the landing FAQ does not drift from product behavior.

### Research Output

Phase 0 findings are documented in `/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/research.md`. All technical unknowns are resolved there; no `NEEDS CLARIFICATION` items remain.

## Phase 1: Design & Contracts

### Data Model

Phase 1 defines presentation-layer entities in `/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/data-model.md`:
- `PricingPlanCard`
- `PricingFaqEntry`
- `PricingAnchorLink`

These are UI view models only and do not imply new persisted records.

### API / Navigation Contracts

This feature adds no server API surface. The contract artifact at `/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/contracts/landing-pricing-contract.md` documents:
- existing landing route behavior for `GET /`
- reuse of the existing sign-in route for pricing CTAs
- in-page `#pricing` anchor navigation behavior from header and footer

### Quickstart

`/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/quickstart.md` captures:
- implementation touchpoints
- local validation workflow
- expected testing approach
- content update rules for pricing copy and FAQ

## Post-Design Constitution Check

### I. TypeScript-First Development ✅
- **Status**: PASS
- **Post-Design Verification**: Research and data model keep plan content typed around existing `SubscriptionPlan`-backed data, with no loose dynamic structures required.

### II. Component-Driven Architecture ✅
- **Status**: PASS
- **Post-Design Verification**: Dedicated landing components are preferred over reusing the client-side billing settings cards, which keeps responsibilities separated and avoids shipping unnecessary interactivity.

### III. Test-Driven Development ✅
- **Status**: PASS
- **Post-Design Verification**: The test plan favors component-level coverage first and reserves Playwright for any browser-only fragment-scroll assertions.

### IV. Security-First Design ✅
- **Status**: PASS
- **Post-Design Verification**: Contracts only reuse public routes and fragment navigation; no new input or privilege boundary is introduced.

### V. Database Integrity ✅
- **Status**: PASS
- **Post-Design Verification**: The data model remains presentation-only with no schema changes.

### VI. AI-First Development Model ✅
- **Status**: PASS
- **Post-Design Verification**: All generated design artifacts remain under the ticket spec directory and agent context update preserves existing agent guidance files.

**Final Gate Status**: ✅ **PASS**

## Phase 2 Status

Planning is complete through design artifacts only. `/home/runner/work/ai-board/ai-board/target/specs/AIB-278-add-pricing-section/tasks.md` is intentionally not created in this workflow step.
