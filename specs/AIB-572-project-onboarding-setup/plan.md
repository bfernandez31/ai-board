# Implementation Plan: Project Onboarding — Setup Page + Hybrid Workflow

**Branch**: `AIB-572-project-onboarding-setup` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-572-project-onboarding-setup/spec.md`

## Summary

Add a project onboarding flow that lets owners of imported repositories (without `.ai-board/config.yml`) configure and initialize their project through a setup page. The setup page presents agent CLI selection (Claude Code / Codex), verifies credential availability, and dispatches a two-phase onboarding workflow: Phase 1 deterministically detects the tech stack and generates `config.yml`; Phase 2 uses an LLM agent to generate `CLAUDE.md`, `constitution.md`, and `AGENTS.md`. A new `SetupJob` model tracks onboarding state with polling, guards against duplicates, and supports retry on failure.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, TanStack Query v5, shadcn/ui, web-push
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Web application (Linux server deployment)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Setup page loads < 1s; credential check < 500ms; status polling at 2s interval (consistent with existing job polling)
**Constraints**: Workflow must be lightweight (no runtime setup in target repo); single atomic commit to default branch; < 5 min total onboarding time
**Scale/Scope**: One active SetupJob per project; supports 7+ language ecosystems for detection

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in strict TypeScript; SetupJob model gets TypeScript interfaces; Zod validation for API inputs |
| II. Component-Driven Architecture | PASS | Setup page as Server Component shell with Client Component for interactive state; shadcn/ui primitives (RadioGroup, Button, Alert); feature folder at `components/setup/` |
| III. Test-Driven Development | PASS | Integration tests for setup API endpoints; component tests for setup page UI; extend existing credential tests for new check endpoint; no E2E needed (no browser-only features like OAuth/drag-drop) |
| IV. Security-First | PASS | Owner-only access guard via `verifyProjectOwnership()`; Zod schema validation on dispatch request; credentials never exposed in API responses; encrypted credential forwarded to workflow |
| V. Database Integrity | PASS | SetupJob via Prisma migration; duplicate guard at DB level (unique constraint on projectId + active status); transaction for job creation + workflow dispatch with rollback on failure |
| V. Spec Clarification Guardrails | PASS | Auto-resolved decisions documented in spec with trade-offs and reviewer notes |

**Gate Result**: PASS — No violations. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```
specs/AIB-572-project-onboarding-setup/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
│   ├── setup-api.md     # Setup job API endpoints
│   └── credential-check.md  # Credential availability endpoint
├── workflows/           # Phase 1 output (workflow/agent specs)
│   ├── onboard-workflow.md   # onboard.yml workflow definition
│   └── onboard-command.md    # Agent command for Phase 2 LLM generation
└── tasks.md             # Phase 2 output (created by /ai-board.tasks)
```

### Source Code (repository root)

```
# Database
prisma/
├── schema.prisma            # +SetupJob model, +SetupJobStatus enum
└── migrations/              # +new migration for SetupJob

# API Routes
app/api/
├── projects/[projectId]/
│   ├── setup/
│   │   └── route.ts         # POST: dispatch onboard workflow; GET: current setup job status
│   └── setup/dispatch/
│       └── route.ts         # POST: create job + dispatch workflow (alternative: merge into setup/route.ts)
└── jobs/[id]/
    └── status/
        └── route.ts         # EXISTING: PATCH status (extend for setup job callbacks)

# Setup Page
app/projects/[projectId]/
└── setup/
    └── page.tsx             # Setup page (Server Component shell)

# Components
components/setup/
├── setup-wizard.tsx         # Client component: agent selection, credential check, dispatch, polling
├── agent-selector.tsx       # Radio group for Claude Code / Codex selection
├── credential-status.tsx    # Credential availability indicator
├── setup-progress.tsx       # Running/completed/failed state display
└── setup-file-list.tsx      # List of committed files on success

# Library
lib/
├── setup/
│   ├── service.ts           # SetupJob CRUD, duplicate guard, status updates
│   └── dispatch.ts          # Onboard workflow dispatch logic
├── validations/
│   └── config.ts            # EXISTING: extend language/framework/manager enums
└── ai-credentials/
    └── workflow.ts          # EXISTING: reuse getOwnerCredential for credential check

# Workflow
.github/workflows/
└── onboard.yml              # New workflow: two-phase onboarding

