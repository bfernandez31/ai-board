# Implementation Plan: [Compliance] Fix 2 violations - Security-First Design

**Branch**: `AIB-486-compliance-fix-2` | **Date**: 2026-04-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-486-compliance-fix-2/spec.md`

## Summary

Fix two compliance violations against the "Security-First Design" principle in `lib/validations/config.ts`:
1. **Strip service credentials** (`username`, `password`) from service entries before DB storage and API response, matching the existing `env` stripping pattern in `lib/config-sync.ts`.
2. **Replace `.passthrough()` with `.strict()`** on `ProjectConfigSchema` so unknown fields are rejected with validation errors instead of silently persisted.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode)
**Primary Dependencies**: Zod (schema validation), Prisma 6.x (ORM), Next.js 16 (App Router)
**Storage**: PostgreSQL 14+ via Prisma
**Testing**: Vitest (unit + integration)
**Target Platform**: Node.js 22.20.0 / Linux server
**Project Type**: Web application (Next.js)
**Performance Goals**: N/A — validation-layer change, no performance-sensitive path
**Constraints**: Must not break existing valid configs; must maintain backward compatibility for configs without unknown fields
**Scale/Scope**: 2 files modified (`lib/validations/config.ts`, `lib/config-sync.ts`), 2 test files updated

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All changes in TypeScript strict mode, explicit types |
| II. Component-Driven Architecture | PASS | Changes are in `lib/` (shared utilities), correct location |
| III. Test-Driven Development | PASS | Will extend existing unit tests (`config-schema.test.ts`) and integration tests (`config-sync.test.ts`) |
| IV. Security-First Design | **FIX TARGET** | This ticket directly fixes two violations: (a) service credentials exposed in API responses, (b) unvalidated fields silently persisted via `.passthrough()` |
| V. Database Integrity | PASS | No schema changes; only runtime data sanitization |
| V. Specification Clarification | PASS | Both decisions auto-resolved as CONSERVATIVE with high confidence |

**Gate Result**: PASS — no violations; this ticket resolves existing violations.

## Project Structure

### Documentation (this feature)

```
specs/AIB-486-compliance-fix-2/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (created by /ai-board.tasks)
```

### Source Code (repository root)

```
lib/
├── validations/
│   └── config.ts          # MODIFY: .passthrough() → .strict(), add stripServiceCredentials()
└── config-sync.ts         # MODIFY: strip service credentials before DB write and API response

tests/
├── unit/
│   └── config-schema.test.ts       # MODIFY: update unknown-field tests (warnings → errors), add credential stripping tests
└── integration/
    └── projects/
        └── config-sync.test.ts     # MODIFY: add credential stripping integration tests
```

**Structure Decision**: Existing web application structure. All changes are modifications to existing files — no new files in `lib/` or `app/`.

## Testing Strategy

| User Story | Test Type | Location | Rationale |
|------------|-----------|----------|-----------|
| US1: Service credentials stripped | Unit test | `tests/unit/config-schema.test.ts` | Pure function (`stripServiceCredentials`) with no side effects |
| US1: Credentials stripped in sync | Integration test | `tests/integration/projects/config-sync.test.ts` | Tests DB storage and API response (database operation) |
| US2: Unknown fields rejected | Unit test | `tests/unit/config-schema.test.ts` | Pure validation function — extend existing unknown-field test section |

**Existing tests to update**:
- `config-schema.test.ts`: The "unknown fields produce warnings" describe block must change — unknown fields should now produce validation **errors**, not warnings. The `fullConfig()` helper includes `username`/`password` in services — tests referencing those fields in stored data need updating.
- `config-sync.test.ts`: Add tests verifying credentials are not present in stored config or sync response.

## Complexity Tracking

*No constitution violations to justify — this ticket resolves violations.*
