# Implementation Plan: Simplified Job Status Display

**Branch**: `047-design-job-status` | **Date**: 2025-10-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/047-design-job-status/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature simplifies the job status display on ticket cards by removing redundant stage prefixes from workflow jobs and consolidating dual-line job displays into a single-line layout. The workflow job status will show only icon + label (e.g., "✅ COMPLETED" without "🔧 BUILD :"), while AI-BOARD job status will appear as a compact bot-message-square icon positioned to the right of the workflow status with color-coded states (purple for PENDING/RUNNING/COMPLETED, red for FAILED, gray for CANCELLED) and tooltips.

**Technical Approach**: Modify the `JobStatusIndicator` component to conditionally remove stage/type prefix rendering for workflow jobs while adding a new compact icon-only rendering mode for AI-BOARD jobs. Update `TicketCard` component layout to position workflow and AI-BOARD indicators on the same line using flexbox with space-between alignment. Implement tooltip support using shadcn/ui Tooltip component with status-specific messages and timestamp formatting.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: React 18, Next.js 15, lucide-react (icons), shadcn/ui (Tooltip), TailwindCSS 3.4
**Storage**: N/A (purely visual UI changes, no data model modifications)
**Testing**: Vitest (unit tests for utility functions), Playwright (component integration tests)
**Target Platform**: Web browsers (Chrome, Firefox, Safari, Edge)
**Project Type**: Web application (frontend-only changes)
**Performance Goals**: <16ms render time (60fps), no layout shift during job status updates
**Constraints**: Maintain existing accessibility (ARIA labels, keyboard navigation), respect prefers-reduced-motion
**Scale/Scope**: 2 React components modified, ~150 lines of code changes, 0 API changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: TypeScript-First Development ✅
- **Status**: PASS
- **Verification**: All changes in TypeScript strict mode with explicit types
- **Evidence**: Existing `JobStatusIndicator` and `TicketCard` components already TypeScript with full type annotations

### Principle II: Component-Driven Architecture ✅
- **Status**: PASS
- **Verification**: Using shadcn/ui Tooltip component, modifying existing React components following established patterns
- **Evidence**: Changes isolated to `/components/board/` feature folder, no new primitives created from scratch

### Principle III: Test-Driven Development ✅
- **Status**: PASS
- **Verification**: Will search for existing tests before creating new ones, write tests before implementation
- **Evidence**: Hybrid testing strategy (Vitest for utilities, Playwright for component integration)
- **Test Discovery**:
  - Search pattern: `npx grep -r "JobStatusIndicator\|TicketCard" tests/`
  - Will extend existing test files or create new only if genuinely needed

### Principle IV: Security-First Design ✅
- **Status**: PASS (N/A - no security concerns)
- **Verification**: No user input validation, no API endpoints, no data persistence
- **Evidence**: Purely visual UI changes with no security surface

### Principle V: Database Integrity ✅
- **Status**: PASS (N/A - no database changes)
- **Verification**: No schema changes, no migrations, no data model modifications
- **Evidence**: Feature is frontend-only visual refinement

### Principle VI: Specification Clarification Guardrails ✅
- **Status**: PASS
- **Verification**: AUTO policy applied with no clarifications needed (user provided explicit design specs)
- **Evidence**: All visual requirements specified (colors, icons, positioning, tooltips)

**Overall Gate Status**: ✅ PASS - All principles satisfied, no constitution violations

## Project Structure

### Documentation (this feature)

```
specs/047-design-job-status/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (not needed - no research required)
├── data-model.md        # Phase 1 output (not needed - no data changes)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── component-interfaces.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
components/board/
├── job-status-indicator.tsx     # MODIFY: Remove stage prefix for workflow, add compact AI-BOARD mode
├── ticket-card.tsx               # MODIFY: Change dual-line layout to single-line with right-aligned AI-BOARD icon
└── [other board components]

lib/utils/
├── job-type-classifier.ts        # NO CHANGES: Existing JobType classification logic
├── job-label-transformer.ts      # NO CHANGES: Existing contextual label logic
└── format-timestamp.ts           # NEW: Utility for human-readable timestamp formatting (for tooltips)

tests/integration/
├── job-status-display.spec.ts    # NEW: Playwright tests for visual layout and tooltip behavior
└── [existing test files]

tests/unit/
├── format-timestamp.test.ts      # NEW: Vitest tests for timestamp formatting utility
└── [existing test files]
```

