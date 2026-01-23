# Implementation Plan: Personal Access Tokens for API Authentication

**Branch**: `AIB-184-personal-access-tokens` | **Date**: 2026-01-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-184-personal-access-tokens/spec.md`

## Summary

Implement a Personal Access Token (PAT) system allowing external tools (MCP servers, CLI tools, CI/CD pipelines) to authenticate with the ai-board API. Tokens are bcrypt-hashed before storage, displayed once on creation, and support immediate revocation. The implementation extends the existing NextAuth.js authentication system to support Bearer token authentication alongside session-based auth.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router), NextAuth.js, Prisma 6.x, bcrypt, shadcn/ui
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E browser-required only)
**Target Platform**: Vercel serverless deployment
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: Token validation adds <150ms overhead per request (spec SC-002)
**Constraints**: Max 10 tokens per user, bcrypt cost factor 12, token names 1-50 chars
**Scale/Scope**: Existing user base, ~5-10 external integrations per power user

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| I. TypeScript-First | Strict mode, explicit types, no `any` | ✅ PASS | All new code will have explicit types |
| II. Component-Driven | shadcn/ui exclusively, Server Components default | ✅ PASS | Token management UI uses existing Card, Dialog, Button, Input |
| III. Test-Driven | Testing Trophy: Unit → Component → Integration → E2E | ✅ PASS | Integration tests for API, Component tests for UI |
| IV. Security-First | Zod validation, parameterized queries, secrets in env | ✅ PASS | Token hashed with bcrypt, validation via Zod |
| V. Database Integrity | Prisma migrations, cascade deletes, constraints | ✅ PASS | PersonalAccessToken model with foreign key cascade |
| VI. AI-First | No human-oriented docs, specs in specs/ folder | ✅ PASS | All artifacts in specs/AIB-184-personal-access-tokens/ |

**Gate Result**: ✅ PASSED - No constitution violations detected

## Project Structure

### Documentation (this feature)

```
specs/AIB-184-personal-access-tokens/
├── plan.md              # This file
├── research.md          # Phase 0 output - research findings
├── data-model.md        # Phase 1 output - entity definitions
├── quickstart.md        # Phase 1 output - implementation guide
├── contracts/           # Phase 1 output - API contract definitions
│   └── pat-api.yaml     # OpenAPI spec for PAT endpoints
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```
# Next.js App Router structure (existing project)
app/
├── api/
│   └── tokens/
│       └── route.ts           # POST (create), GET (list) tokens
│       └── [id]/
│           └── route.ts       # DELETE (revoke) single token
├── settings/
│   └── tokens/
│       └── page.tsx           # Token management page

components/
├── settings/
│   └── token-card.tsx         # Token list card component
│   └── create-token-dialog.tsx # Token generation dialog
│   └── revoke-token-dialog.tsx # Confirmation dialog

lib/
├── auth/
│   └── token-auth.ts          # Token validation middleware
├── db/
│   └── tokens.ts              # Token CRUD operations
└── validations/
    └── token.ts               # Zod schemas for token API

prisma/
└── schema.prisma              # Add PersonalAccessToken model

tests/
├── integration/
│   └── tokens/
│       └── crud.test.ts       # API endpoint tests
└── unit/
    └── components/
        └── token-card.test.tsx # Component tests
```

**Structure Decision**: Follows existing Next.js App Router structure. New API routes under `/api/tokens/`, settings page at `/settings/tokens`, components in `/components/settings/`. Auth logic extends existing patterns in `/lib/auth/` and `/lib/db/`.

## Complexity Tracking

*No constitution violations - complexity tracking not required.*

## Post-Design Constitution Re-Check

After completing Phase 1 design artifacts, re-validating against constitution:

| Principle | Requirement | Status | Verification |
|-----------|-------------|--------|--------------|
| I. TypeScript-First | Strict mode, explicit types | ✅ PASS | All code samples use explicit TypeScript types |
| II. Component-Driven | shadcn/ui exclusively | ✅ PASS | UI uses Card, Dialog, AlertDialog, Button, Input |
| III. Test-Driven | Testing Trophy | ✅ PASS | Integration tests for API, Component tests for UI (no E2E needed) |
| IV. Security-First | Zod validation, secrets safe | ✅ PASS | Two-tier hashing (SHA-256 lookup + bcrypt verify), Zod schemas |
| V. Database Integrity | Prisma migrations, cascades | ✅ PASS | PersonalAccessToken model with onDelete: Cascade |
| VI. AI-First | No human docs | ✅ PASS | All artifacts in specs/ folder |

**Post-Design Gate Result**: ✅ PASSED

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Research | [research.md](./research.md) | ✅ Complete |
| Data Model | [data-model.md](./data-model.md) | ✅ Complete |
| API Contract | [contracts/pat-api.yaml](./contracts/pat-api.yaml) | ✅ Complete |
| Quickstart | [quickstart.md](./quickstart.md) | ✅ Complete |
| Tasks | tasks.md | ⏳ Pending (Phase 2 - /speckit.tasks) |

## Key Design Decisions

1. **Two-tier token hashing**: SHA-256 for fast database lookup, bcrypt for verification
2. **Token format**: `pat_` prefix + 32 hex chars (128-bit entropy)
3. **Settings location**: User-level `/settings/tokens` (not project-level)
4. **Auth integration**: Bearer token checked before NextAuth session
5. **No caching**: Database lookup on every request for immediate revocation