# Onboard Scripts (committed to ai-board repo, used by workflow)
.specify/scripts/bash/
└── detect-stack.sh          # Phase 1: deterministic stack detection script

# Onboard Agent Command (committed to ai-board repo, used by workflow)
.claude/commands/
└── onboard.md               # Phase 2: agent command for LLM content generation

# Hooks
hooks/
└── use-setup-job.ts         # TanStack Query hook for setup job polling

# Tests
tests/
├── unit/
│   ├── setup/
│   │   └── service.test.ts      # SetupJob service unit tests
│   └── components/
│       └── setup/
│           ├── setup-wizard.test.tsx    # Setup wizard component tests
│           └── agent-selector.test.tsx  # Agent selector component tests
├── integration/
│   └── setup/
│       ├── dispatch.test.ts     # Setup dispatch API tests
│       └── status.test.ts       # Setup status polling API tests
└── e2e/
    (none — no browser-only features required)
```

**Structure Decision**: Web application structure using Next.js App Router conventions. New feature uses `components/setup/` for UI, `lib/setup/` for business logic, `app/api/projects/[projectId]/setup/` for API, and `app/projects/[projectId]/setup/` for the page route. This follows the established pattern from health scans (`lib/health/`, `components/health/`, `app/api/.../health/`).

## Complexity Tracking

*No constitution violations to justify.*

## Implementation Phases

### Phase 1: Database + Core API (Foundation)
1. Add `SetupJob` model to Prisma schema with migration
2. Extend config validation enums (ruby, php, rails, laravel, bundler, composer)
3. Create `lib/setup/service.ts` — CRUD operations, duplicate guard
4. Create `lib/setup/dispatch.ts` — workflow dispatch logic
5. Create `POST /api/projects/[projectId]/setup` — dispatch endpoint
6. Create `GET /api/projects/[projectId]/setup` — status endpoint

### Phase 2: Setup Page UI
7. Create `app/projects/[projectId]/setup/page.tsx` — server component with ownership guard
8. Create `components/setup/agent-selector.tsx` — radio group
9. Create `components/setup/credential-status.tsx` — live credential check
10. Create `components/setup/setup-progress.tsx` — state display
11. Create `components/setup/setup-wizard.tsx` — orchestrator component
12. Create `hooks/use-setup-job.ts` — TanStack Query polling hook

### Phase 3: Onboard Workflow + Scripts
13. Create `.github/workflows/onboard.yml` — two-phase workflow
14. Create stack detection script (Phase 1 of workflow)
15. Create agent onboard command (Phase 2 of workflow)
16. Implement status callback to update SetupJob + trigger config sync

### Phase 4: Guards + Edge Cases
17. Add redirect logic: projects with config → board; setup page → board on completion
18. Import flow integration: redirect to setup when no config detected
19. Error/retry handling in UI and API

## Testing Strategy

Following constitution §III (Test-Driven Development) and the decision tree:

| Test Type | Target | Files |
|-----------|--------|-------|
| **Unit** | SetupJob service (pure logic, duplicate guard) | `tests/unit/setup/service.test.ts` (new) |
| **Unit** | Config enum extensions | Extend `tests/unit/` config validation tests if they exist |
| **Component** | Setup wizard, agent selector, credential status | `tests/unit/components/setup/*.test.tsx` (new) |
| **Integration** | POST/GET `/api/projects/[projectId]/setup` | `tests/integration/setup/dispatch.test.ts` (new) |
| **Integration** | Setup status polling, duplicate guard enforcement | `tests/integration/setup/status.test.ts` (new) |
| **Integration** | Credential check for agent selection | Extend `tests/integration/credentials/` if applicable |

No E2E tests needed — setup page has no browser-only requirements (no OAuth, drag-drop, viewport-dependent behavior). All interactions are testable with RTL + Vitest.

## Post-Phase 1 Constitution Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | SetupJob has TypeScript interface; all API inputs Zod-validated; explicit return types |
| II. Component-Driven | PASS | shadcn/ui RadioGroup for agent selection; Alert for status messages; feature folder structure |
| III. Test-Driven | PASS | Integration tests for API; component tests for UI; extends existing credential tests |
| IV. Security-First | PASS | Owner-only guard; Zod validation; no credential exposure; parameterized queries |
| V. Database Integrity | PASS | Prisma migration; transaction for dispatch; consistent state on failure |

**Gate Result**: PASS — Design is constitution-compliant.
