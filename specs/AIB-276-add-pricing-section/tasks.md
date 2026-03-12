# Tasks: Add Pricing Section to Landing Page and Public Footer

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-276-add-pricing-section/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-276-add-pricing-section/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-276-add-pricing-section/spec.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-276-add-pricing-section/research.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-276-add-pricing-section/data-model.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-276-add-pricing-section/contracts/public-pages.md`

**Tests**: Vitest component and integration coverage is required by `/home/runner/work/ai-board/ai-board/target/specs/AIB-276-add-pricing-section/plan.md`.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel when the referenced files do not overlap and the dependency note allows it
- **[Story]**: Present only on user-story tasks (`[US1]`, `[US2]`, `[US3]`)
- Every task below includes an exact repository file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the shared static content source that all public marketing updates will consume

- [X] T001 Create the typed public marketing content module in `/home/runner/work/ai-board/ai-board/target/lib/config/public-site.ts` with exported interfaces for plan summaries, FAQ items, and footer links

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define the shared content and wiring constraints that block all user stories until complete

**⚠️ CRITICAL**: No user story work should begin until this phase is complete

- [X] T002 Populate `/home/runner/work/ai-board/ai-board/target/lib/config/public-site.ts` with the three plan definitions, CTA labels and hrefs, BYOK and supported-agent FAQ entries, and footer link metadata from the spec
- [X] T003 [P] Add or confirm shared export shapes in `/home/runner/work/ai-board/ai-board/target/lib/config/public-site.ts` so landing components and the global footer can consume one source of truth without inline copy duplication

**Checkpoint**: Shared public-site content is ready for landing and footer work

---

## Phase 3: User Story 1 - Compare plans on the landing page (Priority: P1) 🎯 MVP

**Goal**: Render Free, Pro, and Team plan cards on the landing page between the workflow and CTA sections

**Independent Test**: Visit `/landing` and confirm the pricing section appears after the workflow section and before the final CTA, with three plan cards, capability lists, and the expected CTA labels

### Tests for User Story 1

- [X] T004 [P] [US1] Create or extend the landing page component test in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/landing-page.test.tsx` to assert the three plan names, capability lists, CTA labels, and section ordering
- [X] T005 [P] [US1] Create the landing HTML integration test in `/home/runner/work/ai-board/ai-board/target/tests/integration/landing/public-marketing.test.ts` to assert pricing content is rendered on `GET /` between workflow and final CTA content

### Implementation for User Story 1

- [X] T006 [P] [US1] Create the reusable public plan card component in `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-card.tsx` using the shared plan-summary type from `/home/runner/work/ai-board/ai-board/target/lib/config/public-site.ts`
- [X] T007 [US1] Create the landing pricing section container in `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-section.tsx` to render all three plans from `/home/runner/work/ai-board/ai-board/target/lib/config/public-site.ts`
- [X] T008 [US1] Insert `PricingSection` between `WorkflowSection` and `CTASection` in `/home/runner/work/ai-board/ai-board/target/app/landing/page.tsx`

**Checkpoint**: User Story 1 is independently functional on the landing page

---

## Phase 4: User Story 2 - Resolve common pricing questions without leaving the page (Priority: P2)

**Goal**: Add a minimal FAQ directly beneath the pricing cards so visitors can answer BYOK and supported-agent questions in the same flow

**Independent Test**: Visit `/landing` and confirm a concise FAQ appears directly below the pricing cards with entries covering BYOK and supported agents

### Tests for User Story 2

- [X] T009 [US2] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/components/landing-page.test.tsx` to assert the FAQ heading, BYOK answer, and supported-agent answer render directly below the pricing cards
- [X] T010 [US2] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/landing/public-marketing.test.ts` to assert the landing HTML includes the FAQ topics beneath the pricing section

### Implementation for User Story 2

- [X] T011 [P] [US2] Create the pricing FAQ presentational component in `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-faq.tsx` using the shared FAQ item type from `/home/runner/work/ai-board/ai-board/target/lib/config/public-site.ts`
- [X] T012 [US2] Update `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-section.tsx` to render `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-faq.tsx` directly beneath the plan cards with mobile-safe spacing

**Checkpoint**: User Stories 1 and 2 both work independently within the landing pricing area

---

## Phase 5: User Story 3 - Access public legal and repository links from any public page (Priority: P3)

**Goal**: Extend the shared public footer so landing and legal pages expose Terms, Privacy, GitHub, and copyright content consistently

**Independent Test**: Visit `/landing`, `/legal/terms`, and `/legal/privacy` and confirm the same footer exposes Terms of Service, Privacy Policy, the external GitHub repository link, and copyright text

### Tests for User Story 3

