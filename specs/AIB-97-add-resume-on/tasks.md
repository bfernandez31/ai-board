# Tasks: Implementation Summary Output

**Input**: Design documents from `/specs/AIB-97-add-resume-on/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Not requested - no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and template creation

- [X] T001 [P] Create summary template file at `.specify/templates/summary-template.md` with structure: Header (feature name, branch, date, spec link), Changes Summary section, Key Decisions section, Files Modified section, Manual Requirements section with warning icon

---

## Phase 2: User Story 1 - Generate Implementation Summary (Priority: P1)

**Goal**: After `/speckit.implement` completes, automatically generate a `summary.md` file in the feature's spec folder capturing implementation outcomes.

**Independent Test**: Run `/speckit.implement` on a feature with tasks and verify a `summary.md` file is created in the spec folder with content under 2300 characters.

### Implementation for User Story 1

- [X] T002 [US1] Modify `/speckit.implement` command at `.claude/commands/speckit.implement.md` to add Step 10: Summary Generation after completion validation (Step 9)

Step 10 instructions to add:
1. Read the summary template from `.specify/templates/summary-template.md`
2. Generate summary content with:
   - Feature name extracted from spec.md header
   - Current git branch
   - Current date (YYYY-MM-DD)
   - Brief description of what was implemented (max 500 chars)
   - Key technical decisions made during implementation (max 500 chars)
   - List of key files created/modified (max 500 chars)
   - Manual requirements section with warning icon, or "None" if fully automated (max 300 chars)
3. Ensure total content does not exceed 2300 characters
4. Write the generated summary to `FEATURE_DIR/summary.md`
5. Report summary file creation and character count

- [X] T003 [US1] Add summary generation handling for partial implementation failures in `.claude/commands/speckit.implement.md` - ensure summary is generated even when implementation fails partway, capturing progress and failure point

**Checkpoint**: At this point, User Story 1 should be fully functional - `/speckit.implement` generates summary.md automatically

---

## Phase 3: User Story 2 - Template-Based Formatting (Priority: P2)

**Goal**: Ensure all implementation summaries follow a consistent template structure with required sections.

**Independent Test**: Verify generated summaries contain all required template sections (Header, Changes Summary, Key Decisions, Files Modified, Manual Requirements).

### Implementation for User Story 2

- [X] T004 [US2] Ensure summary generation step in `.claude/commands/speckit.implement.md` explicitly follows template structure and includes all required sections even if content is "None"

**Checkpoint**: At this point, all summaries follow consistent template format with all sections present

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Validation and documentation

- [X] T005 Run quickstart.md validation - verify example output matches actual generated format
- [X] T006 Verify character limit enforcement - confirm instructions produce summaries under 2300 characters

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **User Story 1 (Phase 2)**: Depends on T001 (template must exist before being referenced)
- **User Story 2 (Phase 3)**: Depends on Phase 2 completion (builds on summary generation)
- **Polish (Phase 4)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Setup (T001)
- **User Story 2 (P2)**: Depends on User Story 1 completion

### Within Each User Story

- Core implementation before edge case handling
- Story complete before moving to next priority

### Parallel Opportunities

- T001 can run independently
- T002 and T003 are sequential (both modify same file)
- T005 and T006 can run in parallel (both are validation tasks)

---

## Parallel Example: Setup Phase

```bash
# T001 can run immediately as it creates a new file:
Task: "Create summary template file at .specify/templates/summary-template.md"
```

## Parallel Example: Polish Phase

```bash
# Launch validation tasks together:
Task: "Run quickstart.md validation"
Task: "Verify character limit enforcement"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: User Story 1 (T002, T003)
3. **STOP and VALIDATE**: Test `/speckit.implement` generates summary.md
4. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup → Template created
2. Add User Story 1 → Test summary generation → Deploy/Demo (MVP!)
3. Add User Story 2 → Verify template compliance → Deploy/Demo
4. Polish → Validation complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- This feature is minimal: 1 new file (template), 1 modified file (implement command)
- SC-005 requires changes under 30 lines - keep additions concise
