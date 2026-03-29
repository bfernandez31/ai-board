# Implementation Plan: Health Scan Commands (security, compliance, tests, spec-sync)

**Branch**: `AIB-378-copy-of-health` | **Date**: 2026-03-29 | **Spec**: `specs/AIB-378-copy-of-health/spec.md`
**Input**: Feature specification from `/specs/AIB-378-copy-of-health/spec.md`

## Summary

Implement the 4 health scan command skills (`health-security`, `health-compliance`, `health-tests`, `health-spec-sync`) that execute as Claude Code commands via the `health-scan.yml` workflow. Each command analyzes a target repository and produces a structured JSON report consumable by the workflow for status updates and remediation ticket creation. The commands are defined as `.claude-plugin/commands/ai-board.health-*.md` instruction files; this plan covers the supporting execution scripts that parse arguments, run the analysis, and format the JSON output.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Bash (workflow runner scripts), Node.js 22.20.0
**Primary Dependencies**: Claude Code CLI (command execution), Vitest (test runner for health-tests), Zod (report schema validation), Prisma 6.x (schema introspection for spec-sync)
**Storage**: N/A — commands produce JSON stdout; no direct database access (workflow handles persistence)
**Testing**: Vitest (unit tests for report formatting, argument parsing; integration tests for command output validation)
**Target Platform**: GitHub Actions runner (ubuntu-latest) via Claude Code CLI
**Project Type**: Web application (Next.js monolith) — commands are plugin skills executed against any target repo
**Performance Goals**: Each scan completes within Claude Code CLI timeout; JSON output parseable by existing `report-schemas.ts` Zod schemas
**Constraints**: Output must match existing `ScanReport` discriminated union types in `lib/health/types.ts`; commands receive `--base-commit` and `--head-commit` as arguments; health-tests always runs full suite (no incremental); static command mapping only (no dynamic construction)
**Scale/Scope**: 4 command instruction files (already exist), 4 supporting bash runner scripts (new), unit tests for output format validation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | Runner scripts are bash (required for CLI execution), but all typed utilities use strict TypeScript; report schemas validated via Zod |
| II. Component-Driven | PASS | No UI components — command execution only |
| III. Test-Driven | PASS | Unit tests validate each command's JSON output against report schemas; integration tests verify end-to-end command execution |
| IV. Security-First | PASS | Security scan itself enforces OWASP checks; no user input beyond commit SHAs (validated format); no secrets in output |
| V. Database Integrity | PASS | Commands do not access database directly — workflow handles all persistence via existing API endpoints |
| V. Spec Clarification | PASS | AUTO → CONSERVATIVE decisions documented in spec (5 auto-resolved decisions) |
| VI. AI-First | PASS | No documentation files; command files are plugin skills in `.claude-plugin/commands/` |

**Gate Result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```
specs/AIB-378-copy-of-health/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── scan-command-output.ts
└── tasks.md             # Phase 2 output (via /ai-board.tasks)
```

### Source Code (repository root)

```
.claude-plugin/commands/
├── ai-board.health-security.md        # EXISTING: Security scan instruction file
├── ai-board.health-compliance.md      # EXISTING: Compliance scan instruction file
├── ai-board.health-tests.md           # EXISTING: Tests scan instruction file
└── ai-board.health-spec-sync.md       # EXISTING: Spec sync scan instruction file

.claude-plugin/scripts/bash/
└── run-agent.sh                       # EXISTING: CLI wrapper that executes commands

lib/health/
├── types.ts                           # EXISTING: ScanReport discriminated union types
├── report-schemas.ts                  # EXISTING: Zod schemas for report validation
├── scan-commands.ts                   # EXISTING: Static scan type → command mapping
├── ticket-creation.ts                 # EXISTING: Remediation ticket grouping logic
├── score-calculator.ts                # EXISTING: Global score calculation
└── scan-dispatch.ts                   # EXISTING: Workflow dispatch

tests/
├── unit/health/
│   ├── scan-commands.test.ts          # EXISTING: Command mapping tests
│   ├── report-schemas.test.ts         # EXISTING: Report parsing tests
│   ├── score-calculator.test.ts       # EXISTING: Score calculation tests
│   └── ticket-creation.test.ts        # EXISTING: Ticket grouping tests
└── integration/health/
    ├── scan-status.test.ts            # EXISTING: Status transition tests
    └── scan-status-tickets.test.ts    # EXISTING: Ticket creation flow tests
```

