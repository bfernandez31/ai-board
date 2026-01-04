# Implementation Plan: Add Telemetry for Ticket Source on Compare

**Branch**: `AIB-138-add-telemetry-for` | **Date**: 2026-01-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-138-add-telemetry-for/spec.md`

## Summary

Extend the `/compare` command's telemetry fetch to include the source ticket (the ticket from which comparison is triggered). Currently, `fetch-telemetry.sh` only fetches telemetry for tickets explicitly referenced in the comment (e.g., `#AIB-124 #AIB-125`) but not the source ticket. The solution modifies `fetch-telemetry.sh` to extract the source ticket key from the `BRANCH` environment variable and include its telemetry in `.telemetry-context.json` with a `sourceTicket` metadata field for identification.

## Technical Context

**Language/Version**: Bash 5.x (for `fetch-telemetry.sh`), TypeScript 5.6 (strict mode for types)
**Primary Dependencies**: jq (JSON processing), curl (API calls), existing telemetry aggregation logic
**Storage**: JSON file output (`specs/$BRANCH/.telemetry-context.json`)
**Testing**: Vitest integration tests for telemetry behavior
**Target Platform**: GitHub Actions runner (Linux)
**Project Type**: Web application (Next.js)
**Performance Goals**: Single additional API call per comparison (negligible impact)
**Constraints**: Must not break existing telemetry format, maintain backward compatibility
**Scale/Scope**: Single script modification, report template update

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Compliance Status | Notes |
|-----------|------------------|-------|
| I. TypeScript-First | ✅ N/A | Script is Bash; TypeScript types already exist for telemetry |
| II. Component-Driven | ✅ N/A | No React components modified |
| III. Test-Driven | ✅ Required | Must add/update tests for source ticket telemetry |
| IV. Security-First | ✅ Compliant | Uses existing authenticated API calls |
| V. Database Integrity | ✅ N/A | No database changes |
| VI. AI-First Development | ✅ Compliant | No human documentation created |

**Gate Status**: ✅ PASS - Proceeding to Phase 0

### Post-Design Re-evaluation

| Principle | Compliance Status | Evidence |
|-----------|------------------|----------|
| I. TypeScript-First | ✅ Compliant | `TelemetryContextFile` interface extended in test file; JSON schema contract defined |
| II. Component-Driven | ✅ N/A | No UI changes |
| III. Test-Driven | ✅ Planned | `quickstart.md` specifies test updates for `sourceTicket` field |
| IV. Security-First | ✅ Compliant | Same auth pattern as existing ticket fetches |
| V. Database Integrity | ✅ N/A | JSON file only, no DB changes |
| VI. AI-First Development | ✅ Compliant | All artifacts in specs/ folder; no human docs created |
| V. Clarification Guardrails | ✅ Compliant | AUTO→PRAGMATIC applied per spec |

**Final Gate Status**: ✅ PASS - Design complete, ready for task generation

## Project Structure

### Documentation (this feature)

```
specs/AIB-138-add-telemetry-for/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
.github/scripts/
└── fetch-telemetry.sh          # PRIMARY: Script to modify

.claude/commands/
└── compare.md                  # Reference: Command spec (uses telemetry)

lib/types/
└── comparison.ts               # Reference: TypeScript interfaces

tests/unit/comparison/
└── telemetry-extractor.test.ts # Reference: Existing telemetry tests

tests/unit/telemetry/
└── context-file-schema.test.ts # UPDATE: Add source ticket schema tests
```

**Structure Decision**: Minimal change - modifying single script (`fetch-telemetry.sh`) and updating test file for schema validation. No new directories needed.

## Complexity Tracking

*No violations. All constitution principles satisfied.*

## Generated Artifacts

| Artifact | Path | Purpose |
|----------|------|---------|
| Research | `research.md` | Technical decisions and alternatives |
| Data Model | `data-model.md` | Schema extension for sourceTicket field |
| Contract | `contracts/telemetry-context-file.json` | JSON Schema for validation |
| Quickstart | `quickstart.md` | Implementation reference |

## Next Steps

Run `/speckit.tasks` to generate the implementation task list from this plan.
