# Tasks: Capture and Display Agent Execution Logs

**Input**: Design documents from `/specs/AIB-721-copy-of-capture/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks are included by default (constitution). Tests are written FIRST and must FAIL before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Data Layer)

**Purpose**: Schema migration, type definitions, and Prisma client generation. All subsequent phases depend on this.

- [x] T001 Add LogStatus enum (`NONE`, `AVAILABLE`, `PRUNED`), JobLog model, and extend Job model with `logStatus`, `logSummary`, `jobLog` relation in `prisma/schema.prisma`. Drop unused `logs` column from Job.
- [x] T002 Run Prisma migration (`bunx prisma migrate dev --name add-job-logs`) and regenerate client (`bunx prisma generate`)
- [x] T003 [P] Create `lib/logs/types.ts` with `NormalizedLogEntry`, `LogEventType`, `LogUploadPayload`, `JobLogResponse` type definitions per data-model.md
- [x] T004 [P] Update `lib/types/job-types.ts` — add `logStatus` (LogStatus) and `logSummary` (string | null) to `TicketJobWithTelemetry` interface

**Checkpoint**: Schema compiles, `bun run type-check` passes, Prisma client regenerated with new types.

---

## Phase 2: Foundational (Log Processing + API + Workflow Capture)

**Purpose**: Core infrastructure that ALL user stories depend on — agent output parsing, log upload/retrieval API, and workflow capture scripts.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Unit Tests (write first, ensure they FAIL)

- [x] T005 [P] Create `tests/unit/log-parser.test.ts` — test `parseAgentOutput()` for all 4 agent types (CLAUDE, CODEX, MISTRAL, GEMINI), verify NormalizedLogEntry output, test fallback behavior when parsing fails
- [x] T006 [P] Create `tests/unit/log-summarizer.test.ts` — test `generateLogSummary()` for FAILED (error extraction), COMPLETED (milestone count), and CANCELLED (entry count + last entry) job statuses, verify max 2000-char output
- [x] T007 [P] Create `tests/unit/log-truncator.test.ts` — test `truncateOutput()` for under-limit (no-op), at-limit, and over-limit inputs, verify first-25%/last-25% boundary preservation and truncation marker insertion

### Log Processing Implementation

- [x] T008 [P] Create `lib/logs/log-parser.ts` — implement `parseAgentOutput(rawOutput, agentType)` with agent-specific parsers (`parseClaudeOutput`, `parseCodexOutput`, `parseMistralOutput`, `parseGeminiOutput`) and fallback to single `message` entry on parse failure (FR-015)
- [x] T009 [P] Create `lib/logs/log-summarizer.ts` — implement `generateLogSummary(entries, jobStatus)` returning error summary for FAILED, milestone summary for COMPLETED, cancellation summary for CANCELLED, capped at 2000 characters
- [x] T010 [P] Create `lib/logs/log-truncator.ts` — implement `truncateOutput(rawOutput, maxBytes)` returning `{ content, truncated }` with first-25%/last-25% preservation and `--- [TRUNCATED: original size X bytes] ---` marker (FR-013)

### API Integration Tests (write first)

- [x] T011 Create `tests/integration/jobs/job-logs.test.ts` — test POST /api/jobs/:id/logs (workflow auth, Zod validation, idempotency on duplicate upload, 5MB size limit, job-not-found 404), test GET /api/jobs/:id/logs (session auth, project access check, AVAILABLE/NONE/PRUNED status responses, 404/410 codes)

### API Endpoint Implementation

- [x] T012 Create `app/api/jobs/[id]/logs/route.ts` — POST handler (workflow auth via `validateWorkflowAuth`, Zod body validation, parse → summarize → truncate → Prisma transaction creating JobLog + updating Job.logStatus/logSummary, idempotent 200 on existing log) and GET handler (session auth via `requireAuth`, project access via `verifyProjectAccess`, return full JobLogResponse or 404/410 based on logStatus)

### Existing API Updates

- [x] T013 [P] Update `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` — add `logStatus` to the Prisma select clause (line ~131) so job telemetry responses include log availability status

### Workflow Capture Scripts

- [x] T014 Modify `.github/scripts/run-agent.sh` — define `LOG_CAPTURE_FILE=/tmp/agent-output-$$.log`, wrap each `invoke_*` function's agent command through `tee "$LOG_CAPTURE_FILE"` (Claude line ~384, Codex line ~508, Mistral line ~663, Gemini line ~736), export `LOG_CAPTURE_FILE` for subsequent workflow steps
- [x] T015 [P] Create `.github/scripts/upload-agent-logs.sh` — read `LOG_CAPTURE_FILE`, validate non-empty, JSON-encode raw output via `jq`, POST to `${APP_URL}/api/jobs/${JOB_ID}/logs` with `WORKFLOW_API_TOKEN` auth, handle failure gracefully (log warning, exit 0 per FR-015)

### Workflow Modifications

- [x] T016 [P] Add "Upload Agent Logs" step to `.github/workflows/speckit.yml` — after "Execute Spec-Kit Command" step, before status update steps, with `if: always()` and non-blocking failure handling
- [x] T017 [P] Add "Upload Agent Logs" step to `.github/workflows/quick-impl.yml` — after agent execution, before status update, with `if: always()` and non-blocking failure handling
- [x] T018 [P] Add "Upload Agent Logs" step to `.github/workflows/verify.yml` — after agent execution, before status update, with `if: always()` and non-blocking failure handling
- [x] T019 [P] Add "Upload Agent Logs" step to `.github/workflows/iterate.yml` — after agent execution, before status update, with `if: always()` and non-blocking failure handling

**Checkpoint**: Foundation ready — unit tests pass for parsers/summarizer/truncator, integration tests pass for API endpoints, workflow scripts in place. User story implementation can now begin.

---

## Phase 3: User Story 1 — View Log Summary After Job Failure (Priority: P1) 🎯 MVP

**Goal**: When a job fails, users see an inline error summary in the timeline and can drill into full logs without needing GitHub Actions access.

**Independent Test**: Trigger a job that fails, verify the timeline shows an inline error summary, and the full log is accessible via a "View full logs" action.

### Tests for User Story 1
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**
**RULE (constitution): Extend existing test files where applicable. Create new only when no existing file covers the domain.**

- [x] T020 [P] [US1] Create `tests/unit/components/log-preview.test.tsx` — test LogPreview renders error summary for FAILED status in `text-red-500`, milestone summary for COMPLETED in `text-muted-foreground`, "Logs expired" for PRUNED, and hides for NONE status (no existing component test covers this domain)
- [x] T021 [P] [US1] Create `tests/unit/components/log-viewer.test.tsx` — test LogViewer dialog renders log entries chronologically, shows loading skeleton, handles error/pruned/empty states, displays truncation indicator banner when `truncated === true` (no existing component test covers this domain)

### Implementation for User Story 1

- [x] T022 [P] [US1] Create `components/logs/log-entry-row.tsx` — render individual log entry with timestamp, event type icon (lucide-react: MessageSquare/Wrench/AlertCircle/ArrowRight), and content text with `font-mono text-sm` for code/error, color-coded by event type using Tailwind palette classes
- [x] T023 [P] [US1] Create `components/logs/log-preview.tsx` — render condensed inline preview: error text in `text-red-500` for FAILED, milestone summary in `text-muted-foreground` for COMPLETED, "Logs expired" in `text-subtext0` for PRUNED, hidden for NONE (FR-014)
- [x] T024 [US1] Create `app/lib/hooks/queries/use-job-logs.ts` — TanStack Query hook `useJobLogs(jobId, enabled)` fetching GET `/api/jobs/${jobId}/logs`, lazy-loaded (only when dialog opens), no polling (logs are immutable)
- [x] T025 [US1] Create `components/logs/log-viewer.tsx` — shadcn Dialog with `aurora-dialog-overlay` styling, header showing job command display name + agent type badge + timestamp, scrollable body rendering LogEntryRow list, loading skeleton, error/pruned/empty states, truncation indicator banner (FR-013)
- [x] T026 [US1] Modify `components/timeline/job-event-timeline-item.tsx` — for completion events, render `<LogPreview>` below status line, add "View full logs" Button (variant="link" size="sm") when `logStatus === 'AVAILABLE'` that opens LogViewer dialog

### Integration Test Extensions for User Story 1

- [x] T027 [P] [US1] Extend `tests/integration/tickets/timeline.test.ts` — verify `logSummary` and `logStatus` fields appear in timeline response for jobs with uploaded logs
- [x] T028 [P] [US1] Extend `tests/integration/jobs/ticket-jobs.test.ts` — verify `logStatus` field appears in ticket jobs telemetry response

**Checkpoint**: User Story 1 fully functional — failed job shows inline error preview in timeline, "View full logs" opens detailed log viewer. Independently testable.

---

## Phase 4: User Story 2 — Review Completed Job Execution Details (Priority: P2)

**Goal**: After a successful job, users can review what the agent did — tool invocations, decisions, and milestones — building confidence in agent behavior.

**Independent Test**: Complete a successful job, verify the log shows the full sequence of agent actions with timestamps and tool invocations in a consistent format regardless of agent type.

### Tests for User Story 2
**RULE: Extend existing test files — do not create new files for this domain.**

- [x] T029 [US2] Extend `tests/integration/jobs/job-logs.test.ts` — add completed job scenarios: upload log for a COMPLETED job, verify milestone summary in logSummary, verify GET returns chronologically ordered entries with tool_invocation events, verify consistent format across all 4 agent types
- [x] T030 [US2] Extend `tests/unit/log-summarizer.test.ts` — add COMPLETED-specific scenarios: verify summary includes tool invocation count, key milestones, and completion message

**Checkpoint**: User Stories 1 AND 2 both work independently — failed jobs show error summaries, completed jobs show milestone summaries. Format is consistent across agent types.

---

## Phase 5: User Story 3 — Logs Persist Beyond Workflow Retention (Priority: P3)

**Goal**: Logs remain available after GitHub Actions retention expires (14 days), with automatic pruning after 30 days that preserves job telemetry.

**Independent Test**: Verify logs captured 30+ days ago are pruned (content removed), but job telemetry (tokens, cost, duration, tools, quality score) is preserved. Logs under 30 days are unaffected.

### Tests for User Story 3
**RULE: Extend existing test files — do not create new files for this domain.**

- [ ] T031 [US3] Extend `tests/integration/jobs/job-logs.test.ts` — add pruning scenarios: logs older than 30 days are deleted in batches, Job.logStatus set to PRUNED, Job.logSummary set to null, job telemetry fields preserved, logs under 30 days unaffected, GET returns 410 for pruned logs

### Implementation for User Story 3

- [ ] T032 [US3] Create `lib/logs/prune-expired-logs.ts` — implement `pruneExpiredLogs(retentionDays)` returning `{ pruned, errors }`, find JobLog records where job's completedAt < now - retentionDays, delete in batches of 100, update Job.logStatus to PRUNED and logSummary to null for each pruned record
- [ ] T033 [US3] Create `app/api/cron/prune-logs/route.ts` — POST handler with CRON secret auth, call `pruneExpiredLogs(30)`, return summary JSON with pruned count, errors, and durationMs

**Checkpoint**: All pruning logic verified — expired logs removed, telemetry preserved, CRON endpoint operational.

---

## Phase 6: User Story 4 — Cancelled Job Logs (Priority: P3)

**Goal**: When a job is cancelled, partial logs are captured showing what the agent accomplished before interruption, helping users understand partial state.

**Independent Test**: Cancel a running job, verify partial logs are captured and viewable with a clear cancellation indicator.

### Tests for User Story 4
**RULE: Extend existing test files — do not create new files for this domain.**

- [ ] T034 [US4] Extend `tests/integration/jobs/job-logs.test.ts` — add cancelled job scenarios: upload partial output for a CANCELLED job, verify summary indicates cancellation with entry count, verify GET returns partial entries
- [ ] T035 [US4] Extend `tests/unit/log-summarizer.test.ts` — add CANCELLED-specific scenarios: verify summary format "Cancelled after N entries" with last entry content

**Checkpoint**: All four job statuses (FAILED, COMPLETED, CANCELLED, and no-log NONE) are handled correctly end-to-end.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification and integration with existing test suites.

- [ ] T036 [P] Extend `tests/integration/jobs/status.test.ts` — verify Job.logStatus reflects correctly after log upload (NONE → AVAILABLE transition) and that status endpoint behavior is unaffected by log feature
- [ ] T037 Run full verification: `bun run type-check`, `bun run lint`, `bun run test:unit`, `bun run test:integration` — fix any regressions or cross-cutting issues

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational phase completion
  - US1 (Phase 3): Can start after Phase 2
  - US2 (Phase 4): Can start after Phase 2 (independent of US1, but shares UI components built in US1)
  - US3 (Phase 5): Can start after Phase 2 (fully independent — separate infrastructure)
  - US4 (Phase 6): Can start after Phase 2 (independent of US1, but shares UI components built in US1)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories. Builds all UI components.
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) — Independent, but if run after US1, leverages the same UI components with no additional work.
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) — Fully independent. No UI components, no overlap with other stories.
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) — Independent, but if run after US1, leverages the same UI components with no additional work.

### Within Each Phase

- Tests MUST be written and FAIL before implementation
- Types/models before services
- Services before endpoints
- Core implementation before UI integration
- Story complete before moving to next priority

### Parallel Opportunities

- Phase 1: T003 and T004 can run in parallel (after T002)
- Phase 2: T005, T006, T007 can run in parallel (unit test creation)
- Phase 2: T008, T009, T010 can run in parallel (log processing implementation)
- Phase 2: T015, T016, T017, T018, T019 can run in parallel (workflow scripts/modifications)
- Phase 3: T020, T021 can run in parallel (component test creation)
- Phase 3: T022, T023 can run in parallel (component implementation)
- Phase 3: T027, T028 can run in parallel (integration test extensions)
- After Phase 2: US1, US3 can run in parallel (no shared files)

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Group 1 — Launch all unit tests together (different files, no deps):
Task T005: "Create tests/unit/log-parser.test.ts"
Task T006: "Create tests/unit/log-summarizer.test.ts"
Task T007: "Create tests/unit/log-truncator.test.ts"

# Group 2 — Launch all implementations together (different files, no deps):
Task T008: "Create lib/logs/log-parser.ts"
Task T009: "Create lib/logs/log-summarizer.ts"
Task T010: "Create lib/logs/log-truncator.ts"

# Group 3 — Launch all workflow modifications together (different files):
Task T016: "Add log upload step to speckit.yml"
Task T017: "Add log upload step to quick-impl.yml"
Task T018: "Add log upload step to verify.yml"
Task T019: "Add log upload step to iterate.yml"
```

