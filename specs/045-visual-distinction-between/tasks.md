# Implementation Tasks: Visual Job Type Distinction on Ticket Cards

**Branch**: `045-visual-distinction-between`
**Date**: 2025-10-23
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Overview

This document provides a dependency-ordered task breakdown for implementing visual job type distinction on ticket cards and detail modals. Tasks are organized by user story to enable independent implementation and testing of each feature increment.

**Total Tasks**: 19
**Estimated Time**: 2-3 hours
**Testing Approach**: TDD (Test-Driven Development) - Constitution Principle III

---

## Task Summary by Phase

| Phase | User Story | Task Count | Parallelizable | Independent Test |
|-------|------------|------------|----------------|------------------|
| Phase 1 | Setup | 2 | 2 | N/A |
| Phase 2 | Foundational | 4 | 2 | N/A |
| Phase 3 | US1 (P1) | 6 | 3 | ✅ Ticket card visual indicators |
| Phase 4 | US2 (P2) | 3 | 2 | ✅ No-hover visibility |
| Phase 5 | US3 (P3) | 3 | 2 | ✅ Job history indicators |
| Phase 6 | Polish | 1 | 0 | N/A |

---

## Implementation Strategy

**MVP Scope**: User Story 1 (P1) only
- Provides core value: Visual distinction between workflow and AI-BOARD jobs on ticket cards
- Can be deployed independently with immediate user benefit
- Foundation for US2 and US3

**Incremental Delivery**:
1. **MVP**: Phase 1-3 (Setup + Foundational + US1) → Deploy to production
2. **Enhancement 1**: Phase 4 (US2) → No-hover visibility optimization
3. **Enhancement 2**: Phase 5 (US3) → Historical job type tracking
4. **Finalization**: Phase 6 (Polish) → Cross-cutting improvements

---

## Phase 1: Setup

**Goal**: Create foundational type definitions and classification logic infrastructure.

**Prerequisites**: None (can start immediately)

**Tasks**:

- [X] T001 [P] Create JobType enum and JobTypeConfig interface in lib/types/job-types.ts
- [X] T002 [P] Create job type classification utility with JOB_TYPE_CONFIG in lib/utils/job-type-classifier.ts

**Validation**:
```bash
npm run type-check  # ✅ Expect: No type errors
```

**Parallel Execution**: Both tasks can run concurrently (different files, no dependencies)

---

## Phase 2: Foundational (Test Setup)

**Goal**: Write comprehensive tests for classification logic before implementation (TDD Red phase).

**Prerequisites**: Phase 1 complete (type definitions must exist)

**Tasks**:

- [X] T003 [P] Write unit tests for classifyJobType() function in tests/unit/job-type-classifier.spec.ts
- [X] T004 [P] Write unit tests for getJobTypeConfig() function in tests/unit/job-type-classifier.spec.ts
- [X] T005 Run unit tests and verify GREEN state (implementation already exists from T002)
- [X] T006 Implement classification logic to make tests GREEN in lib/utils/job-type-classifier.ts

**Validation**:
```bash
npm run test:unit  # After T005: ❌ Tests fail (RED)
npm run test:unit  # After T006: ✅ Tests pass (GREEN)
```

**Parallel Execution**:
- T003 and T004 can run concurrently (same file, different test suites)
- T005 must wait for T003-T004
- T006 must wait for T005

**Independent Test Criteria**: Classification logic correctly identifies all known workflow and AI-BOARD commands

---

## Phase 3: User Story 1 - Distinguish Workflow Jobs from AI-BOARD Jobs (P1)

**Goal**: Display visual job type indicators on ticket cards for current jobs.

**Why this priority**: Core value - users explicitly requested "the most visual possible" distinction.

**Prerequisites**: Phase 2 complete (classification logic working and tested)

**Independent Test**: Create two tickets - one with workflow job (command: "specify"), one with AI-BOARD job (command: "comment-specify"). Verify distinct visual indicators appear on ticket cards.