**Structure Decision**: Web application (Next.js) with feature-based component organization. Changes isolated to `/components/board/` folder with new utility function in `/lib/utils/` for timestamp formatting. No backend changes required (purely frontend visual refinement).

## Complexity Tracking

*No constitution violations - this section is not applicable.*

---

## Phase 0: Research & Discovery

**Status**: ✅ COMPLETE

**Deliverables**:
- [research.md](./research.md) - Technical decisions and best practices

**Key Findings**:
- Use shadcn/ui Tooltip component (already in project)
- Create formatTimestamp() utility for human-readable timestamps
- Flexbox layout with justify-between for single-line display
- Conditionally skip prefix rendering for workflow jobs

**No Research Blockers**: All technical unknowns resolved through existing codebase examination

---

## Phase 1: Design & Contracts

**Status**: ✅ COMPLETE

**Deliverables**:
- [data-model.md](./data-model.md) - No data changes (visual-only feature)
- [contracts/component-interfaces.md](./contracts/component-interfaces.md) - Component interface specifications
- [quickstart.md](./quickstart.md) - Implementation guide with TDD workflow

**Key Design Decisions**:
- JobStatusIndicator: Two rendering modes (workflow simplified, AI-BOARD compact)
- TicketCard: Horizontal flex layout replacing vertical stack
- formatTimestamp(): New utility for relative/absolute time formatting
- Tooltip integration using shadcn/ui primitives

**Constitution Check (Post-Design)**: ✅ PASS - All principles still satisfied after detailed design

---

## Phase 2: Task Breakdown

**Status**: ⏳ PENDING

**Next Command**: `/speckit.tasks` to generate implementation tasks from this plan

**Expected Tasks**:
1. Create formatTimestamp utility with unit tests
2. Modify JobStatusIndicator component (remove prefix, add compact mode)
3. Update TicketCard layout (single-line flex)
4. Create integration tests for visual behavior
5. Manual testing and accessibility verification

---

## Implementation Summary

### Files to Create (1)
- `lib/utils/format-timestamp.ts` - Timestamp formatting utility

### Files to Modify (2)
- `components/board/job-status-indicator.tsx` - Simplified workflow display, compact AI-BOARD mode
- `components/board/ticket-card.tsx` - Single-line horizontal layout

### Tests to Create (2)
- `tests/unit/format-timestamp.test.ts` - Vitest unit tests
- `tests/integration/job-status-display.spec.ts` - Playwright integration tests

### Dependencies Required
- ✅ lucide-react (already installed) - BotMessageSquare icon
- ✅ shadcn/ui Tooltip (check if installed, add if needed)
- ✅ @/lib/utils cn() (already available)

### Estimated Effort
- **Total Time**: 2-3 hours (including tests)
- **Complexity**: Low (visual refinement, no data/API changes)
- **Risk**: Low (isolated changes, easy rollback)

### Success Metrics (from spec.md)
- SC-001: Status identifiable at a glance (no redundant labels)
- SC-002: 20-30% vertical space reduction (single line vs dual)
- SC-003: Visual distinction via color, position, icon
- SC-004: Improved board scanning efficiency
- SC-005: Zero confusion reports

---

## Planning Phase Complete

**Branch**: `047-design-job-status` ✅
**Spec**: [spec.md](./spec.md) ✅
**Plan**: plan.md (this file) ✅
**Research**: [research.md](./research.md) ✅
**Data Model**: [data-model.md](./data-model.md) ✅
**Contracts**: [contracts/component-interfaces.md](./contracts/component-interfaces.md) ✅
**Quickstart**: [quickstart.md](./quickstart.md) ✅
**Agent Context**: CLAUDE.md updated ✅

**Ready for Implementation**: Use `/speckit.tasks` to generate actionable task list for `/speckit.implement` command.
