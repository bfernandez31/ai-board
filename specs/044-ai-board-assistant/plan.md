# Implementation Plan: AI-BOARD Assistant for Ticket Collaboration

**Branch**: `044-ai-board-assistant` | **Date**: 2025-10-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/044-ai-board-assistant/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement an AI-BOARD system user that can be mentioned in ticket comments to provide collaborative assistance for specification and planning tasks. When mentioned, AI-BOARD triggers GitHub workflows that execute Claude CLI commands to analyze and modify ticket artifacts (spec.md, plan.md, tasks.md) based on the comment request, then posts a response comment with the results. The system includes availability validation (stage and job status checks), automatic project membership, and special handling for test tickets and unimplemented stages.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, Zod 4.x, @octokit/rest 22.0, NextAuth.js 5.0-beta.29
**Storage**: PostgreSQL 14+ (User, ProjectMember, Job, Comment tables)
**Testing**: Playwright 1.48.0 with E2E test coverage
**Target Platform**: Vercel serverless (Next.js optimized)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: API response <200ms p95, workflow dispatch <500ms, mention validation <100ms
**Constraints**: GitHub Actions workflow timeout 120min, Comment content max 2000 chars, Job status must be updated within 30s of workflow completion
**Scale/Scope**: Single system user (AI-BOARD) across all projects, supports 4 ticket stages (SPECIFY/PLAN/BUILD/VERIFY), handles concurrent requests via job status locking

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: TypeScript-First Development
✅ **PASS** - All code will use TypeScript strict mode with explicit types. API contracts, Job status types, and mention detection logic will have full type coverage.

### Principle II: Component-Driven Architecture
✅ **PASS** - UI changes confined to MentionInput component (greyed-out AI-BOARD with tooltips). Server logic follows Next.js API route conventions. Follows existing feature folder structure.

### Principle III: Test-Driven Development
✅ **PASS** - E2E tests required before implementation:
- Test AI-BOARD mention in SPECIFY stage (success case)
- Test AI-BOARD greyed out with running job (blocked case)
- Test AI-BOARD greyed out in INBOX stage (invalid stage)
- Test workflow skip for [e2e] tickets
- Test workflow "not implemented" for BUILD/VERIFY stages
- Test AI-BOARD comment creation via new endpoint

**Test Discovery Required**: Must search for existing tests covering:
- Comment creation/mention validation (`tests/**/*comment*.spec.ts`)
- Job status updates (`tests/**/*job*.spec.ts`)
- GitHub workflow dispatch patterns (`tests/**/*workflow*.spec.ts`)

### Principle IV: Security-First Design
✅ **PASS** - Input validation via Zod schemas for:
- Comment content (mention detection, length limits)
- AI-BOARD comment endpoint authentication (workflow token validation)
- Job status validation (server-side enforcement)
- User ID validation for AI-BOARD user

Security measures:
- AI-BOARD user cannot be deleted via application UI
- Workflow token authentication for AI-BOARD comment endpoint (not session-based)
- Server-side validation of AI-BOARD availability rules
- ProjectMember validation for AI-BOARD mentions

### Principle V: Database Integrity
✅ **PASS** - Database changes via Prisma:
- AI-BOARD user creation via migration or seed script
- ProjectMember records use existing schema (no migration needed)
- Job records use existing command field (varchar 50)
- Transactional integrity for project creation + AI-BOARD membership

No schema changes required - leverages existing User, ProjectMember, Job, Comment models.

### Constitution Compliance Summary
**Status**: ✅ ALL GATES PASSED

**Justification**: Feature follows all constitution principles. Uses existing database schema, TypeScript strict mode, shadcn/ui components, Playwright tests, and Next.js API route conventions. No violations to justify.

## Project Structure

### Documentation (this feature)