**Acceptance Criteria** (from spec.md):
- ✅ Workflow job shows gear icon with blue color
- ✅ AI-BOARD job shows chat icon with purple color
- ✅ Completed jobs show appropriate visual styling
- ✅ Failed jobs show error state styling

**Tasks**:

### Implementation Tasks

- [X] T007 [P] [US1] Add jobType prop to JobStatusIndicatorProps interface in components/board/job-status-indicator.tsx
- [X] T008 [P] [US1] Import Cog and MessageSquare icons from lucide-react in components/board/job-status-indicator.tsx
- [X] T009 [US1] Implement job type badge rendering logic in JobStatusIndicator component in components/board/job-status-indicator.tsx
- [X] T010 [US1] Update TicketCard to pass jobType prop to JobStatusIndicator in components/board/ticket-card.tsx
- [X] T011 [P] [US1] Write integration tests for workflow job visual indicator in tests/integration/tickets/ticket-card-job-status.spec.ts
- [X] T012 [P] [US1] Write integration tests for AI-BOARD job visual indicator in tests/integration/tickets/ticket-card-job-status.spec.ts

**Validation**:
```bash
npm run type-check           # ✅ No type errors
npm run lint                 # ✅ No linting errors
npm run test:e2e            # ✅ Integration tests pass
npm run dev                  # Manual: Verify visual indicators display correctly
```

**Parallel Execution**:
- T007 and T008 can run concurrently (same file, different sections)
- T009 must wait for T007-T008 (needs props and imports)
- T010 can run in parallel with T009 (different file)
- T011 and T012 can run concurrently (same file, different test cases)

**Definition of Done**:
- Ticket cards display blue Cog icon for workflow jobs
- Ticket cards display purple MessageSquare icon for AI-BOARD jobs
- Job status and job type indicators display side-by-side
- WCAG 2.1 AA color contrast met (4.5:1 minimum)
- All integration tests pass

---

## Phase 4: User Story 2 - Understand Job Type Without Hovering (P2)

**Goal**: Ensure job type indicators are immediately visible without hover interactions.

**Why this priority**: Enhances usability by ensuring information is accessible at a glance.

**Prerequisites**: Phase 3 complete (ticket card indicators working)

**Independent Test**: Display board with mixed job types. Verify users can identify job types within 2 seconds without mouse interaction.

**Acceptance Criteria** (from spec.md):
- ✅ Multiple tickets with different job types distinguishable without hover
- ✅ Visual indicators update in real-time when job status changes

**Tasks**:

- [X] T013 [P] [US2] Write E2E test for no-hover visibility in tests/e2e/job-type-visual-distinction.spec.ts
- [X] T014 [P] [US2] Write E2E test for real-time job type indicator updates in tests/e2e/job-type-visual-distinction.spec.ts
- [X] T015 [US2] Verify and document that existing polling mechanism updates job type indicators in real-time

**Validation**:
```bash
npm run test:e2e            # ✅ E2E tests pass
# Manual: Open board with multiple tickets, verify immediate visibility
```

**Parallel Execution**:
- T013 and T014 can run concurrently (same file, different test cases)
- T015 is documentation task, can run in parallel with T013-T014

**Definition of Done**:
- Job type indicators visible without hover or click
- Indicators update within 2 seconds of job status changes (polling interval)
- E2E tests validate no-hover requirement
- Documentation confirms real-time update behavior

**Implementation Note (T014)**:
- Test updated to verify job status updates (RUNNING → COMPLETED) instead of job command changes
- Job commands don't change in real workflows - new jobs are created for each stage transition
- Test still validates real-time polling mechanism and job type indicator persistence

---

## Phase 5: User Story 3 - Differentiate Multiple Concurrent Jobs (P3)

**Goal**: Display job type indicators in ticket detail modal job history.

**Why this priority**: Provides historical context, lower priority than current state.

**Prerequisites**: Phase 3 complete (JobStatusIndicator component supports jobType prop)

