# Implementation Plan: Visual Job Type Distinction on Ticket Cards

**Branch**: `045-visual-distinction-between` | **Date**: 2025-10-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/045-visual-distinction-between/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add visual indicators to ticket cards and detail modals to distinguish between automated stage transition jobs (specify, plan, tasks, implement, quick-impl) and AI-BOARD comment assistance jobs (comment-specify, comment-plan, comment-build, comment-verify). The solution uses icon + color + text combinations to meet WCAG 2.1 AA accessibility standards while providing immediate visual recognition without requiring hover interactions.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, TailwindCSS 3.4, Prisma 6.x, lucide-react icons
**Storage**: PostgreSQL 14+ (Job.command field stores job type information)
**Testing**: Playwright (E2E tests), existing component test patterns
**Target Platform**: Web application (Vercel serverless deployment)
**Project Type**: Web application (frontend + backend integrated via Next.js App Router)
**Performance Goals**: <100ms UI update on job status changes, 60fps animations on modern browsers
**Constraints**: WCAG 2.1 AA accessibility (4.5:1 contrast ratio), responsive layout (320px min width), GPU-accelerated animations only
**Scale/Scope**: Client-side component enhancement affecting 2 components (TicketCard, TicketDetailModal), no new API endpoints required

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: TypeScript-First Development ✅
- All components use TypeScript strict mode
- Job type classification logic will have explicit types
- Icon and color configurations will be strongly typed
- No `any` types required for this feature

### Principle II: Component-Driven Architecture ✅
- Uses existing shadcn/ui components (Badge component pattern)
- Enhances existing JobStatusIndicator component (components/board/job-status-indicator.tsx)
- Updates existing TicketCard component (components/board/ticket-card.tsx)
- Server Components for ticket rendering, Client Components for interactivity
- lucide-react icons already in use for status indicators

### Principle III: Test-Driven Development ✅
- Existing test files to extend:
  - tests/integration/tickets/ticket-card-job-status.spec.ts (visual indicator tests)
  - Existing JobStatusIndicator component tests
- Will write E2E tests for visual distinction before implementation
- Test cases: workflow jobs vs AI-BOARD jobs, accessibility validation, responsive layout

### Principle IV: Security-First Design ✅
- No user input involved (purely display logic)
- Job.command field already validated by existing system
- No new API endpoints or data mutations
- Read-only display of existing database fields

### Principle V: Database Integrity ✅
- No database schema changes required
- Uses existing Job.command field (VARCHAR(50))
- No migrations needed
- Pattern matching on existing command strings

### Principle VI: Specification Clarification Guardrails ✅
- AUTO policy applied (spec.md line 11-17)
- High confidence (0.85) decision for visual approach
- Trade-offs documented in spec.md
- Reviewer notes included for accessibility validation

**GATE RESULT: PASS** - All constitution principles satisfied. No violations, no complexity exceptions needed.

---

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design artifacts completed*

### Principle I: TypeScript-First Development ✅
- All type definitions created in `lib/types/job-types.ts`
- Classification logic has explicit TypeScript signatures
- Component interfaces extended with proper type safety
- No `any` types used in implementation

### Principle II: Component-Driven Architecture ✅
- Extends existing JobStatusIndicator component (backward compatible)
- Modifies existing TicketCard and TicketDetailModal components
- Uses existing lucide-react icon library (Cog, MessageSquare)
- Follows shadcn/ui styling patterns with TailwindCSS
- Client Components for interactivity ("use client" directive maintained)

### Principle III: Test-Driven Development ✅
- Unit tests defined for classification logic (tests/unit/job-type-classifier.test.ts)
- Integration tests extend existing file (tests/integration/tickets/ticket-card-job-status.spec.ts)
- E2E tests created for user-facing behavior (tests/e2e/job-type-visual-distinction.spec.ts)
- Accessibility tests included (ARIA labels, color contrast, screen reader)
- Red-Green-Refactor workflow documented in quickstart.md

### Principle IV: Security-First Design ✅
- No user input processing (read-only display logic)
- No new API endpoints created
- No sensitive data exposure
- Uses existing validated Job.command field from database

### Principle V: Database Integrity ✅
- Zero schema changes required
- Uses existing Job.command field (VARCHAR(50))
- No migrations needed
- No data backfill required

### Principle VI: Specification Clarification Guardrails ✅
- AUTO policy successfully applied with high confidence (0.85)
- Design decisions documented in research.md
- Trade-offs clearly articulated in spec.md
- Accessibility validation included in contracts

**POST-DESIGN GATE RESULT: PASS** - All constitution principles remain satisfied after design phase. Implementation ready to proceed.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
components/board/
├── ticket-card.tsx                    # ← MODIFY: Add job type visual indicator
├── job-status-indicator.tsx           # ← MODIFY: Add jobType prop and conditional rendering
└── ticket-detail-modal.tsx            # ← MODIFY: Add job type indicator to job history

lib/
├── utils/
│   └── job-type-classifier.ts         # ← CREATE: Job type classification logic
└── types/
    └── job-types.ts                   # ← CREATE: JobType enum and related types

tests/
├── integration/tickets/
│   └── ticket-card-job-status.spec.ts # ← EXTEND: Add job type distinction tests
└── e2e/
    └── job-type-visual-distinction.spec.ts # ← CREATE: E2E tests for visual indicators
```

**Structure Decision**: Next.js 15 App Router web application with integrated frontend and backend. This feature affects client-side components only, with no backend API changes required. Job type classification logic is extracted to a utility module for reusability and testability.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - Constitution Check passed with no exceptions required.