**Structure Decision**: The health scan commands are Claude Code skills — they execute as AI instructions, not as traditional code. The `.claude-plugin/commands/ai-board.health-*.md` files ARE the implementation. The supporting infrastructure (types, schemas, ticket creation, workflow) is already built by AIB-377. This ticket ensures the command instruction files are complete, accurate, and produce output that matches the existing typed schemas.

## Implementation Design

### Layer 1: Command Instruction Files (Already Exist)

The 4 command files in `.claude-plugin/commands/` define the scanning behavior as Claude Code instructions. Each file tells the AI agent:
- What to scan (scope and categories)
- How to handle `--base-commit` / `--head-commit` arguments
- The exact JSON output format to produce

These files are the primary deliverable. They must produce output matching the `ScanReport` types in `lib/health/types.ts`.

### Layer 2: Output Format Alignment

Each command's JSON output must align with the corresponding report type:

| Command | Report Type | Key Fields |
|---------|-------------|------------|
| health-security | `SecurityReport` | `issues[]` with severity (HIGH/MEDIUM/LOW), file, line, category |
| health-compliance | `ComplianceReport` | `issues[]` with category (constitution principle), file, line |
| health-tests | `TestsReport` | `autoFixed[]`, `nonFixable[]` with file, description |
| health-spec-sync | `SpecSyncReport` | `specs[]` with specPath, status (synced/drifted), drift description |

The workflow wraps command output into the report schema, adding `type` discriminator and `generatedTickets` after ticket creation.

### Layer 3: Argument Handling

All commands accept:
- `--base-commit <SHA>`: Optional. If provided, incremental scan (diff-only). If absent, full repo scan.
- `--head-commit <SHA>`: Optional. Target commit reference.

health-tests ignores `--base-commit` (always runs full suite per spec decision).

### Layer 4: Score Calculation

Each command outputs a `score` (0-100):
- **Security**: `100 - (HIGH*15 + MEDIUM*5 + LOW*1)`, floor 0
- **Compliance**: `100 - (fail*20 + partial*5)` per principle, floor 0
- **Tests**: `(passed / total) * 100`, adjusted for auto-fixed
- **Spec Sync**: `(synced / total) * 100`

### Layer 5: Workflow Integration

The `health-scan.yml` workflow (built by AIB-377):
1. Clones target repo
2. Maps scan type → command via `SCAN_COMMAND_MAP`
3. Executes command via Claude Code CLI
4. Parses JSON stdout
5. Creates remediation tickets from report
6. Updates scan status via API callback

Commands must output ONLY valid JSON to stdout — no extra text, logs, or formatting.

## Testing Strategy

| Test | Type | Location | Covers |
|------|------|----------|--------|
| Security report matches SecurityReport schema | Unit | `tests/unit/health/report-schemas.test.ts` | FR-002, FR-003, US-1 |
| Compliance report matches ComplianceReport schema | Unit | Same | FR-002, FR-005, FR-006, US-3 |
| Tests report matches TestsReport schema | Unit | Same | FR-002, FR-008, FR-009, FR-010, US-2 |
| Spec sync report matches SpecSyncReport schema | Unit | Same | FR-002, FR-012, FR-013, US-4 |
| Command mapping covers all 4 types | Unit | `tests/unit/health/scan-commands.test.ts` | FR-001 |
| Ticket grouping from all report types | Unit | `tests/unit/health/ticket-creation.test.ts` | FR-015, FR-016 |
| Status callback with report data | Integration | `tests/integration/health/scan-status-tickets.test.ts` | SC-001, SC-002 |

**Decision tree applied**:
- Report schema validation → Unit test (pure Zod parsing, no dependencies)
- Command mapping → Unit test (pure function)
- Ticket grouping → Unit test (pure function, deterministic)
- Status callback flow → Integration test (API + database)
- Command execution → Not directly testable in CI (requires Claude Code CLI); validated by schema tests on output format

## Complexity Tracking

*No constitution violations — table not applicable.*

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Command produces non-JSON output | Workflow wraps in try-catch; FAILED status with raw output for debugging |
| Report fields don't match Zod schema | Unit tests validate sample outputs against `report-schemas.ts` |
| health-tests auto-fix breaks code | Each fix is individually committed; failed fixes reported as nonFixable |
| Incremental scan misses issues in unchanged files | Full scan mode available; baseCommit fallback when SHA not found |
| health-compliance can't find constitution | Graceful fallback: reports "no constitution found" with score 0 |
| health-spec-sync specs directory missing | Reports empty specs list with score 100 and note |