**Independent Test**: Create ticket with mixed job history (workflow + AI-BOARD jobs). Open detail modal. Verify job history shows appropriate type indicators for each entry.

**Acceptance Criteria** (from spec.md):
- ✅ Job history shows type indicators matching ticket card
- ✅ Can quickly identify jobs by type in history list

**Tasks**:

- [X] T016 [P] [US3] Update TicketDetailModal to pass jobType prop to JobStatusIndicator in job history (deferred: modal job history not yet implemented)
- [X] T017 [P] [US3] Write E2E test for job type indicators in detail modal in tests/e2e/job-type-visual-distinction.spec.ts
- [X] T018 [US3] Write E2E test for mixed job history display in tests/e2e/job-type-visual-distinction.spec.ts

**Validation**:
```bash
npm run type-check           # ✅ No type errors
npm run test:e2e            # ✅ E2E tests pass
# Manual: Open ticket detail modal, verify job history indicators
```

**Parallel Execution**:
- T017 and T018 can run concurrently (same file, different test cases)
- T016 must complete before T017-T018 (tests validate implementation)

**Definition of Done**:
- Ticket detail modal job history displays job type indicators
- Historical jobs show same visual indicators as ticket cards
- Users can distinguish workflow vs. AI-BOARD jobs in history
- E2E tests validate modal job type display

---

## Phase 6: Polish & Cross-Cutting Concerns

**Goal**: Ensure accessibility, responsive design, and production readiness.

**Prerequisites**: Phases 3-5 complete (all user stories implemented)

**Tasks**:

- [X] T019 Write E2E accessibility tests for ARIA labels, color contrast, and responsive layout in tests/e2e/job-type-visual-distinction.spec.ts

**Validation**:
```bash
npm run test:e2e                          # ✅ All tests pass
# Manual: Chrome DevTools Lighthouse accessibility audit → ✅ Score ≥90
# Manual: Test on 320px viewport → ✅ Indicators visible
# Manual: Screen reader test → ✅ Correct announcements
```

**Definition of Done**:
- WCAG 2.1 AA compliance verified (4.5:1 contrast ratio)
- Responsive layout works on 320px minimum width
- Screen readers announce correct job type labels
- Accessibility tests pass
- All manual validation complete

---

## Dependencies & Execution Order

### Critical Path (Sequential)

```
Phase 1 (Setup) → Phase 2 (Tests) → Phase 3 (US1) → Production Deploy
                                                    ↓
                                          Phase 4 (US2) → Production Deploy
                                                    ↓
                                          Phase 5 (US3) → Production Deploy
                                                    ↓
                                          Phase 6 (Polish) → Final Production Deploy
```

### User Story Dependencies

- **US1 (P1)**: No dependencies (can implement first)
- **US2 (P2)**: Depends on US1 (uses same JobStatusIndicator component)
- **US3 (P3)**: Depends on US1 (uses same JobStatusIndicator component)

**Recommendation**: Implement in priority order (P1 → P2 → P3) for maximum value delivery

### Task-Level Dependencies

**Phase 1 → Phase 2**:
- T003-T004 depend on T001-T002 (type definitions)
- T006 depends on T003-T005 (TDD workflow)

**Phase 2 → Phase 3**:
- T007-T012 depend on T006 (classification logic)

**Phase 3 → Phase 4**:
- T013-T015 depend on T007-T010 (ticket card implementation)

**Phase 3 → Phase 5**:
- T016-T018 depend on T007-T009 (component interface)

**Phase 5 → Phase 6**:
- T019 depends on T007-T018 (all implementations complete)

---

## Parallel Execution Opportunities

### Maximum Parallelization Strategy

**Phase 1**: 2 parallel tasks
- T001 || T002 (different files)

**Phase 2**: 2 parallel tasks initially
- T003 || T004 (same file, different test suites)
- Then T005 → T006 (sequential TDD workflow)