- [X] T013 [P] [US3] Extend the footer component test in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/footer.test.tsx` to assert the GitHub repository link label, href, and external-link attributes alongside the legal links
- [X] T014 [P] [US3] Extend the legal-page integration test in `/home/runner/work/ai-board/ai-board/target/tests/integration/legal/pages.test.ts` to assert the shared footer links render on `GET /legal/terms` and `GET /legal/privacy`

### Implementation for User Story 3

- [X] T015 [US3] Update `/home/runner/work/ai-board/ai-board/target/components/layout/footer.tsx` to render Terms, Privacy, and GitHub links from `/home/runner/work/ai-board/ai-board/target/lib/config/public-site.ts` while preserving the existing dark marketing footer styling

**Checkpoint**: User Story 3 is independently functional across all public pages

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final responsive, accessibility, and verification work that affects multiple stories

- [X] T016 Refine responsive card and FAQ spacing in `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-section.tsx` so mobile and desktop layouts satisfy the no-horizontal-scroll requirement
- [X] T017 Verify external-link accessibility and visual consistency in `/home/runner/work/ai-board/ai-board/target/components/layout/footer.tsx` for the GitHub link styling and attributes
- [X] T018 Run the validation checklist in `/home/runner/work/ai-board/ai-board/target/specs/AIB-276-add-pricing-section/quickstart.md` against the completed implementation and reconcile any missed coverage in `/home/runner/work/ai-board/ai-board/target/specs/AIB-276-add-pricing-section/tasks.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies and starts immediately
- **Phase 2: Foundational** depends on Phase 1 and blocks all user stories because every story consumes `/home/runner/work/ai-board/ai-board/target/lib/config/public-site.ts`
- **Phase 3: US1** depends on Phase 2
- **Phase 4: US2** depends on Phase 2 and on the pricing-section shell from Phase 3 because the FAQ is rendered beneath the plan cards in the same section
- **Phase 5: US3** depends on Phase 2 but is otherwise independent from US1 and US2
- **Phase 6: Polish** depends on the completion of the user stories you plan to ship

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational and delivers the MVP pricing comparison experience
- **US2 (P2)**: Starts after Foundational, but should be scheduled after US1 because it extends `/home/runner/work/ai-board/ai-board/target/components/landing/pricing-section.tsx`
- **US3 (P3)**: Starts after Foundational and can run in parallel with US1 or US2 because it is isolated to footer files and legal-page verification

### Within Each User Story

- Test tasks are written before implementation and should fail before code changes begin
- Shared content config is completed before any component consumes it
- Presentational components are created before container or route integration changes
- Route composition changes happen after the required components exist

### Parallel Opportunities

- **Foundational**: `T003` can run in parallel with the final content population work in `T002` only if the shared type exports and content constants are edited in one coordinated pass
- **US1**: `T004`, `T005`, and `T006` can run in parallel because they target separate files
- **US2**: `T011` can run while test updates for `T009` and `T010` are prepared, but `T012` waits on `T011`
- **US3**: `T013` and `T014` can run in parallel, then `T015` wires the footer implementation

---

## Parallel Example: User Story 1

```bash
# Parallelize the first US1 test and component tasks:
Task: "T004 Create or extend /home/runner/work/ai-board/ai-board/target/tests/unit/components/landing-page.test.tsx"
Task: "T005 Create /home/runner/work/ai-board/ai-board/target/tests/integration/landing/public-marketing.test.ts"
Task: "T006 Create /home/runner/work/ai-board/ai-board/target/components/landing/pricing-card.tsx"
```

## Parallel Example: User Story 2

```bash
# Build the FAQ component while FAQ-specific assertions are being added:
Task: "T009 Extend /home/runner/work/ai-board/ai-board/target/tests/unit/components/landing-page.test.tsx"
Task: "T010 Extend /home/runner/work/ai-board/ai-board/target/tests/integration/landing/public-marketing.test.ts"
Task: "T011 Create /home/runner/work/ai-board/ai-board/target/components/landing/pricing-faq.tsx"
```

## Parallel Example: User Story 3

```bash
# Prepare footer coverage in parallel before the shared footer update:
Task: "T013 Extend /home/runner/work/ai-board/ai-board/target/tests/unit/components/footer.test.tsx"
Task: "T014 Extend /home/runner/work/ai-board/ai-board/target/tests/integration/legal/pages.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2 to establish `/home/runner/work/ai-board/ai-board/target/lib/config/public-site.ts`
2. Complete Phase 3 to add the pricing section and landing coverage
3. Validate the landing-page independent test before expanding scope

### Incremental Delivery

1. Deliver **US1** to ship the pricing comparison MVP
2. Add **US2** to reduce pre-signup pricing questions inside the same section
3. Add **US3** to complete public trust and navigation consistency across landing and legal pages
4. Finish with Phase 6 responsive and validation tasks

### Suggested MVP Scope

- **MVP**: Phase 1, Phase 2, and Phase 3 (`US1`) only

---

## Notes

- All tasks follow the required checklist format with checkbox, sequential task ID, optional `[P]`, required story labels for story phases, and exact file paths
- No database, API, billing, or Prisma tasks are included because the design artifacts explicitly scope this feature to static public marketing content
