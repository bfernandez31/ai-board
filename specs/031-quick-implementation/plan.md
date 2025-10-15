# Implementation Plan: Quick Implementation Workflow

**Branch**: `031-quick-implementation` | **Date**: 2025-01-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/031-quick-implementation/spec.md`

---

## Summary

The Quick Implementation feature introduces a fast-track workflow that allows tickets to transition directly from INBOX to BUILD, bypassing the SPECIFY and PLAN stages. This is designed for simple tasks (bug fixes, typo corrections, minor improvements) where formal documentation is unnecessary. The feature requires:

**Primary Requirements**:
1. Enable INBOX → BUILD drag-and-drop transition in kanban board
2. Display color-coded visual feedback during drag (blue SPECIFY, green BUILD, gray invalid)
3. Show mandatory confirmation modal before executing quick-impl transition
4. Create Job with command="quick-impl" and dispatch `.github/workflows/quick-impl.yml`
5. Preserve existing sequential workflow (INBOX → SPECIFY → PLAN → BUILD) with zero regression

**Technical Approach** (from research.md):
- **Backend**: Extend `isValidTransition()` with special case for INBOX → BUILD, modify transition logic to detect quick-impl mode and dispatch alternative workflow
- **Frontend**: Add modal confirmation component, implement visual drop zone feedback, preserve existing drag-and-drop behavior
- **Testing**: Extend existing test files (`ticket-transition.spec.ts`, `drag-drop.spec.ts`) with 11 new tests, following TDD red-green-refactor cycle
- **GitHub Workflows**: Clone `speckit.yml` to `quick-impl.yml`, extend `create-new-feature.sh` with `--mode` parameter

**Key Risk Mitigation**: Comprehensive test coverage (80%+) with test-first implementation to prevent regressions in normal workflow.

---

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS

**Primary Dependencies**:
- **Frontend**: Next.js 15 (App Router), React 18, @dnd-kit/core, shadcn/ui
- **Backend**: Prisma 6.x (PostgreSQL ORM), Zod 4.x (validation), @octokit/rest 22.0 (GitHub API)
- **Testing**: Playwright (E2E tests), Vitest (unit tests if created)

**Storage**: PostgreSQL 14+ (no schema changes required)
- Job.command VARCHAR supports "quick-impl" value
- Ticket.stage enum includes BUILD (no changes)
- Existing indexes support all queries

**Testing**: Playwright for E2E and API contract tests, following TDD red-green-refactor

**Target Platform**: Web application (desktop + mobile browsers)

**Project Type**: Web application (Next.js 15 App Router with frontend + backend)

**Performance Goals**:
- Visual feedback: <100ms (spec.md SC-002, FR-015)
- Drag latency: <100ms with optimistic updates (spec.md requirement)
- API response time: <200ms p95 (existing performance standard)

**Constraints**:
- Zero regression in existing workflow (spec.md SC-006)
- Modal must appear 100% of the time (spec.md FR-014, no "don't show again" option)
- Test coverage >80% for new logic (spec.md SC-015)
- Maintain optimistic concurrency control (version field, 409 conflict handling)

**Scale/Scope**:
- 11 new test cases across 3 test files (extend existing, not create)
- 5 backend modifications (lib/stage-validation.ts, lib/workflows/transition.ts)
- 6 frontend modifications (components/board/board.tsx) + 1 new modal component
- 1 new GitHub workflow, 1 modified script, 1 new Claude command

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**TypeScript-First Development** (Principle I): ✅ PASS
- All code uses TypeScript strict mode
- Existing types (Job, Ticket, Stage) support quick-impl without changes
- No `any` types introduced

**Component-Driven Architecture** (Principle II): ✅ PASS
- New modal component uses shadcn/ui Dialog (existing pattern)
- Board component modifications follow existing hook-based patterns
- Server Components by default (no new Client Components)

**Test-Driven Development** (Principle III): ✅ PASS
- Comprehensive test plan with red-green-refactor workflow (quickstart.md)
- Extends existing test files (no duplicates created)
- Test discovery workflow followed (research.md section 1.1)
- 11 new tests covering all requirements

**Security-First Design** (Principle IV): ✅ PASS
- No new input validation required (reuses existing Zod schemas)
- Uses Prisma parameterized queries exclusively
- No exposure of sensitive data in API responses

**Database Integrity** (Principle V): ✅ PASS
- No schema changes required (Job.command VARCHAR supports "quick-impl")
- Optimistic concurrency control preserved (ticket version field)
- No additional migrations needed

**Specification Clarification Guardrails** (Principle VI): ✅ PASS
- AUTO policy applied (high confidence 0.9)
- No fallback to CONSERVATIVE triggered
- All requirements clearly specified in spec.md

**Verdict**: ✅ ALL CONSTITUTION CHECKS PASS - No violations or exceptions needed

---

## Project Structure

### Documentation (this feature)

```
specs/031-quick-implementation/
├── spec.md                    # Feature specification (476 lines)
├── plan.md                    # This file (implementation plan)
├── research.md                # Phase 0: Test impact analysis (500+ lines)
├── data-model.md              # Phase 1: Entity definitions (400+ lines)
├── quickstart.md              # Phase 1: TDD implementation guide (600+ lines)
├── contracts/
│   └── transition-api.md      # API contract with quick-impl behavior
└── checklists/
    └── requirements.md        # Spec quality checklist (PASSED)