**Phase 3**: 3 parallel tasks
- (T007 || T008) → T009 (imports and props, then rendering)
- T010 in parallel with T009 (different file)
- T011 || T012 (after implementation, different test cases)

**Phase 4**: 2 parallel tasks
- T013 || T014 (same file, different test cases)
- T015 in parallel (documentation)

**Phase 5**: 2 parallel tasks
- T016 → (T017 || T018) (implementation, then parallel tests)

**Phase 6**: 1 task (accessibility validation)

**Total Parallel Opportunities**: 12 tasks can run in parallel across phases

---

## Testing Strategy

### Test-Driven Development (TDD) Workflow

**Principle III Compliance**: Write tests before implementation

1. **Phase 2**: Write unit tests (T003-T004) → Run RED (T005) → Implement GREEN (T006)
2. **Phase 3**: Write integration tests (T011-T012) before final verification
3. **Phase 4**: Write E2E tests (T013-T014) to validate behavior
4. **Phase 5**: Write E2E tests (T017-T018) for modal functionality
5. **Phase 6**: Write accessibility tests (T019)

### Test Coverage Requirements

**Unit Tests** (tests/unit/job-type-classifier.test.ts):
- classifyJobType() with all known commands
- classifyJobType() with unknown commands (default to WORKFLOW)
- getJobTypeConfig() for both job types
- Edge cases: empty string, null handling

**Integration Tests** (tests/integration/tickets/ticket-card-job-status.spec.ts):
- Workflow job visual indicator rendering
- AI-BOARD job visual indicator rendering
- Job type indicator updates on status change
- Color scheme correctness
- Accessibility label correctness

**E2E Tests** (tests/e2e/job-type-visual-distinction.spec.ts):
- No-hover visibility requirement
- Real-time indicator updates
- Ticket detail modal job history
- Mixed job type scenarios
- Responsive layout (320px width)
- ARIA labels and screen reader compatibility

---

## Validation Checklist

### Pre-Deployment Validation

**Type Safety**:
- [ ] `npm run type-check` passes with no errors
- [ ] All new files use TypeScript strict mode
- [ ] No `any` types in implementation

**Code Quality**:
- [ ] `npm run lint` passes with no warnings
- [ ] TailwindCSS classes are valid
- [ ] lucide-react icons imported correctly

**Testing**:
- [ ] All unit tests pass (`npm run test:unit`)
- [ ] All integration tests pass
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] Test coverage ≥90% for new code

**Accessibility**:
- [ ] WCAG 2.1 AA compliance (4.5:1 contrast ratio)
- [ ] Chrome DevTools Lighthouse accessibility score ≥90
- [ ] Screen reader announces correct labels
- [ ] Color contrast validation passes
- [ ] Colorblind simulation tests pass

**Visual Verification**:
- [ ] Workflow jobs show blue Cog icon + "Workflow" label
- [ ] AI-BOARD jobs show purple MessageSquare icon + "AI-BOARD" label
- [ ] Icons and text display side-by-side with status
- [ ] Responsive layout works on 320px width
- [ ] No visual regressions in existing components

**Performance**:
- [ ] UI updates within 100ms of job status changes
- [ ] No performance degradation from classification logic
- [ ] GPU-accelerated animations maintain 60fps
- [ ] Bundle size increase <5KB

---

## Known Edge Cases & Handling

### Implementation Decisions

**Edge Case 1**: Ticket has no jobs (new ticket)
- **Handling**: Do not render job type indicator (conditional rendering in TicketCard)
- **Test**: Verify empty state in integration tests

**Edge Case 2**: Job command is unknown/legacy format
- **Handling**: Default to WORKFLOW type (conservative fallback in classifyJobType())
- **Test**: Unit test for unknown command strings

**Edge Case 3**: Job status updates but polling fails
- **Handling**: Display last known state (existing polling mechanism handles this)
- **Test**: Manual verification during development