```
specs/044-ai-board-assistant/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (pending)
├── data-model.md        # Phase 1 output (pending)
├── quickstart.md        # Phase 1 output (pending)
├── contracts/           # Phase 1 output (pending)
│   ├── ai-board-comment.yaml     # POST /api/projects/:projectId/tickets/:id/comments/ai-board
│   ├── ai-board-assist.yaml      # GitHub workflow dispatch contract
│   └── mention-validation.yaml   # AI-BOARD availability validation contract
├── checklists/
│   └── requirements.md  # Specification quality checklist (completed)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Web application structure (Next.js full-stack)
app/
├── api/
│   ├── projects/
│   │   └── [projectId]/
│   │       ├── tickets/
│   │       │   └── [id]/
│   │       │       └── comments/
│   │       │           ├── route.ts                    # MODIFY: Add @ai-board detection
│   │       │           └── ai-board/
│   │       │               └── route.ts                # NEW: Workflow comment endpoint
│   │       └── route.ts                                # MODIFY: Add AI-BOARD auto-membership
│   └── jobs/
│       └── [id]/
│           └── status/
│               └── route.ts                            # EXISTING: Used by workflow
├── lib/
│   ├── schemas/
│   │   ├── comment-validation.ts                       # EXISTING: Reuse for AI-BOARD comments
│   │   └── ai-board-comment.ts                         # NEW: AI-BOARD comment endpoint schema
│   ├── utils/
│   │   ├── mention-parser.ts                           # EXISTING: Reuse for @ai-board detection
│   │   └── ai-board-availability.ts                    # NEW: Stage + job status validation
│   ├── workflows/
│   │   └── dispatch-ai-board.ts                        # NEW: GitHub workflow dispatcher
│   └── db/
│       └── ai-board-user.ts                            # NEW: AI-BOARD user ID helper
├── components/
│   └── comments/
│       └── mention-input.tsx                           # MODIFY: Add AI-BOARD availability UI
└── hooks/
    └── use-ai-board-availability.ts                    # NEW: React hook for availability check

.github/
└── workflows/
    └── ai-board-assist.yml                             # NEW: AI-BOARD workflow

.claude/
└── commands/
    └── ai-board-assist.md                              # NEW: Claude slash command

prisma/
├── schema.prisma                                       # EXISTING: No changes needed
└── seed.ts                                             # MODIFY: Add AI-BOARD user creation

tests/
├── api/
│   ├── ai-board-comment.spec.ts                        # NEW: AI-BOARD comment endpoint tests
│   └── ai-board-mention-detection.spec.ts              # NEW: Mention detection tests
├── e2e/
│   ├── ai-board-specify-stage.spec.ts                  # NEW: SPECIFY stage workflow tests
│   ├── ai-board-plan-stage.spec.ts                     # NEW: PLAN stage workflow tests
│   ├── ai-board-availability-ui.spec.ts                # NEW: UI validation tests
│   └── ai-board-e2e-skip.spec.ts                       # NEW: [e2e] ticket skip tests
└── helpers/
    └── ai-board-helpers.ts                             # NEW: Test utilities
```

**Structure Decision**: Single web application using Next.js App Router conventions. All API routes follow `/app/api/[resource]/route.ts` pattern. Feature-specific code organized in `/lib/` with clear separation of concerns (schemas, utils, workflows, db helpers). UI changes confined to existing comment component. Tests follow existing patterns with API contract tests and E2E workflow tests.

## Complexity Tracking

*No violations - all constitution gates passed without exceptions.*

---

## Phase 0: Research & Decision Documentation

### Research Tasks

The following unknowns from Technical Context require research and documented decisions:

1. **GitHub Workflow Dispatch Authentication**
   - **Question**: How to authenticate AI-BOARD comment endpoint calls from GitHub workflow?
   - **Research**: Investigate GitHub workflow token (GITHUB_TOKEN), repository secrets, and Next.js middleware authentication patterns
   - **Decision Target**: Choose between workflow token header validation vs. API key authentication

2. **AI-BOARD User ID Retrieval Pattern**
   - **Question**: How should application code retrieve AI-BOARD user ID consistently?
   - **Research**: Examine existing user lookup patterns, caching strategies, and error handling for system users
   - **Decision Target**: Choose between environment variable, database lookup with caching, or hardcoded constant

3. **Mention Detection in Comment Content**
   - **Question**: Does existing `mention-parser.ts` support detecting specific user mentions (e.g., filtering for AI-BOARD)?
   - **Research**: Review `extractMentionUserIds` implementation and determine if extension is needed
   - **Decision Target**: Reuse existing parser or extend with AI-BOARD-specific detection

4. **Job Status Locking Strategy**
   - **Question**: How to prevent race conditions when multiple users mention @ai-board simultaneously?
   - **Research**: Review existing Job creation patterns, database transaction isolation, and error handling
   - **Decision Target**: Database-level locking vs. optimistic concurrency control vs. application-level mutex

5. **Claude CLI JSON Output Parsing**
   - **Question**: How to robustly parse Claude CLI stdout for JSON response?
   - **Research**: Investigate GitHub workflow output capture, JSON extraction from mixed stdout, error handling patterns
   - **Decision Target**: Choose parsing strategy (regex extraction, line filtering, process exit code checks)

6. **AI-BOARD Comment Author Display**
   - **Question**: Should AI-BOARD comments have special visual treatment beyond standard comment display?
   - **Research**: Review existing comment rendering, user avatar display, and design system patterns
   - **Decision Target**: Reuse existing Comment component or add AI-BOARD-specific styling

### Best Practices Research

1. **GitHub Actions Workflow Best Practices**
   - Workflow timeout handling and job status updates
   - Secret management for API keys and workflow tokens
   - Conditional execution patterns (skip [e2e], skip BUILD/VERIFY)

2. **Prisma Transaction Patterns**
   - Project creation with auto-membership (transactional integrity)
   - Error handling and rollback strategies

3. **TanStack Query Integration**
   - Optimistic updates for comment creation with AI-BOARD mentions
   - Cache invalidation after AI-BOARD responses

4. **Next.js API Route Security**
   - Workflow token authentication middleware
   - Request validation and error responses

### Research Output

All research findings will be documented in `research.md` with format:
- **Decision**: [Chosen approach]
- **Rationale**: [Why this approach]
- **Alternatives Considered**: [Other options evaluated]
- **Implementation Notes**: [Key details for tasks]

---

## Phase 1: Design & Contracts

### Data Model

