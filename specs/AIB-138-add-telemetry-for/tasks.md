# Tasks: Add Telemetry for Ticket Source on Compare

**Input**: Design documents from `/specs/AIB-138-add-telemetry-for/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests ARE requested per spec and plan.md (III. Test-Driven principle marked as Required)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: This feature modifies existing files only. No new project structure or dependencies needed.

- [X] T001 Verify BRANCH environment variable pattern in existing workflow

**Checkpoint**: Environment confirmed - ready for implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core changes to fetch-telemetry.sh that enable both user stories

**Note**: No blocking prerequisites needed. The existing script and test infrastructure are already in place.

**Checkpoint**: Foundation ready - user story implementation can begin

---

## Phase 3: User Story 1 - Complete Telemetry in Comparison Report (Priority: P1)

**Goal**: Include source ticket telemetry in `.telemetry-context.json` alongside compared tickets

**Independent Test**: Run `@ai-board /compare #KEY1` from a ticket with completed jobs. Verify the resulting `.telemetry-context.json` includes telemetry for the source ticket with `sourceTicket` metadata field.

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T002 [US1] Add schema validation test for sourceTicket field in tests/unit/telemetry/context-file-schema.test.ts
- [X] T003 [P] [US1] Add test for source ticket present in tickets object in tests/unit/telemetry/context-file-schema.test.ts
- [X] T004 [P] [US1] Add test for source ticket with no data (hasData: false) in tests/unit/telemetry/context-file-schema.test.ts
- [X] T005 [P] [US1] Add test for deduplication when source is in compare list in tests/unit/telemetry/context-file-schema.test.ts

### Implementation for User Story 1

- [X] T006 [US1] Extract source ticket key from BRANCH env var in .github/scripts/fetch-telemetry.sh (after line 35)
- [X] T007 [US1] Add source ticket to tickets list if not already present in .github/scripts/fetch-telemetry.sh
- [X] T008 [US1] Add sourceTicket metadata field to TELEMETRY_JSON initialization in .github/scripts/fetch-telemetry.sh (line 45)

**Checkpoint**: At this point, User Story 1 should be fully functional - `.telemetry-context.json` includes source ticket telemetry with `sourceTicket` field

---

## Phase 4: User Story 2 - Source Identification in Report (Priority: P2)

**Goal**: Source ticket clearly identifiable in comparison report with "(source)" label

**Independent Test**: Generate a comparison report and verify the source ticket row includes "(source)" identifier in the telemetry table.

### Tests for User Story 2

**NOTE**: No additional tests needed. The compare.md command already has logic to identify source ticket via BRANCH extraction (Step 3a). Report template already supports "(source)" labels.

### Implementation for User Story 2

**NOTE**: Per research.md Q5, the compare command already has logic to identify source ticket via BRANCH (Step 3a). The telemetry context file extension is transparent to the command. No implementation tasks needed for this story - the `sourceTicket` metadata from US1 enables this functionality automatically.

- [X] T009 [US2] Verify compare.md uses BRANCH extraction for source identification in .claude/commands/compare.md

**Checkpoint**: At this point, User Story 2 should be functional - source ticket appears with "(source)" label in comparison reports

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verification and validation

- [X] T010 Run tests to verify all schema tests pass: bun run test:unit tests/unit/telemetry/
- [X] T011 Run quickstart.md validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - verification only
- **Foundational (Phase 2)**: N/A - existing infrastructure sufficient
- **User Story 1 (Phase 3)**: Tests first (T002-T005), then implementation (T006-T008)
- **User Story 2 (Phase 4)**: Depends on User Story 1 completion (needs sourceTicket field)
- **Polish (Phase 5)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start immediately - Core feature
- **User Story 2 (P2)**: Depends on US1 (needs sourceTicket metadata for identification)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Schema tests before implementation changes
- Script changes in sequence (extract → add to list → add metadata)

### Parallel Opportunities

- Tests T003, T004, T005 can run in parallel (same file but different test cases)
- T006, T007, T008 must be sequential (same file, dependent changes)

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all test additions together (after T002):
Task: "Add test for source ticket present in tickets object"
Task: "Add test for source ticket with no data (hasData: false)"
Task: "Add test for deduplication when source is in compare list"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup verification (T001)
2. Complete Phase 3: User Story 1 tests (T002-T005)
3. Complete Phase 3: User Story 1 implementation (T006-T008)
4. **STOP and VALIDATE**: Run tests to verify schema validation passes
5. Deploy/demo if ready

### Incremental Delivery

1. Complete US1 tests + implementation → Source ticket telemetry in JSON
2. Complete US2 verification → Source ticket labeled in reports
3. Complete Polish → All tests pass

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tasks** | 11 |
| **User Story 1 Tasks** | 7 (4 tests + 3 implementation) |
| **User Story 2 Tasks** | 1 (verification only) |
| **Setup/Polish Tasks** | 3 |
| **Parallel Opportunities** | 3 (T003, T004, T005) |
| **Files Modified** | 2 (.github/scripts/fetch-telemetry.sh, tests/unit/telemetry/context-file-schema.test.ts) |
| **MVP Scope** | User Story 1 (T001-T008) |

---

## Notes

- [P] tasks = different files or independent test cases, no dependencies
- [Story] label maps task to specific user story for traceability
- Minimal change scope: only 2 files need modification
- No database changes, no API changes, no component changes
- Backward compatible: sourceTicket field is additive
- Commit after each task or logical group