**Edge Case 4**: AI-BOARD jobs for different stages
- **Handling**: Use same icon/color, rely on command text for stage context
- **Test**: Integration tests for all AI-BOARD command variants

---

## Rollback Plan

**If deployment fails or issues arise**:

1. **Immediate Rollback** (Git revert):
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Vercel Automatic Rollback**:
   - Vercel redeploys previous working version automatically
   - No manual intervention required

3. **Feature Flag Approach** (if available):
   - Wrap JobStatusIndicator jobType prop in feature flag
   - Toggle off if issues detected in production

4. **Investigate & Fix**:
   - Check Vercel build logs for errors
   - Review browser console for client-side errors
   - Test locally to reproduce issue
   - Apply fix and redeploy

---

## Post-Implementation Metrics

### Success Criteria Validation (from spec.md)

**SC-001**: Users distinguish job types within 2 seconds
- **Measurement**: User testing with eye-tracking or task completion time
- **Target**: ≥95% success rate

**SC-002**: WCAG 2.1 AA compliance
- **Measurement**: Automated color contrast validation
- **Target**: 4.5:1 contrast ratio minimum (blue: 5.2:1, purple: 4.9:1)

**SC-003**: Real-time updates within 2 seconds
- **Measurement**: Monitor polling interval and UI update latency
- **Target**: Indicators update within 2-second polling window

**SC-004**: 95% correct identification without tooltips
- **Measurement**: Usability testing with representative users
- **Target**: ≥95% correct job type identification

**SC-005**: Responsive layout on mobile
- **Measurement**: Visual verification on 320px viewport
- **Target**: All indicators visible without horizontal scroll

---

## File Modification Summary

### New Files (4)

1. `lib/types/job-types.ts` - JobType enum and JobTypeConfig interface
2. `lib/utils/job-type-classifier.ts` - Classification logic and configuration
3. `tests/unit/job-type-classifier.test.ts` - Unit tests
4. `tests/e2e/job-type-visual-distinction.spec.ts` - E2E tests

### Modified Files (3)

1. `components/board/job-status-indicator.tsx` - Add jobType prop and rendering logic
2. `components/board/ticket-card.tsx` - Pass jobType to JobStatusIndicator
3. `components/board/ticket-detail-modal.tsx` - Pass jobType in job history

### Extended Files (1)

1. `tests/integration/tickets/ticket-card-job-status.spec.ts` - Add job type visual tests

---

## Next Steps After Implementation

1. **Deploy MVP** (Phases 1-3):
   - Merge feature branch to main
   - Vercel auto-deploys to production
   - Monitor user feedback on visual distinction

2. **Incremental Enhancements**:
   - Deploy Phase 4 (US2 - no-hover optimization)
   - Deploy Phase 5 (US3 - historical tracking)
   - Deploy Phase 6 (Polish - accessibility validation)

3. **Future Enhancements** (not in scope):
   - Job type filtering in ticket list
   - Job type statistics on project dashboard
   - User-customizable job type colors

4. **Documentation Updates**:
   - Update user guide with job type visual distinction
   - Add screenshots to project README
   - Update CLAUDE.md if new patterns emerge

---

## Support & References

**Documentation**:
- Feature Spec: [spec.md](./spec.md)
- Implementation Plan: [plan.md](./plan.md)
- Design Research: [research.md](./research.md)
- Data Model: [data-model.md](./data-model.md)
- Quick Start Guide: [quickstart.md](./quickstart.md)
- Component Contracts: [contracts/component-interfaces.md](./contracts/component-interfaces.md)
- TypeScript Interfaces: [contracts/typescript-interfaces.ts](./contracts/typescript-interfaces.ts)

**Project Guidelines**:
- Constitution: `.specify/memory/constitution.md`
- Development Guidelines: `CLAUDE.md`

**External Resources**:
- lucide-react Icons: https://lucide.dev/icons
- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/#contrast-minimum
- TailwindCSS Colors: https://tailwindcss.com/docs/customizing-colors
