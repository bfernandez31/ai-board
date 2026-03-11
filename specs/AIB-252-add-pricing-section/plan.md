# Implementation Plan: AIB-252 Add Pricing Section

**Branch**: `AIB-252-add-pricing-section`
**Spec**: `specs/AIB-252-add-pricing-section/spec.md`
**Status**: Ready for BUILD

## Technical Context

| Aspect | Detail |
|--------|--------|
| Landing page | `app/landing/page.tsx` — Server Component with 4 sections (Hero, Features, Workflow, CTA) |
| Current section order | HeroSection → FeaturesGrid → WorkflowSection → CTASection |
| Pricing insertion point | Between WorkflowSection and CTASection |
| Existing billing plans | Free ($0), Pro ($15), Team ($30) — defined in `lib/billing/plans.ts` |
| Existing pricing component | `components/billing/pricing-cards.tsx` — authenticated context, not reusable for landing |
| Footer component | `components/layout/footer.tsx` — global via `app/layout.tsx`, has Terms + Privacy links |
| Collapsible component | `components/ui/collapsible.tsx` — Radix UI, available for FAQ |
| Header marketing nav | `components/layout/header.tsx` — has "Features" and "Workflow" anchor links |
| Sign-up path | `/auth/signin` |
| Design system | Catppuccin Mocha dark theme, primary violet `#8B5CF6` |
| Accordion installed? | No — using existing Collapsible primitive instead |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new components will be typed; no `any` types |
| II. Component-Driven | PASS | Using shadcn/ui Card/Button; feature folder `components/landing/` |
| III. Test-Driven | PASS | Vitest + RTL component tests; no E2E needed (no browser-required features) |
| IV. Security-First | PASS | No user input; static content; external link uses `rel="noopener noreferrer"` |
| V. Database Integrity | N/A | No database changes |
| VI. AI-First Development | PASS | No documentation files; implementation follows spec |

## Architecture Decisions

1. **Static plan data in component** rather than API fetch (see research.md R2)
2. **Collapsible for FAQ** rather than installing Accordion (see research.md R3)
3. **Enhance existing footer** rather than creating new component (see research.md R4)
4. **All CTAs link to `/auth/signin`** (see research.md R6)
5. **Add "Pricing" to header navigation** for discoverability (see research.md R7)

## Implementation Phases

### Phase 1: Pricing Section Component (P1 — FR-001 to FR-006, FR-012, FR-013)

**Files**:
- CREATE `components/landing/pricing-section.tsx`

**Details**:
- Server Component with `id="pricing"` for anchor linking
- Static array of 3 plan cards: Free, Pro, Team
- Responsive grid: `grid-cols-1 md:grid-cols-3`
- Each card: plan name, price, feature list with Check icons, CTA button
- Pro card: "Most Popular" badge, `border-[#8B5CF6]` highlight
- Free CTA: "Get Started" → `/auth/signin`
- Pro/Team CTA: "Start 14-day trial" → `/auth/signin`
- Dark theme styling consistent with existing landing sections

### Phase 2: FAQ Subsection (P2 — FR-007, FR-008)

**Files**:
- Part of `components/landing/pricing-section.tsx` or CREATE `components/landing/faq-section.tsx`

**Details**:
- Client Component (Collapsible requires interactivity)
- Uses `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from `components/ui/collapsible.tsx`
- 2 FAQ items:
  1. BYOK explanation
  2. Supported AI agents
- ChevronDown icon with rotation animation on expand
- Accessible: Radix handles aria-expanded automatically

### Phase 3: Landing Page Integration (P1 — FR-001)

**Files**:
- MODIFY `app/landing/page.tsx`

**Details**:
- Import PricingSection
- Insert between WorkflowSection and CTASection

### Phase 4: Footer Enhancement (P2 — FR-009, FR-010, FR-011)

**Files**:
- MODIFY `components/layout/footer.tsx`

**Details**:
- Add GitHub repository link to existing `<nav>` element
- `target="_blank"` and `rel="noopener noreferrer"` for external link
- Same styling as existing links

### Phase 5: Header Navigation Update

**Files**:
- MODIFY `components/layout/header.tsx`
- MODIFY `components/layout/mobile-menu.tsx` (if applicable)

**Details**:
- Add "Pricing" anchor link (`#pricing`) to marketing navigation
- Same pattern as existing "Features" and "Workflow" links

### Phase 6: Tests (Constitution III)

**Files**:
- CREATE `tests/unit/components/pricing-section.test.tsx`
- MODIFY `tests/unit/components/footer.test.tsx`

**Test Coverage**:
- PricingSection renders 3 plan cards with correct names and prices
- Pro card displays "Most Popular" badge
- CTA buttons have correct text ("Get Started" vs "Start 14-day trial")
- CTA buttons link to `/auth/signin`
- FAQ items expand/collapse on click
- Footer includes GitHub link with correct attributes
- Responsive layout verification (optional, via class assertions)

**Test Type Justification** (per Testing Trophy):
- Component tests (Vitest + RTL): Interactive UI with expand/collapse
- No integration tests: No API calls or database operations
- No E2E tests: No browser-required features (no auth, no drag-drop)

## File Summary

| File | Action | Phase |
|------|--------|-------|
| `components/landing/pricing-section.tsx` | CREATE | 1-2 |
| `app/landing/page.tsx` | MODIFY | 3 |
| `components/layout/footer.tsx` | MODIFY | 4 |
| `components/layout/header.tsx` | MODIFY | 5 |
| `components/layout/mobile-menu.tsx` | MODIFY | 5 |
| `tests/unit/components/pricing-section.test.tsx` | CREATE | 6 |
| `tests/unit/components/footer.test.tsx` | MODIFY | 6 |

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Plan data drifts from billing system | Add code comment referencing `lib/billing/plans.ts` as source of truth |
| GitHub URL not configured | Hardcode known URL; graceful if removed later |
| Collapsible lacks multi-item accordion behavior | Each FAQ item is independent; no need for "only one open" constraint |

## Dependencies

- No new npm packages
- No database migrations
- No API changes
- No environment variables
