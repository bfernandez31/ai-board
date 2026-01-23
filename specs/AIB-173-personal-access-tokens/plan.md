# Implementation Plan: Personal Access Tokens for API Authentication

**Branch**: `AIB-173-personal-access-tokens` | **Date**: 2026-01-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-173-personal-access-tokens/spec.md`

## Summary

Add a Personal Access Token (PAT) system enabling external tools (MCP servers, CLI, CI pipelines) to authenticate with ai-board API. Users generate named tokens displayed once, stored as SHA-256 hashes with unique salts. API requests authenticate via `Authorization: Bearer pat_xxxxx` headers. Token management UI at `/settings/tokens` provides generation, listing, and deletion capabilities.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), NextAuth.js, Prisma 6.x, shadcn/ui, TanStack Query v5
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E browser-required only)
**Target Platform**: Vercel (Node.js serverless)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Token validation <50ms, minimal overhead on existing API requests
**Constraints**: Token displayed only once at generation, no plain-text storage, rate limiting on auth endpoints
**Scale/Scope**: User-level tokens, single ai-board application

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status |
|-----------|-------------|--------|
| I. TypeScript-First | Explicit types for all token operations, Zod validation | ✅ PASS |
| II. Component-Driven | Use shadcn/ui for token management UI (Dialog, Button, Input, Table) | ✅ PASS |
| III. Test-Driven | Unit tests for token hashing, integration tests for API auth, E2E for token modal UX | ✅ PASS |
| IV. Security-First | SHA-256 hashing with salt, Zod input validation, no plain-text storage, rate limiting | ✅ PASS |
| V. Database Integrity | Prisma migration for PersonalAccessToken model, cascade delete with User | ✅ PASS |
| VI. AI-First Development | No tutorials/guides, spec files in `specs/AIB-173-personal-access-tokens/` | ✅ PASS |

**Gate Status**: PASS - No violations, proceed to Phase 0

## Project Structure

### Documentation (this feature)

```
specs/AIB-173-personal-access-tokens/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Next.js App Router structure (existing project patterns)
app/
├── api/
│   └── tokens/                    # NEW: Token management API
│       └── route.ts               # GET (list), POST (create)
│       └── [id]/route.ts          # DELETE (revoke)
├── settings/
│   └── tokens/                    # NEW: Token management page
│       └── page.tsx

components/
├── tokens/                        # NEW: Token management components
│   ├── token-list.tsx
│   ├── token-item.tsx
│   ├── create-token-dialog.tsx
│   └── delete-token-dialog.tsx

lib/
├── auth.ts                        # MODIFY: Add token validation
├── auth-edge.ts                   # MODIFY: Add token validation (Edge Runtime)
├── tokens/                        # NEW: Token utilities
│   ├── generate.ts                # Token generation + hashing
│   └── validate.ts                # Token validation for API auth
├── db/
│   └── tokens.ts                  # NEW: Token database operations
└── hooks/
    └── mutations/
        └── useTokens.ts           # NEW: Token mutation hooks

prisma/
├── schema.prisma                  # MODIFY: Add PersonalAccessToken model

tests/
├── unit/
│   └── tokens/
│       ├── generate.test.ts       # NEW: Token generation tests
│       └── validate.test.ts       # NEW: Token validation tests
├── integration/
│   └── tokens/
│       └── api.test.ts            # NEW: Token API tests
└── e2e/
    └── tokens.spec.ts             # NEW: Token UI tests (browser-required)
```

**Structure Decision**: Next.js App Router web application following existing project patterns. Token components in `components/tokens/`, API routes in `app/api/tokens/`, settings page at `app/settings/tokens/`. Token utilities in `lib/tokens/` following separation of concerns (generation vs validation).

## Complexity Tracking

*No Constitution Check violations - section not applicable.*

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion.*

| Principle | Design Compliance | Status |
|-----------|-------------------|--------|
| I. TypeScript-First | All token types defined, Zod schemas for API validation, explicit function signatures | ✅ PASS |
| II. Component-Driven | shadcn/ui Dialog, Button, Table, Input components specified; feature folder structure | ✅ PASS |
| III. Test-Driven | Testing Trophy: unit (generate/validate), integration (API), E2E (modal UX only) | ✅ PASS |
| IV. Security-First | SHA-256+salt, constant-time comparison, rate limiting, no plain-text storage | ✅ PASS |
| V. Database Integrity | Prisma migration, cascade delete, proper indexes, nullable lastUsedAt | ✅ PASS |
| VI. AI-First Development | All artifacts in specs folder, no README/tutorial files | ✅ PASS |

**Post-Design Gate Status**: PASS - Design complies with all constitution principles.

## Generated Artifacts

| Artifact | Path | Purpose |
|----------|------|---------|
| Research | `specs/AIB-173-personal-access-tokens/research.md` | Technology decisions and rationale |
| Data Model | `specs/AIB-173-personal-access-tokens/data-model.md` | Database schema and validation rules |
| API Contract | `specs/AIB-173-personal-access-tokens/contracts/api.yaml` | OpenAPI spec for token management |
| Auth Contract | `specs/AIB-173-personal-access-tokens/contracts/auth-integration.md` | Bearer token authentication flow |
| Quickstart | `specs/AIB-173-personal-access-tokens/quickstart.md` | Implementation sequence and file checklist |

## Next Step

Run `/speckit.tasks` to generate actionable implementation tasks from this plan.
