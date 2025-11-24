# Implementation Plan: Fix Rollback to Plan from Verify

**Branch**: `AIB-76-fix-rollback-to` | **Date**: 2025-11-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-76-fix-rollback-to/spec.md`

## Summary

The VERIFY→PLAN rollback currently updates the database correctly but does not reset the git branch to remove implementation commits. This plan implements git reset functionality via a GitHub workflow, preserving spec files while removing BUILD-phase commits.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 15 (App Router), Prisma 6.x, TanStack Query v5, GitHub CLI (`gh`)
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Playwright (E2E/Integration), Vitest (Unit)
**Target Platform**: Linux server (GitHub Actions runners)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: Git reset completes within 60 seconds for typical branches
**Constraints**: Must preserve all spec folder files during git reset
**Scale/Scope**: Single-project scope, integrated with existing workflow system

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code will use strict TypeScript |
| II. Component-Driven | PASS | Follows existing Next.js API route patterns |
| III. Test-Driven Development | PASS | E2E tests already exist for rollback; will extend |
| IV. Security-First | PASS | Uses existing auth patterns, validates inputs |
| V. Database Integrity | PASS | Uses Prisma transactions, new job type |

### Post-Phase 1 Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | dispatch-rollback-reset.ts uses strict types, interfaces defined |
| II. Component-Driven | PASS | New dispatch function follows existing pattern in dispatch-deploy-preview.ts |
| III. Test-Driven Development | PASS | Test plan includes Vitest unit + Playwright E2E tests |
| IV. Security-First | PASS | Uses WORKFLOW_API_TOKEN auth, validates branch existence |
| V. Database Integrity | PASS | Job creation uses Prisma, no new migrations needed |
| V. Clarification Guardrails | PASS | All decisions documented in research.md with rationale |

**Constitution Compliance**: All gates pass. No violations detected.

## Project Structure

### Documentation (this feature)

```
specs/AIB-76-fix-rollback-to/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── rollback-reset-workflow.yaml
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```
# Existing files to modify
app/api/projects/[projectId]/tickets/[id]/transition/route.ts  # Dispatch rollback-reset workflow
app/lib/workflows/rollback-validator.ts                        # No changes needed
lib/workflows/transition.ts                                    # Add dispatchRollbackResetWorkflow()

# New workflow file
.github/workflows/rollback-reset.yml                           # Git reset workflow

# Tests
tests/e2e/verify-rollback.spec.ts                              # Extend with git reset tests
tests/unit/rollback-validator.test.ts                          # Extend with new job type
```

**Structure Decision**: Web application structure (Next.js). The implementation adds a new GitHub workflow and modifies the existing transition API to dispatch the rollback-reset workflow after database updates.

## Complexity Tracking

*No complexity violations detected.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | - | - |
