# Implementation Plan: Health Dashboard - Workflow health-scan.yml

**Branch**: `AIB-372-health-dashboard-workflow` | **Date**: 2026-03-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-372-health-dashboard-workflow/spec.md`

## Summary

Create a generic `health-scan.yml` GitHub Actions workflow that orchestrates project health scans triggered by the ai-board API. The workflow handles 4 scan types (SECURITY, COMPLIANCE, TESTS, SPEC_SYNC) via a `scan_type` input parameter, clones the target repository, executes the appropriate ai-board health command via Claude/Codex, parses structured JSON reports, updates HealthScan status through the existing PATCH endpoint, and auto-generates grouped tickets for discovered issues. Follows the established speckit.yml workflow patterns for authentication, repo cloning, agent execution, and telemetry.

## Technical Context

**Language/Version**: YAML (GitHub Actions) + Bash shell scripts
**Primary Dependencies**: GitHub Actions, Claude Code CLI / Codex CLI, curl, jq
**Storage**: N/A (workflow calls existing API endpoints; no direct DB access)
**Testing**: Integration tests (Vitest) for API endpoints called by workflow; workflow itself tested via manual dispatch
**Target Platform**: GitHub Actions runners (ubuntu-latest)
**Project Type**: Web application (Next.js) — this feature adds a workflow file + minor API support
**Performance Goals**: Scan execution within GitHub Actions timeout (120 min max); status updates within seconds of transition
**Constraints**: Workflow must authenticate via WORKFLOW_API_TOKEN; no direct database access; must support both Claude and Codex agents
**Scale/Scope**: 4 scan types, single workflow file, reuses existing API infrastructure

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | No TypeScript code in workflow itself; existing API endpoints already typed |
| II. Component-Driven Architecture | PASS | No UI changes; workflow orchestration only |
| III. Test-Driven Development | PASS | Integration tests will verify API endpoints; workflow tested via dispatch |
| IV. Security-First Design | PASS | Uses WORKFLOW_API_TOKEN for auth; no secrets in logs; GH_PAT for repo access |
| V. Database Integrity | PASS | No direct DB access; all mutations go through validated API endpoints |
| V. Specification Clarification | PASS | All 5 auto-resolved decisions documented with CONSERVATIVE defaults |
| VI. AI-First Development | PASS | No README/guide files; workflow artifact in `.github/workflows/` |

**Gate Result**: PASS — No violations. Proceeding to Phase 0.

### Post-Design Re-Check (after Phase 1)

Research revealed the ticket creation endpoint needs workflow token auth support (see `research.md`, Task 1). This is a minor TypeScript change to an existing endpoint.

| Principle | Status | Impact |
|-----------|--------|--------|
| IV. Security-First | PASS | Uses existing `validateWorkflowAuth()` — constant-time comparison, same secret |
| I. TypeScript-First | PASS | New auth path is fully typed with existing interfaces |
| III. Test-Driven | PASS | Integration test planned for the new auth path |

**Post-design gate: PASS.** No constitution violations introduced by the design.

## Project Structure

### Documentation (this feature)

```
specs/AIB-372-health-dashboard-workflow/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: Research findings
├── data-model.md        # Phase 1: Entity/data model
├── quickstart.md        # Phase 1: Implementation quickstart
└── contracts/           # Phase 1: Workflow interface contracts
    └── health-scan-workflow.md
```

### Source Code (repository root)

```
.github/
├── workflows/
│   └── health-scan.yml          # NEW: Health scan workflow
└── scripts/
    └── run-agent.sh             # EXISTING: Unified agent runner (no changes)

app/api/projects/[projectId]/
├── health/
│   └── scans/
│       ├── route.ts             # EXISTING: Trigger scan (POST) + history (GET)
│       └── [scanId]/
│           └── status/
│               └── route.ts     # EXISTING: Update scan status (PATCH)
└── tickets/
    └── route.ts                 # EXISTING: Create tickets (POST)

lib/health/
├── scan-dispatch.ts             # EXISTING: Workflow dispatch (no changes)
├── report-schemas.ts            # EXISTING: Zod report schemas (no changes)
├── score-calculator.ts          # EXISTING: Score calculation (no changes)
└── types.ts                     # EXISTING: Type definitions (no changes)
```

**Structure Decision**: Single new workflow file (`.github/workflows/health-scan.yml`) following existing speckit.yml patterns. All API endpoints and libraries already exist. No new source code directories needed.

## Complexity Tracking

*No constitution violations to justify.*

## Testing Strategy

| User Story | Test Type | Location | Rationale |
|------------|-----------|----------|-----------|
| US1: Execute Full Health Scan | Integration | `tests/integration/health/` | API endpoint verification; no browser needed |
| US2: Real-Time Status Updates | Integration | `tests/integration/health/scan-status.test.ts` | Already exists; extend for telemetry fields |
| US3: Automatic Ticket Generation | Integration | `tests/integration/health/` | Verify ticket creation via API; no browser |
| US4: Incremental Scanning | Integration | `tests/integration/health/trigger-scan.test.ts` | Already tests baseCommit; extend if needed |
| US5: Telemetry Recording | Integration | `tests/integration/health/scan-status.test.ts` | Verify telemetry fields on COMPLETED transition |

**Notes**:
- Existing tests at `tests/integration/health/scan-status.test.ts` and `trigger-scan.test.ts` already cover core status transitions and scan triggering
- New tests needed primarily for ticket generation flow (workflow calls ticket API after scan completion)
- The workflow YAML itself is tested by manual dispatch — no automated workflow testing framework
- E2E tests NOT needed — all interactions are API-based
