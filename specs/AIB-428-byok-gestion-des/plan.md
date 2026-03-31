# Implementation Plan: BYOK - User API Key Management for AI Agents

**Branch**: `AIB-428-byok-gestion-des` | **Date**: 2026-03-31 | **Spec**: `specs/AIB-428-byok-gestion-des/spec.md`
**Input**: Feature specification from `/specs/AIB-428-byok-gestion-des/spec.md`

## Summary

Users must configure their own AI provider credentials (Anthropic API keys or OAuth tokens) before workflows can run. Credentials are encrypted at rest with AES-256-GCM, stored per-user per-provider, and retrieved by workflows via a secure internal endpoint authenticated by workflow token. The project owner's credential is used for all workflows on that project, regardless of who triggers them.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), Prisma 6.x, NextAuth.js, shadcn/ui, TanStack Query v5
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E)
**Target Platform**: Linux server (Next.js deployment)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Credential retrieval < 200ms for workflow launch; UI operations < 500ms
**Constraints**: AES-256-GCM encryption at rest; master key in `CREDENTIAL_ENCRYPTION_KEY` env var; credentials never in logs or client responses
**Scale/Scope**: One credential per provider per user; initially ANTHROPIC only; extensible enum for future providers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in strict TypeScript with explicit types; Zod schemas for API validation |
| II. Component-Driven Architecture | PASS | Settings UI uses shadcn/ui components; feature folder `/components/credentials/`; API routes in `/app/api/credentials/` |
| III. Test-Driven Development | PASS | Integration tests for API endpoints and encryption; component tests for settings UI; no E2E needed (no browser-only features) |
| IV. Security-First Design | PASS | AES-256-GCM encryption; Zod input validation; master key in env var; credentials never exposed in responses; workflow token auth |
| V. Database Integrity | PASS | New `UserCredential` model via Prisma migration; unique constraint (userId, provider); no raw SQL |
| V. Specification Guardrails | PASS | Auto-resolved decisions documented with CONSERVATIVE policy; trade-offs explicit |

**Gate result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```
specs/AIB-428-byok-gestion-des/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: research findings
├── data-model.md        # Phase 1: data model design
├── quickstart.md        # Phase 1: implementation quickstart
├── contracts/           # Phase 1: API contracts
│   ├── credentials-api.md
│   └── workflow-credential-api.md
└── tasks.md             # Phase 2 output (NOT created by /plan)
```

### Source Code (repository root)

```
# New files for this feature
lib/
├── crypto/
│   └── credentials.ts          # AES-256-GCM encrypt/decrypt utilities
├── db/
│   └── credentials.ts          # Prisma CRUD operations for UserCredential
└── credentials/
    └── validation.ts           # Provider-specific format validation

app/
├── api/
│   ├── credentials/
│   │   └── route.ts            # GET (list) / POST (create/replace) user credentials
│   ├── credentials/[id]/
│   │   ├── route.ts            # DELETE credential
│   │   └── test/
│   │       └── route.ts        # POST test credential against provider
│   └── internal/
│       └── credentials/
│           └── route.ts        # GET decrypted credential (workflow token auth)
├── settings/
│   └── credentials/
│       └── page.tsx            # User credential management page
└── components/
    └── credentials/
        ├── credential-form.tsx     # Add/replace credential form
        ├── credential-list.tsx     # List existing credentials
        └── credential-test-button.tsx  # Test credential button

# Modified files
app/lib/workflows/
├── dispatch-ai-board.ts        # Add credential retrieval before dispatch
├── dispatch-deploy-preview.ts  # No change (no AI credential needed)
└── dispatch-rollback-reset.ts  # No change (no AI credential needed)

prisma/
└── schema.prisma               # Add UserCredential model + CredentialProvider + CredentialType enums

tests/
├── unit/
│   └── crypto-credentials.test.ts       # Encrypt/decrypt unit tests
├── unit/components/
│   └── credential-form.test.tsx         # Component tests for credential form
├── integration/
│   └── credentials/
│       ├── credentials-api.test.ts      # CRUD API integration tests
│       ├── credential-validation.test.ts # Provider validation tests
│       └── workflow-credential.test.ts  # Workflow credential retrieval tests
```

**Structure Decision**: Web application pattern — API routes in `app/api/`, UI in `app/settings/`, shared logic in `lib/`. Follows existing patterns for tokens (`lib/tokens/`, `app/api/tokens/`, `app/settings/tokens/`).

## Testing Strategy

| User Story | Test Type | Location | Rationale |
|------------|-----------|----------|-----------|
| US1: Configure credential | Integration | `tests/integration/credentials/credentials-api.test.ts` | API + DB operations |
| US1: Format validation | Unit | `tests/unit/crypto-credentials.test.ts` | Pure function validation |
| US1: Credential form UI | Component | `tests/unit/components/credential-form.test.tsx` | React form with user interactions |
| US2: Workflow retrieves credential | Integration | `tests/integration/credentials/workflow-credential.test.ts` | API + auth + decryption |
| US2: Block workflow without credential | Integration | `tests/integration/credentials/workflow-credential.test.ts` | API behavior |
| US3: Test/replace/delete credential | Integration | `tests/integration/credentials/credentials-api.test.ts` | CRUD API operations |
| Encryption round-trip | Unit | `tests/unit/crypto-credentials.test.ts` | Pure crypto function |

No E2E tests needed — all features testable via API integration and component tests.

## Complexity Tracking

*No constitution violations to justify.*
