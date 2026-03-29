# Implementation Plan: Health Dashboard - 4 Health Scan Commands

**Branch**: `AIB-373-health-dashboard-4` | **Date**: 2026-03-29 | **Spec**: `specs/AIB-373-health-dashboard-4/spec.md`
**Input**: Feature specification from `/specs/AIB-373-health-dashboard-4/spec.md`

## Summary

Update the 4 existing health scan command prompts (`health-security`, `health-compliance`, `health-tests`, `health-spec-sync`) so their documented output format precisely matches the Zod discriminated union schemas in `lib/health/report-schemas.ts`. Add comprehensive scan instructions, incremental scan support, score calculation guidance, and auto-fix workflow for tests. Add unit tests to validate command output against schemas.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0, Next.js 16
**Primary Dependencies**: Zod (schema validation), Prisma 6.x (data persistence), Claude Code (command execution)
**Storage**: PostgreSQL via Prisma — `HealthScan.report` stores JSON string
**Testing**: Vitest (unit + integration)
**Target Platform**: Linux CI (GitHub Actions workflow runner)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Incremental scans (with `--base-commit`) must complete in less than half the time of full scans (SC-006)
**Constraints**: Commands output ONLY valid JSON to stdout — no additional text (FR-015)
**Scale/Scope**: 4 command files to update, unit tests for output validation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | No TypeScript code changes; command prompts are Markdown. Unit tests will use strict types. |
| II. Component-Driven | PASS | No UI changes. Commands are backend-only (CLI prompts). |
| III. Test-Driven (NON-NEGOTIABLE) | PASS | Unit tests planned for schema validation and ticket grouping. |
| IV. Security-First | PASS | Security scan command enforces OWASP Top 10 detection. No secrets exposed. |
| V. Database Integrity | PASS | No schema changes. Commands don't interact with DB directly. |
| V. Specification Clarification Guardrails | PASS | Auto-resolved decisions documented in spec with trade-offs. |
| VI. AI-First Development | PASS | No README or tutorial files. All artifacts in `specs/` directory. |

### Post-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | Test fixtures use typed objects matching `ScanReport` interfaces. |
| II. Component-Driven | PASS | N/A — no UI changes. |
| III. Test-Driven | PASS | Tests verify command output validates against Zod schemas. Decision tree: pure validation → unit test. |
| IV. Security-First | PASS | Command prompts include comprehensive OWASP coverage checklist. |
| V. Database Integrity | PASS | No schema changes. |
| V. Spec Clarification | PASS | All auto-resolved decisions preserved in spec. |
| VI. AI-First | PASS | No documentation files outside specs/. |

## Project Structure

### Documentation (this feature)

```
specs/AIB-373-health-dashboard-4/
├── spec.md              # Feature specification (exists)
├── plan.md              # This file
├── research.md          # Phase 0 output — schema alignment research
├── data-model.md        # Phase 1 output — entity mapping
├── quickstart.md        # Phase 1 output — implementation guide
├── contracts/
│   └── command-output.md  # Phase 1 output — JSON output contract
└── tasks.md             # Phase 2 output (created by /ai-board.tasks)
```

### Source Code (files to modify)

```
.claude-plugin/commands/
├── ai-board.health-security.md      # UPDATE: Fix output format
├── ai-board.health-compliance.md    # UPDATE: Fix output format
├── ai-board.health-tests.md         # UPDATE: Fix output format
└── ai-board.health-spec-sync.md     # UPDATE: Fix output format

tests/unit/health/
└── command-output-validation.test.ts  # NEW: Validate sample outputs against Zod
```

**Structure Decision**: All changes are to existing command prompt files in `.claude-plugin/commands/`. One new test file for output validation. No new source code files, no infrastructure changes.

## Implementation Details

### Task 1: Update health-security command

**File**: `.claude-plugin/commands/ai-board.health-security.md`

**Changes**:
- Fix output format example: lowercase `severity` values (`high`/`medium`/`low`)
- Add `id` field to each issue (format: `sec-NNN`)
- Add `type: "SECURITY"` to report object
- Add `generatedTickets: []` to report
- Remove `summary` field from report (not in Zod schema)
- Add `category` field documentation (maps to security categories)
- Expand scan instructions with detailed OWASP patterns to check
- Add incremental scan instructions (use `git diff --name-only` for file list)
- Add score calculation guidance (HIGH: -15, MEDIUM: -8, LOW: -3, floor at 0)

