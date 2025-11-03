# Implementation Plan: Manual Vercel Deploy Preview

**Branch**: `080-1490-deploy-preview` | **Date**: 2025-11-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/080-1490-deploy-preview/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable manual Vercel preview deployment for tickets in VERIFY stage with COMPLETED jobs. Users can trigger deployment via a deploy icon on ticket cards, see deployment progress via job status indicators, and access deployed previews via a clickable preview URL icon. System enforces single active preview at a time with confirmation modal when replacing existing deployments.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode), Node.js 22.20.0 LTS
**Primary Dependencies**: Next.js 15 (App Router), React 18, Prisma 6.x, TanStack Query v5, shadcn/ui
**Storage**: PostgreSQL 14+ via Prisma (new fields: Ticket.previewUrl, Job.command="deploy-preview")
**Testing**: Vitest (unit tests), Playwright (integration/E2E tests with MCP support)
**Target Platform**: Vercel serverless (Next.js deployment), GitHub Actions workflows
**Project Type**: Web application (frontend + backend API routes)
**Performance Goals**: <2s preview icon update after deployment completion (via job polling), <5min deployment completion
**Constraints**: Single active preview deployment (transactional enforcement), GitHub/Vercel API rate limits, workflow authentication (WORKFLOW_API_TOKEN, VERCEL_TOKEN secrets)
**Scale/Scope**: Multi-project system (project-scoped deployments), ~10-50 concurrent tickets per project, single-user deployments

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: TypeScript-First Development ✅ PASS
- Ticket.previewUrl field typed as `string?` (nullable)
- Job.command extended with "deploy-preview" literal type
- All API endpoints have explicit request/response types (Zod schemas)
- No `any` types introduced

### Principle II: Component-Driven Architecture ✅ PASS
- Deploy icon component using shadcn/ui Button primitives
- Preview icon component using shadcn/ui ExternalLink or custom icon
- Confirmation modal using shadcn/ui Dialog component
- API routes follow Next.js conventions: `/api/projects/[projectId]/tickets/[id]/deploy`
- Feature folder: `/components/board/` (extends existing ticket card components)

### Principle III: Test-Driven Development ✅ PASS
- Unit tests (Vitest): Deployment eligibility logic, single-preview enforcement validation
- Integration tests (Playwright): Deploy icon rendering, confirmation modal flow, preview icon click behavior
- E2E tests (Playwright): Full deployment workflow (trigger → job status → preview URL appears)
- Tests written BEFORE implementation (Red-Green-Refactor)

### Principle IV: Security-First Design ✅ PASS
- Vercel API token stored in GitHub secrets (VERCEL_TOKEN), never committed
- GitHub workflow authentication uses WORKFLOW_API_TOKEN secret
- Input validation: Ticket ID, project ID (Zod schemas)
- Preview URL validation: Max length, HTTPS-only URLs
- Authorization: User must be project owner/member to trigger deployment

### Principle V: Database Integrity ✅ PASS
- Schema changes via Prisma migration (add Ticket.previewUrl field)
- Transaction protection: Single-preview constraint enforced with `prisma.$transaction`
- Job creation atomic with preview URL clearing (existing preview invalidation)
- No optional fields without defaults: `previewUrl String? @default(null)`

### Principle VI: Specification Clarification Guardrails ✅ PASS
- AUTO policy applied (spec.md confirms CONSERVATIVE recommendation followed)
- Single-preview constraint enforced to prevent resource issues
- Confirmation modal prevents accidental deployments
- Trade-offs documented in spec.md Auto-Resolved Decisions section

**GATE STATUS**: ✅ ALL CHECKS PASS - Proceed to Phase 0

---

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design artifacts (research.md, data-model.md, contracts/) generated*

### Principle I: TypeScript-First Development ✅ PASS (Reconfirmed)
- All contracts specify explicit Zod schemas for request/response validation
- Database queries use Prisma type-safe client (no raw SQL)
- Frontend components use TypeScript interfaces for props
- API responses typed with TypeScript interfaces (Job, Error schemas)
- No `any` types introduced in design artifacts

### Principle II: Component-Driven Architecture ✅ PASS (Reconfirmed)
- UI components documented: `ticket-card-preview-icon.tsx`, `ticket-card-deploy-icon.tsx`, `deploy-confirmation-modal.tsx`
- All components use shadcn/ui primitives (Button, Dialog, ExternalLink)
- API routes follow Next.js conventions: `/app/api/projects/[projectId]/tickets/[id]/deploy/route.ts`
- Feature organized in `/components/board/` folder (existing structure)
- Server Components by default, Client Components only for interactive icons

