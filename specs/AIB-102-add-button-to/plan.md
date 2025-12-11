# Implementation Plan: Add Button to Consult Summary

**Branch**: `AIB-102-add-button-to` | **Date**: 2025-12-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-102-add-button-to/spec.md`

## Summary

Add a read-only "Summary" button to the ticket detail modal that allows users to view the `summary.md` file generated during the implement step. The button follows the same visibility and UI patterns as existing Spec, Plan, and Tasks buttons, using the reusable DocumentationViewer component. Summary is only visible for FULL workflow tickets with a completed implement job.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), React 18, TailwindCSS 3.4, shadcn/ui, lucide-react, TanStack Query v5
**Storage**: PostgreSQL 14+ via Prisma 6.x (job status tracking)
**Testing**: Playwright (E2E), Vitest (unit)
**Target Platform**: Web (Vercel deployment)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Summary content loads within same timeframe as other documentation types
**Constraints**: Consistent with existing documentation viewer patterns, read-only only (no edit mode)
**Scale/Scope**: Single feature extending existing documentation infrastructure

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate Evaluation (Pre-Design)

| Principle | Rule | Status | Notes |
|-----------|------|--------|-------|
| I. TypeScript-First | `strict: true`, no `any` types, explicit types | ✅ PASS | Will extend existing typed patterns |
| II. Component-Driven | Use shadcn/ui, Server Components default, feature folders | ✅ PASS | Reuses existing DocumentationViewer component |
| III. Test-Driven | Search existing tests first, Vitest for unit, Playwright for E2E | ✅ PASS | Will extend existing documentation tests |
| IV. Security-First | Zod validation, parameterized queries | ✅ PASS | Will reuse existing validation patterns |
| V. Database Integrity | Prisma migrations, transactions | ✅ N/A | No schema changes required |
| V. Clarification Guardrails | AUTO defaults to CONSERVATIVE | ✅ PASS | Spec uses CONSERVATIVE fallback |

**Pre-Design Gate Result**: ✅ PASS - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```
specs/AIB-102-add-button-to/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Web application (Next.js App Router)
app/
├── api/
│   └── projects/[projectId]/tickets/[id]/
│       ├── spec/route.ts          # Existing - GET spec content
│       ├── plan/route.ts          # Existing - GET plan content
│       ├── tasks/route.ts         # Existing - GET tasks content
│       └── summary/route.ts       # NEW - GET summary content (read-only)

components/
├── board/
│   ├── ticket-detail-modal.tsx    # MODIFY - Add Summary button
│   └── documentation-viewer.tsx   # MODIFY - Add 'summary' docType support
└── ticket/
    └── edit-permission-guard.tsx  # No change needed (summary is read-only)

lib/
├── validations/
│   └── documentation.ts           # MODIFY - Add 'summary' to DocumentType
└── hooks/
    └── use-documentation.ts       # Existing - Works with new endpoint

tests/
├── e2e/
│   └── summary-button.spec.ts     # NEW - E2E tests for summary button
└── unit/
    └── documentation-validation.test.ts  # MODIFY - Test 'summary' type
```

**Structure Decision**: Next.js App Router web application with feature-based component structure. Follows existing patterns for documentation buttons (spec, plan, tasks). Summary is added as a fourth documentation type with same patterns but read-only constraint.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No violations. Implementation follows existing patterns exactly.

### Gate Evaluation (Post-Design)

| Principle | Rule | Status | Verification |
|-----------|------|--------|--------------|
| I. TypeScript-First | `strict: true`, no `any` types | ✅ PASS | Extends DocumentType enum, all types explicit |
| II. Component-Driven | Use shadcn/ui, feature folders | ✅ PASS | Reuses Button, Dialog from shadcn/ui; follows existing folder structure |
| III. Test-Driven | Vitest for unit, Playwright for E2E | ✅ PASS | Plan includes E2E tests; extends existing test patterns |
| IV. Security-First | Zod validation, parameterized queries | ✅ PASS | DocumentTypeSchema validates input; Prisma queries |
| V. Database Integrity | Prisma migrations | ✅ N/A | No database changes |
| V. Clarification Guardrails | AUTO → CONSERVATIVE | ✅ PASS | All auto-resolved decisions documented in spec |

**Post-Design Gate Result**: ✅ PASS - Ready for task generation

## Generated Artifacts

| Artifact | Status | Path |
|----------|--------|------|
| research.md | ✅ Complete | `specs/AIB-102-add-button-to/research.md` |
| data-model.md | ✅ Complete | `specs/AIB-102-add-button-to/data-model.md` |
| contracts/summary-api.yaml | ✅ Complete | `specs/AIB-102-add-button-to/contracts/summary-api.yaml` |
| quickstart.md | ✅ Complete | `specs/AIB-102-add-button-to/quickstart.md` |
