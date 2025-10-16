# Implementation Plan: Branch Link in Ticket Details

**Branch**: `033-link-to-branch` | **Date**: 2025-10-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/033-link-to-branch/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a GitHub branch link to ticket detail modal that appears when the ticket has an associated branch. The link opens the branch in GitHub in a new tab and hides once the ticket reaches SHIP stage. This enables users to navigate from ticket to code with one click.

**Technical Approach**: Extend existing `ticket-detail-modal.tsx` component to conditionally render a GitHub branch link using lucide-react's GitBranch icon and Next.js Link component with external URL support. Apply stage-based visibility logic and URL encoding for branch names.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, shadcn/ui, lucide-react
**Storage**: PostgreSQL 14+ via Prisma (existing Ticket.branch and Project.githubOwner/githubRepo fields)
**Testing**: Playwright for E2E tests
**Target Platform**: Web (Next.js/Vercel)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Link appears instantly on ticket modal render (<50ms)
**Constraints**: No API changes required (uses existing ticket.branch, project.githubOwner, project.githubRepo fields)
**Scale/Scope**: Single React component modification, 1-2 test files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ TypeScript-First Development
- **Status**: PASS
- **Evidence**: Feature modifies existing TypeScript React component (`ticket-detail-modal.tsx`) with strict mode already enabled
- **Compliance**: No `any` types will be introduced; URL construction and conditional rendering use existing typed data (Ticket, Project interfaces)

### ✅ Component-Driven Architecture
- **Status**: PASS
- **Evidence**: Modification to existing shadcn/ui-based modal component; uses lucide-react icons; no custom components needed
- **Compliance**: Feature adds JSX to existing Client Component with "use client" directive; follows existing pattern in ticket-detail-modal.tsx

### ✅ Test-Driven Development
- **Status**: PASS
- **Evidence**: Will search for existing Playwright tests in `/tests/e2e/` before writing new tests
- **Compliance**: Test Discovery Workflow:
  1. Search: `npx grep -r "ticket.*detail" tests/` to find existing ticket detail modal tests
  2. Search: `npx glob "tests/**/*ticket*.spec.ts"` for ticket-related test files
  3. Extend existing test file or create new test file if none found
  4. Write E2E tests for branch link visibility, click behavior, and stage-based hiding

### ✅ Security-First Design
- **Status**: PASS
- **Evidence**:
  - Uses `rel="noopener noreferrer"` on external link (prevents window.opener access)
  - URL encoding via `encodeURIComponent()` for branch names (prevents XSS)
  - No user input validation needed (branch name from database, githubOwner/Repo from project config)
- **Compliance**: FR-004 mandates `target="_blank"` with `rel="noopener noreferrer"`; FR-006 mandates URL encoding

### ✅ Database Integrity
- **Status**: PASS (N/A)
- **Evidence**: No database schema changes required; uses existing fields:
  - `Ticket.branch` (string, nullable) - already exists
  - `Ticket.stage` (Stage enum) - already exists
  - `Project.githubOwner` (string) - already exists
  - `Project.githubRepo` (string) - already exists
- **Compliance**: No migrations needed

### ✅ Specification Clarification Guardrails
- **Status**: PASS
- **Evidence**: Spec generated with AUTO policy, 3 auto-resolved decisions documented with confidence scores (0.8, 0.6, 0.9)
- **Compliance**: No PRAGMATIC/CONSERVATIVE conflicts; all decisions documented in Auto-Resolved Decisions section with trade-offs

## Project Structure

### Documentation (this feature)

```
specs/033-link-to-branch/
├── spec.md                    # Feature specification
├── plan.md                    # This file (/speckit.plan command output)
├── research.md                # Phase 0 output (component patterns, icon usage)
├── data-model.md              # Phase 1 output (N/A - no data model changes)
├── quickstart.md              # Phase 1 output (developer guide)
├── contracts/                 # Phase 1 output (N/A - no API contracts)
├── checklists/
│   └── requirements.md        # Spec quality validation (already created)
└── tasks.md                   # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
components/
├── board/
│   ├── ticket-detail-modal.tsx     # [MODIFIED] Add branch link rendering
│   └── ticket-card.tsx              # [READ ONLY] Reference for styling patterns
└── ui/
    ├── dialog.tsx                   # [READ ONLY] shadcn/ui Dialog primitive
    └── button.tsx                   # [READ ONLY] shadcn/ui Button primitive

tests/
└── e2e/
    └── ticket-detail-modal.spec.ts  # [NEW OR MODIFIED] E2E tests for branch link
```

**Structure Decision**:
- **Web Application**: Next.js 15 App Router with component-based architecture
- **Feature Scope**: Single component modification (`ticket-detail-modal.tsx`)
- **Test Location**: Playwright E2E tests in `/tests/e2e/`
- **No Backend Changes**: Uses existing Prisma models and API endpoints

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No Violations**: All constitution gates pass without exceptions. No complexity tracking required.

---

## Phase 0: Research (COMPLETED)

**Status**: ✅ Complete
**Artifacts**: [research.md](./research.md)

**Key Decisions**:
1. Use standard `<a>` tag with `target="_blank"` for external links (not Next.js Link)
2. Use `GitBranch` icon from lucide-react
3. Use `encodeURIComponent()` for URL encoding
4. Place link below description section, above dates section
5. Conditional rendering based on `ticket.stage !== 'SHIP'`

**Technologies Confirmed**:
- lucide-react (GitBranch icon)
- TailwindCSS (styling)
- Playwright (E2E testing with new tab support)

---

## Phase 1: Design & Contracts (COMPLETED)

**Status**: ✅ Complete
**Artifacts**:
- [data-model.md](./data-model.md) - No database changes required
- [contracts/README.md](./contracts/README.md) - No API contracts required
- [quickstart.md](./quickstart.md) - Developer implementation guide

**Design Summary**:
- **Data Model**: Uses existing Ticket.branch, Ticket.stage, Project.githubOwner, Project.githubRepo fields
- **Component Design**: Conditional rendering in ticket-detail-modal.tsx
- **URL Construction**: Helper function `buildGitHubBranchUrl()` with URL encoding
- **Styling**: Follows existing purple button pattern from "View Specification" button
- **Testing**: E2E tests for visibility, click behavior, and stage-based hiding

**Constitution Re-Check (Post-Design)**:
- ✅ TypeScript-First: No type changes, uses existing interfaces
- ✅ Component-Driven: Extends existing shadcn/ui modal component
- ✅ TDD: Test Discovery Workflow documented in quickstart.md
- ✅ Security: `rel="noopener noreferrer"` + URL encoding
- ✅ Database Integrity: No migrations required
- ✅ Clarification Guardrails: AUTO policy decisions documented in spec

**Ready for Phase 2**: All design artifacts complete, no blocking issues identified