Extract entities from feature spec → `data-model.md`:

**Entities**:
1. **AI-BOARD User** (existing User model)
   - email: "ai-board@system.local"
   - id: Retrieved via helper function
   - Constraints: Unique email, prevent UI deletion

2. **ProjectMember** (existing model)
   - projectId: References Project
   - userId: AI-BOARD user ID
   - role: "member"
   - Automatically created on project creation

3. **Job** (existing model)
   - command: "comment-specify" | "comment-plan" | "comment-build" | "comment-verify"
   - status: PENDING → RUNNING → COMPLETED/FAILED
   - Used for availability validation and workflow tracking

4. **Comment** (existing model)
   - userId: Can be session user OR AI-BOARD user
   - content: May contain @ai-board mention
   - Standard validation rules apply

**Relationships**:
- User (AI-BOARD) → ProjectMember (one-to-many)
- ProjectMember → Project (many-to-one)
- Job → Ticket (many-to-one)
- Comment → User (many-to-one, includes AI-BOARD)

**State Transitions**:
- Job Status: PENDING → RUNNING → COMPLETED/FAILED (existing state machine)
- AI-BOARD Availability: Available ↔ Unavailable (based on stage + job status)

**Validation Rules**:
- AI-BOARD mention only valid in stages: SPECIFY, PLAN, BUILD, VERIFY
- AI-BOARD mention blocked when ticket has job with status IN (PENDING, RUNNING)
- Comment content max 2000 chars (existing rule)
- AI-BOARD user must be ProjectMember for mention validation

### API Contracts

Generate OpenAPI specifications from functional requirements → `/contracts/`:

**Endpoints**:

1. **POST /api/projects/:projectId/tickets/:id/comments/ai-board**
   - Purpose: Create AI-BOARD comment (workflow-only)
   - Authentication: GitHub workflow token
   - Request: `{ content: string, userId: string }`
   - Response: Standard Comment object
   - Status Codes: 201 (created), 400 (validation), 401 (auth), 403 (not workflow), 500 (error)

2. **POST /api/projects/:projectId/tickets/:id/comments** (MODIFIED)
   - Enhanced: Detect @ai-board mention, create Job, dispatch workflow
   - Additional validation: AI-BOARD availability rules
   - Additional response data: Job ID if workflow dispatched

3. **POST /api/projects** (MODIFIED)
   - Enhanced: Automatically add AI-BOARD as ProjectMember
   - Transaction: Project creation + AI-BOARD membership atomic

4. **GitHub Workflow Dispatch** (NEW)
   - Workflow: `ai-board-assist.yml`
   - Inputs: ticket_id, ticket_title, stage, branch, user, comment, job_id, project_id
   - Triggers: On @ai-board mention detection
   - Outputs: None (posts comment and updates job status via API)

**Contract Files**:
- `contracts/ai-board-comment.yaml`: AI-BOARD comment endpoint OpenAPI spec
- `contracts/ai-board-assist.yaml`: GitHub workflow dispatch contract
- `contracts/mention-validation.yaml`: Availability validation rules (stage + job status)

### Quickstart Guide

Create `quickstart.md` for developers implementing this feature:

**Topics**:
1. AI-BOARD User Setup (seed script execution)
2. Environment Variables (GitHub token, workflow URL)
3. Local Testing (mock workflow execution)
4. Debugging Workflow Failures (job logs, Claude output)
5. Testing Checklist (E2E test coverage verification)

### Agent Context Update

Run `.specify/scripts/bash/update-agent-context.sh claude` to update `CLAUDE.md` with:
- AI-BOARD system user pattern (email, auto-membership)
- GitHub workflow dispatch integration (@ai-board mention → workflow)
- Workflow token authentication for API endpoints
- Job status availability validation pattern

---

## Phase 2 Preview: Implementation Tasks

*Phase 2 is handled by `/speckit.tasks` command - NOT created by `/speckit.plan`*

**Task categories** to be generated:
1. **Database Setup**: AI-BOARD user creation, migration (if needed)
2. **API Routes**: AI-BOARD comment endpoint, mention detection, project auto-membership
3. **Workflow**: GitHub Actions workflow file, Claude CLI command
4. **UI**: MentionInput component changes (greyed-out AI-BOARD, tooltips)
5. **Utilities**: Availability validation, workflow dispatcher, AI-BOARD user helpers
6. **Tests**: E2E tests for all user stories, API contract tests
7. **Documentation**: Update CLAUDE.md, quickstart guide, agent context

**Dependencies**:
- Database setup must complete before API routes
- API routes must complete before workflow testing
- UI changes can proceed in parallel with backend
- Tests written BEFORE each implementation task (TDD)

---

## Implementation Sequence

1. **Phase 0** (Research): Complete all research tasks, generate `research.md`
2. **Phase 1** (Design): Generate `data-model.md`, `contracts/`, `quickstart.md`, update agent context
3. **Phase 2** (Tasks): Use `/speckit.tasks` to generate dependency-ordered task list
4. **Phase 3** (Implementation): Use `/speckit.implement` to execute tasks with TDD

**Current Phase**: Phase 0 (Research) - Awaiting research.md generation