```

### Source Code (repository root)

```
# Web application structure (Next.js 15 App Router)

app/
├── api/
│   └── projects/[projectId]/tickets/[id]/
│       └── transition/
│           └── route.ts                    # [MODIFY] No changes (transparent to quick-impl)

components/
├── board/
│   ├── board.tsx                           # [MODIFY] Add modal state, visual feedback, quick-impl detection
│   └── quick-impl-modal.tsx                # [CREATE] New modal component using shadcn/ui Dialog
└── ui/
    └── dialog.tsx                          # [REUSE] Existing shadcn/ui component

lib/
├── stage-validation.ts                     # [MODIFY] Add INBOX → BUILD special case
└── workflows/
    └── transition.ts                       # [MODIFY] Add quick-impl detection, workflow dispatch, job validation skip

.github/
└── workflows/
    ├── speckit.yml                         # [UNCHANGED] Existing workflow
    └── quick-impl.yml                      # [CREATE] New workflow for quick-impl

.specify/
└── scripts/
    └── bash/
        └── create-new-feature.sh           # [MODIFY] Add --mode parameter

.claude/
└── commands/
    ├── speckit.specify.md                  # [UNCHANGED] Existing command
    └── quick-impl.md                       # [CREATE] New simplified command

tests/
├── unit/
│   └── stage-validation.spec.ts            # [CREATE] 6 new unit tests
├── api/
│   └── ticket-transition.spec.ts           # [MODIFY] Add 3 tests, modify 1 test
└── e2e/
    └── board/
        └── drag-drop.spec.ts               # [MODIFY] Add 2 tests, modify 1 test
```

**Structure Decision**: Follows existing web application structure with Next.js 15 App Router. All modifications extend existing files rather than creating parallel implementations. New files are minimal: 1 modal component, 1 workflow, 1 command, 1 unit test file.

---

## Complexity Tracking

*No violations - section intentionally empty (all constitution checks passed)*

---

## Phase 0: Research Summary

**Status**: ✅ COMPLETE (research.md)

**Key Findings**:
1. **Test Reuse Strategy**: All test modifications extend existing files, no new test files except `stage-validation.spec.ts` (unit tests)
2. **Zero Schema Changes**: Job.command VARCHAR supports "quick-impl", no migrations required
3. **Existing Infrastructure**: Job polling, branch assignment, optimistic concurrency all support quick-impl without changes
4. **Test Impact Analysis**: 11 new tests across 3 files (6 unit, 3 API, 2 E2E)

**Test Files Requiring Modification**:
- `tests/api/ticket-transition.spec.ts`: +3 tests, modify 1 test (split into 2)
- `tests/e2e/board/drag-drop.spec.ts`: +2 tests, modify 1 test
- `tests/unit/stage-validation.spec.ts`: +6 tests (NEW FILE)

**Test Files NOT Requiring Modification** (reuse existing coverage):
- `tests/integration/tickets/ticket-branch-assignment.spec.ts` ✓
- `tests/api/polling/job-status.spec.ts` ✓
- `tests/e2e/jobs/status-update.spec.ts` ✓

---

## Phase 1: Design Summary

### Data Model (data-model.md)

**Modified Entities**:
- **Job**: Add support for command="quick-impl" (VARCHAR field, no schema change)
- **Ticket**: Support INBOX → BUILD transition (Stage enum unchanged)

**Non-Persisted Entities**:
- **TransitionMode**: Conceptual entity computed during transition (`'normal' | 'quick-impl'`)
- **DropZoneVisualState**: Frontend React state for drag visual feedback

**Stage Transition State Machine** (updated):
```
INBOX ──→ SPECIFY ──→ PLAN ──→ BUILD ──→ VERIFY ──→ SHIP
  ↓                                ↑
  └───────── Quick-Impl ───────────┘