## Parallel Example: User Story 1

```bash
# Group 1 — Launch component tests together:
Task T020: "Create tests/unit/components/log-preview.test.tsx"
Task T021: "Create tests/unit/components/log-viewer.test.tsx"

# Group 2 — Launch leaf components together (no inter-dependencies):
Task T022: "Create components/logs/log-entry-row.tsx"
Task T023: "Create components/logs/log-preview.tsx"

# Group 3 — Launch integration test extensions together:
Task T027: "Extend tests/integration/tickets/timeline.test.ts"
Task T028: "Extend tests/integration/jobs/ticket-jobs.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema + types)
2. Complete Phase 2: Foundational (parsers, API, workflows)
3. Complete Phase 3: User Story 1 — View Log Summary After Job Failure
4. **STOP and VALIDATE**: Test US1 independently — upload a log, verify timeline preview, open full log viewer
5. Deploy/demo if ready — users can already diagnose failed jobs from the UI

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (**MVP!** — failed job diagnosis)
3. Add User Story 2 → Test independently → Deploy/Demo (completed job review)
4. Add User Story 3 → Test independently → Deploy/Demo (30-day retention + pruning)
5. Add User Story 4 → Test independently → Deploy/Demo (cancelled job clarity)
6. Each story adds value without breaking previous stories

### Parallel Execution Strategy

ai-board can execute user stories in parallel after Foundational:

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, stories can run in parallel:
   - Parallel track A: User Story 1 (UI components — builds shared UI)
   - Parallel track B: User Story 3 (Pruning — fully independent infrastructure)
3. After US1 completes: User Stories 2 and 4 (leverage US1's UI, thin test-extension tasks)
4. Polish phase after all stories complete

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All file paths verified against current repository state (2026-04-23)
- Existing test files (status.test.ts, timeline.test.ts, ticket-jobs.test.ts) are EXTENDED, not duplicated
- New test files created only for domains with no existing coverage (log-parser, log-summarizer, log-truncator, log-preview, log-viewer)