### Task 2: Update health-compliance command

**File**: `.claude-plugin/commands/ai-board.health-compliance.md`

**Changes**:
- Add `id` field to each issue (format: `comp-{principle}-NNN`)
- Add `severity` field with mapping: HIGH for Security-First/Database-Integrity, MEDIUM for TypeScript-First/Test-Driven/Component-Driven, LOW for AI-First/style
- Add `type: "COMPLIANCE"` to report object
- Add `generatedTickets: []` to report
- Remove `summary` field from report
- Add constitution file discovery instructions (project-level → plugin fallback → error)
- Add per-principle scanning patterns (what to look for per principle)
- Add incremental scan instructions
- Add score calculation guidance

### Task 3: Update health-tests command

**File**: `.claude-plugin/commands/ai-board.health-tests.md`

**Changes**:
- Restructure report to use `autoFixed` and `nonFixable` arrays (not `issues`/`nonFixable`)
- Both arrays use `ReportIssue` schema (with `id`, `severity`, `description`, `file`, `line`)
- Add `type: "TESTS"` to report object
- Add `generatedTickets: []` to report
- Remove `summary` and `status` fields
- Add auto-fix workflow: detect test command → run tests → for each failure: attempt fix → re-run → commit if passes → report as nonFixable if fails
- Add `issuesFound = autoFixed.length + nonFixable.length`, `issuesFixed = autoFixed.length`
- Document that tests ALWAYS run full suite regardless of `--base-commit` (FR-005)
- Add individual commit instruction per auto-fix (per spec decision)
- Add score calculation (100 if all pass, proportional reduction per failure)

### Task 4: Update health-spec-sync command

**File**: `.claude-plugin/commands/ai-board.health-spec-sync.md`

**Changes**:
- Add `type: "SPEC_SYNC"` to report object
- Add `generatedTickets: []` to report
- Remove `summary` field from report
- Expand spec comparison instructions: list specific files in `specs/specifications/`
- Add bidirectional drift detection: code without spec AND spec without code
- Add incremental scan instructions (only check specs impacted by changed files)
- Add score calculation (100 if all synced, proportional reduction per drifted spec)
- Add `issuesFound = count of drifted specs`, `issuesFixed = 0`

### Task 5: Add unit tests for output validation

**File**: `tests/unit/health/command-output-validation.test.ts` (NEW)

**Test cases**:
- Valid SecurityReport passes Zod validation
- Valid ComplianceReport passes Zod validation
- Valid TestsReport passes Zod validation
- Valid SpecSyncReport passes Zod validation
- SecurityReport with uppercase severity FAILS validation (regression guard)
- Report missing `id` field FAILS validation
- `parseScanReport()` correctly parses each report type
- `groupIssuesIntoTickets()` produces correct tickets from each report type

**Test type**: Unit test (pure function validation, no API/DB)

## Testing Strategy

| User Story | Test Type | Test Location | What to Verify |
|------------|-----------|---------------|----------------|
| US1 Security Scan | Unit | `tests/unit/health/command-output-validation.test.ts` | SecurityReport validates against Zod; issues have id, lowercase severity, category |
| US2 Compliance | Unit | `tests/unit/health/command-output-validation.test.ts` | ComplianceReport validates; category maps to constitution principle |
| US3 Test Auto-Fix | Unit | `tests/unit/health/command-output-validation.test.ts` | TestsReport validates; autoFixed and nonFixable arrays use ReportIssue schema |
| US4 Spec Sync | Unit | `tests/unit/health/command-output-validation.test.ts` | SpecSyncReport validates; specs have status synced/drifted |
| Ticket grouping | Unit | `tests/unit/health/command-output-validation.test.ts` | `groupIssuesIntoTickets()` produces correct tickets per scan type |
| parseScanReport | Unit | `tests/unit/health/command-output-validation.test.ts` | Correctly parses valid JSON, returns null for invalid |

**Decision tree applied**:
- Pure validation functions → **Unit test** (Vitest)
- No API/DB involved → No integration tests needed for this ticket
- No browser interaction → No E2E tests needed

## Complexity Tracking

No constitution violations. All changes are to Markdown command prompt files and one new unit test file. No new abstractions, no new dependencies.