```

**Validation Changes**:
- INBOX → BUILD: INVALID → **VALID** (quick-impl special case)
- SPECIFY → BUILD: INVALID → INVALID (unchanged)
- Job validation for INBOX → BUILD: **SKIPPED** (no prior job exists)

---

### API Contracts (contracts/transition-api.md)

**Endpoint**: `POST /api/projects/:projectId/tickets/:id/transition`

**No Breaking Changes**: Quick-impl is additive only, transparent to API consumers

**Quick-Impl Detection** (internal logic):
```typescript
const isQuickImpl = currentStage === Stage.INBOX && targetStage === Stage.BUILD;
```

**Behavior Differences**:
| Aspect | Normal Mode | Quick-Impl Mode |
|--------|-------------|-----------------|
| Command | `STAGE_COMMAND_MAP[targetStage]` | `"quick-impl"` |
| Workflow | `speckit.yml` | `quick-impl.yml` |
| Job Validation | Enforced (feature 030) | **Skipped** (no prior job) |
| Workflow Inputs | Standard | +`ticketTitle`, +`ticketDescription` |

---

### Implementation Guide (quickstart.md)

**TDD Workflow**:
1. **Phase 1: Backend Tests** (Red → Green)
   - Create unit tests for stage validation (6 tests) → FAIL
   - Implement `isValidTransition()` logic → PASS
   - Add API tests for quick-impl (3 tests) → FAIL
   - Implement transition logic (5 changes) → PASS

2. **Phase 2: Frontend Tests** (Red → Green)
   - Add visual feedback test → FAIL
   - Add modal confirmation test → FAIL
   - Implement modal component + board logic → PASS

3. **Phase 3: Integration & Regression** (Green)
   - Run full test suite → ALL PASS
   - Verify test coverage >80%

4. **Phase 4: GitHub Workflow & Script** (Manual testing)
   - Create `quick-impl.yml` workflow
   - Modify `create-new-feature.sh` script
   - Create `/quick-impl` command

5. **Phase 5: Documentation** (Final)
   - Update `CLAUDE.md` with usage instructions

---

## Implementation Checklist

### Backend Implementation

#### Stage Validation (lib/stage-validation.ts)
- [ ] Create `tests/unit/stage-validation.spec.ts` (6 unit tests)
- [ ] Run tests → expect ALL FAIL
- [ ] Add INBOX → BUILD special case in `isValidTransition()` (lines 68-71):
  ```typescript
  export function isValidTransition(fromStage: Stage, toStage: Stage): boolean {
    // Special case: Quick-impl allows INBOX → BUILD
    if (fromStage === Stage.INBOX && toStage === Stage.BUILD) {
      return true;
    }

    // Default: Sequential validation
    const nextStage = getNextStage(fromStage);
    return nextStage === toStage;
  }
  ```
- [ ] Run tests → expect ALL PASS

#### Transition Logic (lib/workflows/transition.ts)
- [ ] Add 3 tests to `tests/api/ticket-transition.spec.ts` (quick-impl suite)
- [ ] Modify 1 existing test (split into 2 tests: INBOX → PLAN, SPECIFY → BUILD)
- [ ] Run tests → expect NEW TESTS FAIL
- [ ] Modify `handleTicketTransition()` function:
  - [ ] Add quick-impl detection (after line 180):
    ```typescript
    const isQuickImpl = currentStage === Stage.INBOX && targetStage === Stage.BUILD;
    ```
  - [ ] Skip job validation for quick-impl (modify lines 182-186):
    ```typescript
    if (!isQuickImpl) {
      const jobValidation = await validateJobCompletion(ticket, targetStage);
      if (!jobValidation.success) {
        return jobValidation;
      }
    }
    ```
  - [ ] Override command (modify line 189):
    ```typescript
    const command = isQuickImpl ? 'quick-impl' : STAGE_COMMAND_MAP[targetStage];
    ```
  - [ ] Override workflow file (modify line 261):
    ```typescript
    workflow_id: isQuickImpl ? 'quick-impl.yml' : 'speckit.yml',
    ```
  - [ ] Add quick-impl inputs (after line 237):
    ```typescript
    if (isQuickImpl) {
      workflowInputs.ticketTitle = ticket.title;
      workflowInputs.ticketDescription = ticket.description;
    }
    ```
- [ ] Run tests → expect ALL PASS

---

### Frontend Implementation

#### Modal Component (components/board/quick-impl-modal.tsx)
- [ ] Add visual feedback test to `drag-drop.spec.ts`
- [ ] Add modal confirmation test to `drag-drop.spec.ts`
- [ ] Run tests → expect NEW TESTS FAIL
- [ ] Create modal component file:
  - [ ] Import shadcn/ui Dialog components
  - [ ] Implement QuickImplModal interface (open, onConfirm, onCancel props)
  - [ ] Add warning message explaining trade-offs
  - [ ] Add "Cancel" and "Proceed" buttons with data-action attributes
  - [ ] Add data-testid="quick-impl-modal" for tests

#### Board Component (components/board/board.tsx)
- [ ] Import QuickImplModal component
- [ ] Add modal state:
  ```typescript
  const [pendingTransition, setPendingTransition] = useState<{
    ticket: TicketWithVersion;
    targetStage: Stage;
  } | null>(null);
  ```
- [ ] Add drag state for visual feedback:
  ```typescript
  const [isDragging, setIsDragging] = useState(false);
  const [dragSource, setDragSource] = useState<Stage | null>(null);
  ```
- [ ] Add handleDragStart callback:
  ```typescript
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setIsDragging(true);
    setDragSource(event.active.data.current?.stage);
  }, []);
  ```
- [ ] Modify handleDragEnd callback:
  ```typescript
  // Detect quick-impl
  if (ticket.stage === 'INBOX' && targetStage === 'BUILD') {
    setPendingTransition({ ticket, targetStage });
    return; // Wait for modal
  }
  ```
- [ ] Add modal confirmation handlers:
  ```typescript
  const handleQuickImplConfirm = async () => {
    if (!pendingTransition) return;
    await executeTransition(pendingTransition.ticket, pendingTransition.targetStage);
    setPendingTransition(null);
  };

  const handleQuickImplCancel = () => {
    setPendingTransition(null);
  };
  ```
- [ ] Add visual feedback function:
  ```typescript
  const getDropZoneStyle = (stage: Stage) => {
    if (!isDragging || dragSource !== 'INBOX') return '';

    if (stage === 'SPECIFY') {
      return 'border-blue-400 bg-blue-50 border-dashed border-2';
    }
    if (stage === 'BUILD') {
      return 'border-green-400 bg-green-50 border-dashed border-2';
    }
    if (['PLAN', 'VERIFY', 'SHIP'].includes(stage)) {
      return 'opacity-50';
    }
    return '';
  };
  ```
- [ ] Update DndContext with onDragStart
- [ ] Add QuickImplModal component to JSX
- [ ] Apply visual feedback styles to columns
- [ ] Run tests → expect ALL PASS

---

### GitHub Workflows & Scripts

#### Quick-Impl Workflow (.github/workflows/quick-impl.yml)
- [ ] Copy `speckit.yml` to `quick-impl.yml`
- [ ] Update inputs: add ticketTitle, ticketDescription (remove command choice)
- [ ] Update create-new-feature.sh call:
  ```yaml
  run: |
    .specify/scripts/bash/create-new-feature.sh \
      --mode=quick-impl \
      "${{ github.event.inputs.ticketTitle }}"
  ```
- [ ] Update Claude command call:
  ```yaml
  run: |
    npx claude-code /quick-impl
  ```
- [ ] Test workflow manually via GitHub Actions UI

#### Feature Creation Script (.specify/scripts/bash/create-new-feature.sh)
- [ ] Add MODE variable at beginning: `MODE="specify"`
- [ ] Add argument parsing for --mode parameter:
  ```bash
  while [[ $# -gt 0 ]]; do
    case $1 in
      --mode)
        MODE="$2"
        shift 2
        ;;
      *)
        FEATURE_DESCRIPTION="$1"
        shift
        ;;
    esac
  done
  ```
- [ ] Add conditional template selection after branch creation:
  ```bash
  if [ "$MODE" = "quick-impl" ]; then
    # Minimal spec.md template
    cat > "$SPEC_FILE" <<EOF
  # Quick Implementation: ${FEATURE_DESCRIPTION}
  ...
  EOF
  else
    # Full spec template (existing behavior)
    cp .specify/templates/spec-template.md "$SPEC_FILE"
  fi
  ```
- [ ] Test script with `--mode=quick-impl` parameter

#### Claude Command (.claude/commands/quick-impl.md)
- [ ] Copy structure from `speckit.specify.md`
- [ ] Simplify workflow:
  - Remove clarification policy handling
  - Skip quality checklist generation
  - Focus on direct implementation from title + description
- [ ] Add warning for complex tasks
- [ ] Keep TDD emphasis (write tests before implementation)

---

### Documentation

#### CLAUDE.md Updates
- [ ] Add "Quick Implementation Workflow" section
- [ ] Add workflow comparison table (Normal vs Quick-Impl)
- [ ] Add usage instructions (drag-and-drop + modal)
- [ ] Add "When to Use" vs "When NOT to Use" guidelines
- [ ] Add technical details (job command, workflow file, script mode)
- [ ] Add example tickets (good vs bad candidates)

---

### Testing & Validation

#### Unit Tests
- [ ] Run `npx playwright test tests/unit/stage-validation.spec.ts`
- [ ] Verify all 6 tests pass
- [ ] Check test coverage for stage-validation.ts (100% expected)

#### API Tests
- [ ] Run `npx playwright test tests/api/ticket-transition.spec.ts`
- [ ] Verify all existing + 3 new tests pass
- [ ] Verify no regressions in job completion validation tests

#### E2E Tests
- [ ] Run `npx playwright test tests/e2e/board/drag-drop.spec.ts`
- [ ] Verify all existing + 2 new tests pass
- [ ] Verify visual feedback test passes (color classes visible)
- [ ] Verify modal confirmation test passes (cancel + proceed flows)

#### Full Regression Test
- [ ] Run `npx playwright test`
- [ ] Verify ALL tests pass (no regressions)
- [ ] Generate test coverage report
- [ ] Verify test coverage >80% for new code

---

### Success Criteria Validation

#### Functional Success (spec.md SC-001 to SC-005)
- [ ] SC-001: Users can drag INBOX → BUILD (100% success rate)
- [ ] SC-002: Modal appears within 100ms
- [ ] SC-003: Visual feedback displays correctly (verified via visual regression)
- [ ] SC-004: Quick-impl workflow completes within 5 minutes (95th percentile)
- [ ] SC-005: Job status updates propagate within 2 seconds

#### Compatibility Success (spec.md SC-006 to SC-009)
- [ ] SC-006: Zero regression in existing INBOX → SPECIFY → PLAN → BUILD workflow
- [ ] SC-007: Optimistic updates + version conflict handling work identically
- [ ] SC-008: Authentication + project ownership validation apply to quick-impl
- [ ] SC-009: Job status polling works for quick-impl jobs

#### User Experience Success (spec.md SC-010 to SC-013)
- [ ] SC-010: Modal cancellation rate <30% (indicates clear understanding)
- [ ] SC-011: Quick-impl success rate matches normal workflow (>95%)
- [ ] SC-012: Users identify quick-impl capability without documentation
- [ ] SC-013: Error messages clearly explain failures and recovery steps

#### Technical Success (spec.md SC-014 to SC-018)
- [ ] SC-014: Code follows project conventions (TypeScript strict, Prisma types, Zod validation)
- [ ] SC-015: Test coverage >80% for new logic
- [ ] SC-016: E2E tests pass for quick-impl workflow
- [ ] SC-017: Git commits use conventional format (feat:, fix:, docs:) with #031 reference
- [ ] SC-018: CLAUDE.md updated with quick-impl workflow documentation

---

## Phase 2: Task Generation

**Next Step**: Execute `/speckit.tasks` to generate detailed task breakdown with:
- Task dependencies (unit tests → implementation → E2E tests)
- Acceptance criteria per task
- Test coverage requirements per task
- Estimated complexity per task

**Input Files** (already created):
- ✅ spec.md (feature specification)
- ✅ research.md (test impact analysis)
- ✅ data-model.md (entity definitions)
- ✅ contracts/transition-api.md (API contract)
- ✅ quickstart.md (TDD implementation guide)
- ✅ plan.md (this file)

---

## Plan Complete

**Status**: ✅ COMPLETE
**Ready for Tasks**: YES
**Test Strategy**: TDD red-green-refactor with 11 new tests
**Risk Level**: LOW (comprehensive test coverage, zero schema changes)
