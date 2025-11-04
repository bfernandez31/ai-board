# Implementation Plan: Unified Deploy Preview Icon

**Branch**: `084-1499-fix-deploy` | **Date**: 2025-11-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/084-1499-fix-deploy/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Consolidate two separate deploy preview icons (preview and deploy) into a single stateful icon with visual states: green clickable icon for active previews, neutral deploy icon for deployable tickets, blue bounce animation during deployment, and hidden when not applicable. Priority-based state resolution ensures preview state takes precedence over deploy state.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: React 18, Next.js 15 (App Router), shadcn/ui (Radix UI), TanStack Query v5.90.5, lucide-react
**Storage**: N/A (UI-only feature, uses existing ticket data model)
**Testing**: Vitest (unit tests for icon state logic), Playwright (integration tests for component behavior)
**Target Platform**: Web browsers (modern browsers supporting ES6+)
**Project Type**: Web application (Next.js frontend)
**Performance Goals**: Instant icon state updates (<50ms), smooth animation transitions (60fps)
**Constraints**: Must integrate with existing useJobPolling hook (2s polling interval), maintain shadcn/ui design system consistency
**Scale/Scope**: Single component refactor affecting ~100 lines of code in TicketCard component

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: TypeScript-First Development
- ✅ **PASS**: All icon state logic will use explicit TypeScript types
- ✅ **PASS**: Icon state priority enum and component props will have strict types
- ✅ **PASS**: No `any` types anticipated (using existing Ticket and Job types)

### Principle II: Component-Driven Architecture
- ✅ **PASS**: Uses existing shadcn/ui components (no new UI primitives needed)
- ✅ **PASS**: Refactors existing TicketCard component (components/board/ticket-card.tsx)
- ✅ **PASS**: Follows Client Component pattern (TicketCard already uses "use client")

### Principle III: Test-Driven Development
- ✅ **PASS**: Vitest unit tests required for icon state priority logic
- ✅ **PASS**: Playwright integration tests required for icon rendering and click behavior
- ✅ **PASS**: Tests must be written before implementation (Red-Green-Refactor)
- ⚠️ **ACTION REQUIRED**: Search for existing tests using `Grep` before creating new test files

### Principle IV: Security-First Design
- ✅ **PASS**: No new security concerns (UI-only refactor)
- ✅ **PASS**: Uses existing validated ticket and job data
- ✅ **PASS**: No new API endpoints or data validation needed

### Principle V: Database Integrity
- ✅ **PASS**: No database changes required (uses existing Ticket.previewUrl and Job.status fields)

### Specification Clarification Guardrails
- ✅ **PASS**: Spec includes Auto-Resolved Decisions section with policy transparency
- ✅ **PASS**: No sensitive keywords requiring CONSERVATIVE fallback
- ✅ **PASS**: PRAGMATIC policy applied appropriately for UI consolidation

**GATE STATUS**: ✅ **PASS** - All constitution principles satisfied. Proceed to Phase 0 research.

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
├── ticket-card.tsx                    # Primary file to modify (icon consolidation logic)
├── ticket-card-preview-icon.tsx       # DEPRECATED: Remove after consolidation
├── ticket-card-deploy-icon.tsx        # DEPRECATED: Remove after consolidation
└── deploy-confirmation-modal.tsx      # Reuse existing modal (no changes needed)

lib/utils/
├── deploy-preview-eligibility.ts      # Existing eligibility checks (no changes)
└── job-filtering.ts                   # Existing job filtering (getDeployJob - no changes)

tests/unit/
└── unified-deploy-icon.test.ts        # NEW: Icon state priority logic tests