### Principle III: Test-Driven Development ✅ PASS (Reconfirmed)
- Unit tests defined for deployment eligibility logic (Vitest)
- Integration tests defined for icon rendering and modal behavior (Playwright)
- E2E tests defined for full deployment workflow (Playwright)
- Test scenarios documented in data-model.md (6 unit tests, 5 integration tests, 3 E2E tests)
- TDD workflow confirmed: Write tests → Red → Implement → Green → Refactor

### Principle IV: Security-First Design ✅ PASS (Reconfirmed)
- All user inputs validated with Zod schemas (`previewUrlSchema`, deployment eligibility checks)
- Prisma parameterized queries used exclusively (no raw SQL in contracts)
- Secrets stored in GitHub repository secrets (VERCEL_TOKEN, WORKFLOW_API_TOKEN)
- Preview URL validation: HTTPS-only, Vercel domain pattern, max 500 chars
- Authorization enforced: User must be project owner/member (existing `verifyProjectAccess()` helper)
- Workflow token authentication for internal API endpoints (Bearer token)

### Principle V: Database Integrity ✅ PASS (Reconfirmed)
- Schema change via Prisma migration (`add_ticket_preview_url`)
- Transaction protection for single-preview enforcement (`prisma.$transaction`)
- Nullable field with explicit null handling (`previewUrl String? @default(null)`)
- No foreign key changes (reuses existing Job → Ticket relationship)
- Rollback procedure documented in quickstart.md

### Principle VI: Specification Clarification Guardrails ✅ PASS (Reconfirmed)
- AUTO policy applied with CONSERVATIVE fallback (documented in spec.md)
- Trade-offs documented: Single-preview constraint, manual trigger, URL persistence
- No quality degradation from auto-resolution
- Security, testing, and data integrity requirements preserved

**POST-DESIGN GATE STATUS**: ✅ ALL CHECKS PASS - Ready for Phase 2 (Task Generation)

### Design Decisions Summary

All design decisions comply with constitution principles:

1. **Reuse Existing Patterns**: Job model, job polling hook, authorization helpers (no new complexity)
2. **Security-First**: Vercel CLI in GitHub Actions (official tooling), token-based auth, HTTPS validation
3. **TypeScript Strict Mode**: All schemas, APIs, and components explicitly typed
4. **Test Coverage**: Unit (Vitest) + Integration (Playwright) + E2E (Playwright) = 14+ test scenarios
5. **Transaction Safety**: Single-preview enforcement via `$transaction` (ACID guarantees)
6. **Shadcn/ui Components**: All UI primitives reuse existing library (Button, Dialog, icons)

**No constitution violations identified** - implementation can proceed to task generation phase.

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
app/
├── api/
│   └── projects/
│       └── [projectId]/
│           └── tickets/
│               └── [id]/
│                   └── deploy/
│                       └── route.ts         # POST /api/projects/:projectId/tickets/:id/deploy
│
├── lib/
│   ├── hooks/
│   │   └── mutations/
│   │       └── useDeployPreview.ts         # TanStack Query mutation hook
│   ├── schemas/
│   │   └── deploy-preview.ts               # Zod validation schemas
│   └── workflows/
│       └── dispatch-deploy-preview.ts      # GitHub workflow dispatcher
│
components/
└── board/
    ├── ticket-card-preview-icon.tsx        # Preview URL icon (clickable)
    ├── ticket-card-deploy-icon.tsx         # Deploy trigger icon
    └── deploy-confirmation-modal.tsx       # Confirmation dialog (shadcn/ui)

prisma/
├── schema.prisma                           # Add Ticket.previewUrl field
└── migrations/
    └── [timestamp]_add_ticket_preview_url/ # Migration for new field

.github/
└── workflows/
    └── deploy-preview.yml                  # New GitHub Actions workflow

tests/
├── unit/
│   └── deploy-preview-eligibility.test.ts  # Vitest: eligibility logic
├── integration/
│   └── deploy-preview/
│       ├── deploy-icon.spec.ts             # Playwright: icon rendering
│       └── confirmation-modal.spec.ts      # Playwright: modal behavior
└── e2e/
    └── deploy-preview-workflow.spec.ts     # Playwright: full deployment flow
```

**Structure Decision**: Web application structure (Next.js 15 App Router). Frontend components in `/components/board/` (extends existing ticket card). Backend API routes in `/app/api/projects/`. GitHub workflow in `.github/workflows/`. Database migration in `prisma/migrations/`. Tests use hybrid strategy: Vitest for pure logic, Playwright for integration/E2E.

## Complexity Tracking

*No violations identified - all constitution checks passed without exceptions.*
