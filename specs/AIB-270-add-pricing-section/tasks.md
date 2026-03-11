---
description: "Actionable, dependency-ordered tasks for AIB-270 Add pricing section to landing page & footer"
---

# Tasks: Add pricing section to landing page & footer

**Input**: Design documents under `specs/AIB-270-add-pricing-section/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Vitest component tests plus a Playwright smoke spec are required per plan.md and research.md.

**Organization**: Tasks are grouped by user story so each increment can be implemented and tested independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm environment + design context before modifying source

- [x] T001 Run `./.claude-plugin/scripts/bash/check-prerequisites.sh --json` to capture FEATURE_DIR and AVAILABLE_DOCS for traceability before editing. ✅ DONE
- [x] T002 Review `specs/AIB-270-add-pricing-section/{plan.md,spec.md,research.md,quickstart.md}` and log any blocking questions or open dependencies in `specs/AIB-270-add-pricing-section/checklists/requirements.md`. ✅ DONE

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the shared marketing scaffolding and content sources every story depends on

- [x] T003 Create `app/(marketing)/layout.tsx` route-group scaffold that accepts `children`, wraps them in `<div className="bg-[#1e1e2e] text-foreground min-h-screen">`, and prepares slots for `Header`/`Footer`. ✅ DONE
- [x] T004 Move `app/landing/page.tsx` to `app/(marketing)/landing/page.tsx` and relocate `app/legal/{terms,privacy}/page.tsx` into `app/(marketing)/{terms,privacy}/page.tsx`, removing the legacy `app/legal/` directory. ✅ DONE
- [x] T005 Update `app/layout.tsx` to stop rendering `<Footer />`, keeping shared providers intact so only the marketing layout controls footer visibility. ✅ DONE
- [x] T006 Create `lib/marketing/pricing-content.ts` exporting typed interfaces (`MarketingContent`, `PricingPlanContent`, `FAQEntry`, `FooterLink`) plus a stub `marketingContent` object wired for future plan/FAQ/footer data. ✅ DONE
- [x] T007 Add `hooks/use-marketing-route.ts` that exposes `isMarketingRoute` (checks pathname prefixes like `/landing`, `/terms`, `/privacy`) for any components that must branch on marketing surfaces. ✅ DONE

---

## Phase 3: User Story 1 – Compare plans and convert (Priority: P1) 🎯 MVP

**Goal**: Let visitors compare Free/Pro/Team plans on `/landing` and trigger the correct CTA flow.

**Independent Test**: Load `/landing`, scroll to pricing, confirm each card lists defined attributes and CTA clicks route to `/auth/signin` (Free) or `/auth/signin?callbackUrl=/settings/billing?plan={PRO|TEAM}` with billing page highlighting the requested plan.

### Tests for User Story 1 (write first)

- [x] T008 [P] [US1] Create `tests/unit/components/landing/pricing-section.test.tsx` with Vitest + RTL assertions for plan order, CTA hrefs, `data-analytics-id` hooks, disclaimer text, and fallback copy (start with failing cases). ✅ DONE
- [x] T009 [P] [US1] Add Playwright smoke coverage in `tests/e2e/marketing/pricing-section.spec.ts` to verify the Workflow → Pricing → CTA order plus CTA navigation + trial params at a 360px viewport. ✅ DONE

### Implementation for User Story 1

- [x] T010 [US1] Populate `marketingContent.plans`, `faqIntro`, and `disclaimer` inside `lib/marketing/pricing-content.ts` with Free/Pro/Team data (prices, feature bullets, CTA deep-link URLs, analytics IDs, and Catppuccin badge tones). ✅ DONE
- [x] T011 [US1] Implement `components/landing/pricing-card.tsx` (Server Component) using shadcn `Card` + `Button` to render plan details, limits summary, CTA button with `data-analytics-id`, and optional badge markup. ✅ DONE
- [x] T012 [US1] Implement `components/landing/pricing-section.tsx` to import `marketingContent`, render the section wrapper + cards grid, expose `data-testid="pricing-section"`, and pipe analytics IDs down to cards. ✅ DONE
- [x] T013 [US1] Insert `<PricingSection />` between `<WorkflowSection />` and `<CTASection />` in `app/(marketing)/landing/page.tsx`, ensuring the container inherits existing Catppuccin spacing and responsive behavior. ✅ DONE
- [x] T014 [US1] Enhance `app/settings/billing/page.tsx` to read the `plan` search param via `useSearchParams()`, highlight the matching `PricingCards` option, and display a 14-day trial banner before calling `handleSubscribe`. ✅ DONE

---

## Phase 4: User Story 2 – Resolve BYOK and agent support questions (Priority: P2)

**Goal**: Provide a compact FAQ under the pricing cards answering BYOK availability and supported agents.

**Independent Test**: Expand the FAQ items under pricing, confirm the BYOK answer states Pro (limited) and Team (full) coverage by default, and the supported agents item lists Claude, GPT-4 class, and Gemini Advanced while remaining accessible without touching other accordions.

### Tests for User Story 2 (write first)

- [x] T015 [P] [US2] Extend `tests/unit/components/landing/pricing-section.test.tsx` with FAQ cases asserting BYOK defaults to expanded, supported agents stays collapsed initially, and each trigger exposes the configured `data-analytics-id`. ✅ DONE

### Implementation for User Story 2

- [x] T016 [US2] Fill `marketingContent.faq` in `lib/marketing/pricing-content.ts` with BYOK and supported agents entries (ids, copy, defaultExpanded flags, analytics IDs). ✅ DONE
- [x] T017 [US2] Build `components/landing/faq.tsx` as a `"use client"` Radix Collapsible stack that renders each FAQEntry, applies `data-analytics-id` to triggers, and ensures keyboard accessibility. ✅ DONE
- [x] T018 [US2] Integrate `<Faq />`, intro text, and disclaimer stack into `components/landing/pricing-section.tsx` beneath the card grid with responsive spacing and mobile-first ordering. ✅ DONE

---

## Phase 5: User Story 3 – Access legal and repo links from any public page (Priority: P3)

**Goal**: Surface a shared footer on all marketing routes (`/landing`, `/terms`, `/privacy`) with legal links, GitHub link, and copyright.

**Independent Test**: Visit `/landing`, `/terms`, and `/privacy`, confirm the same footer renders with Terms/Privacy/GitHub links opening in new tabs, analytics IDs attached, and copyright text showing `© {currentYear} ai-board, Inc.` while authenticated routes remain footer-free.

### Tests for User Story 3 (write first)

- [x] T019 [P] [US3] Update `tests/unit/components/layout/footer.test.tsx` to read from `marketingContent.footerLinks`, assert Terms/Privacy/GitHub render with correct hrefs, `target="_blank"`/`rel="noopener noreferrer"`, analytics IDs, and copyright. ✅ DONE
- [x] T020 [P] [US3] Extend `tests/e2e/marketing/pricing-section.spec.ts` with footer checks that ensure `/landing`, `/terms`, and `/privacy` share the component while authenticated routes (e.g., `/projects/1/board`) omit it. ✅ DONE

### Implementation for User Story 3

- [x] T021 [US3] Populate `marketingContent.footerLinks` inside `lib/marketing/pricing-content.ts` (Terms, Privacy, GitHub) with `opensInNewTab`, `kind`, and analytics identifiers. ✅ DONE
- [x] T022 [US3] Refactor `components/layout/footer.tsx` to render links from `marketingContent.footerLinks`, add GitHub external link, enforce `target="_blank"` + `rel="noopener noreferrer"` when `opensInNewTab` is true, and emit `data-analytics-id` attributes. ✅ DONE
- [x] T023 [US3] Finalize `app/(marketing)/layout.tsx` to wrap marketing routes with `<Header />`, `<main>`, and the updated `<Footer />`, ensuring non-marketing layouts remain unaffected now that `app/layout.tsx` no longer renders the footer. ✅ DONE

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Repository-wide validation, documentation, and cleanup

- [x] T024 Run `bun run type-check && bun run lint` at repo root to ensure newly added marketing files pass strict TypeScript + ESLint gates. ✅ DONE
- [x] T025 Update `specs/AIB-270-add-pricing-section/quickstart.md` with any new dev/test entry points (e.g., marketing Playwright spec filters) discovered during implementation. ✅ DONE

---

## Dependencies & Execution Order

1. **Setup (Phase 1)** → required before touching source files.
2. **Foundational (Phase 2)** → depends on Setup; creates shared layout/config that every story uses.
3. **User Story 1 (Phase 3)** → depends on Phase 2; delivers the MVP pricing section and CTA deep-links.
4. **User Story 2 (Phase 4)** → depends on User Story 1 (uses same section) but can run in parallel with US3 once Phase 3 completes.
5. **User Story 3 (Phase 5)** → depends on Phase 2 and partially on US1 (shares marketing layout files); can execute alongside US2 after US1 merges.
6. **Polish (Phase 6)** → final verification after all required stories finish.

_Dependency graph_: Setup → Foundational → US1 → {US2 ∥ US3} → Polish.

---

## Parallel Execution Examples

- **US1**: Implement `components/landing/pricing-card.tsx` (T011) in parallel with populating `marketingContent.plans` (T010) once tests T008/T009 exist.
- **US2**: Build `components/landing/faq.tsx` (T017) while another agent wires the FAQ into `pricing-section.tsx` (T018) because they touch separate files.
- **US3**: Populate `marketingContent.footerLinks` (T021) concurrently with refactoring `components/layout/footer.tsx` (T022) after unit tests (T019) are drafted.

---

## Implementation Strategy

1. **MVP First**: Complete Phases 1–3 so the landing page shows pricing cards and deep-linked CTAs—this is the minimal shippable scope.
2. **Incremental Delivery**: Ship User Story 2 once FAQs render and pass tests, then deliver User Story 3 to roll out the shared footer without risking pricing regressions.
3. **Testing Cadence**: Keep Vitest suites green after each story, then run the Playwright smoke (`bun run test:e2e -- --grep marketing`) before the final polish tasks.