tests/integration/board/
└── unified-deploy-icon.spec.ts        # NEW: Component rendering and interaction tests
```

**Structure Decision**: This is a refactor within the existing Next.js web application structure. The primary change is consolidating two separate icon components (TicketCardPreviewIcon and TicketCardDeployIcon) into unified logic within the TicketCard component itself. No backend or API changes required.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations** - All constitution principles satisfied. No complexity tracking required.

---

## Phase 0: Research (COMPLETED)

### Research Findings

**File**: `research.md`

**Key Decisions**:
1. **Icon State Priority**: Preview > Deploying > Deployable > Hidden (priority-based resolution)
2. **Icon Selection**: ExternalLink (green) for preview, Rocket (neutral/blue) for deploy states
3. **Component Architecture**: Inline logic in TicketCard component (remove separate icon components)
4. **Testing Strategy**: Hybrid Vitest (unit) + Playwright (integration) per constitution
5. **Color Coding**: Green (text-green-400) for preview, blue (text-blue-400) for deploying, neutral (text-[#a6adc8]) for deployable

**Technologies Resolved**:
- React.useMemo() for state computation memoization
- lucide-react icons (ExternalLink, Rocket)
- shadcn/ui Button component (existing pattern)
- TailwindCSS animation classes (animate-bounce)

**No Open Questions** - All research complete.

---

## Phase 1: Design & Contracts (COMPLETED)

### Deliverables

**Data Model** (`data-model.md`):
- DeployIconState type definition (preview, deploying, deployable, hidden)
- State priority logic and transitions
- No database schema changes (UI-only refactor)
- Uses existing Ticket.previewUrl and Job.status fields

**API Contracts** (`contracts/component-interface.ts`):
- DeployIconState enum and type definitions
- getDeployIconState() utility function with state priority logic
- DeployIconConfig interface for visual properties
- DEPLOY_ICON_CONFIG_MAP with icon configurations
- Mock fixtures for Vitest unit tests
- Type guards (isClickableState, isAnimatedState, isVisibleState)

**Quick Start Guide** (`quickstart.md`):
- Step-by-step implementation instructions (5-20 minutes per step)
- State priority reference table
- Common pitfalls and debugging tips
- Testing checklist (unit + integration)
- Accessibility and keyboard navigation notes
- Estimated implementation time: 50-70 minutes

**Agent Context Update**:
- Updated CLAUDE.md with TypeScript 5.6, React 18, Next.js 15 stack
- Preserved manual additions between markers
- No new technologies added (uses existing stack)

---

## Constitution Re-Check (Post-Design)

### Principle I: TypeScript-First Development
- ✅ **PASS**: DeployIconState type defined with explicit enum values
- ✅ **PASS**: getDeployIconState() has explicit parameter and return types
- ✅ **PASS**: No `any` types in contract or implementation plan

### Principle II: Component-Driven Architecture
- ✅ **PASS**: Uses shadcn/ui Button component (no new UI primitives)
- ✅ **PASS**: Inline logic in existing TicketCard component (feature-based structure)
- ✅ **PASS**: Client Component pattern maintained (TicketCard already "use client")

### Principle III: Test-Driven Development
- ✅ **PASS**: Unit test structure defined in contracts (mock fixtures provided)
- ✅ **PASS**: Integration test scenarios documented in quickstart.md
- ✅ **PASS**: Red-Green-Refactor cycle documented in quickstart checklist
- ✅ **PASS**: Test discovery workflow included (search before creating tests)

### Principle IV: Security-First Design
- ✅ **PASS**: No new security concerns (UI-only refactor)
- ✅ **PASS**: Uses existing validated data (Ticket.previewUrl, Job.status)
- ✅ **PASS**: No new API endpoints or input validation required

### Principle V: Database Integrity
- ✅ **PASS**: No database changes (uses existing schema)
- ✅ **PASS**: No migrations required

### Specification Clarification Guardrails
- ✅ **PASS**: Auto-resolved decisions documented in spec.md
- ✅ **PASS**: PRAGMATIC policy appropriate for UI consolidation
- ✅ **PASS**: No violations of baseline safeguards (security, testing retained)

**GATE STATUS**: ✅ **PASS** - All constitution principles satisfied post-design. Ready for Phase 2 (tasks generation).

---

## Next Steps

**Command**: `/speckit.tasks`

This command will generate the implementation tasks breakdown in `tasks.md` based on the design artifacts created in this plan. The plan command stops here as per spec-kit workflow.

---

## Summary

**Branch**: `084-1499-fix-deploy`
**Plan Location**: `/home/runner/work/ai-board/ai-board/specs/084-1499-fix-deploy/plan.md`

**Generated Artifacts**:
- ✅ `research.md` - Design decisions and technology choices
- ✅ `data-model.md` - Icon state definitions and transitions
- ✅ `contracts/component-interface.ts` - TypeScript types and utility functions
- ✅ `quickstart.md` - Implementation guide and testing checklist
- ✅ `CLAUDE.md` - Updated agent context file

**Constitution Compliance**: ✅ All principles satisfied
**Ready for Implementation**: ✅ Yes - Proceed to `/speckit.tasks` command
