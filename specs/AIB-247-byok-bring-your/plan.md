# Implementation Plan: BYOK - Bring Your Own API Key

**Branch**: `AIB-247-byok-bring-your` | **Date**: 2026-03-13 | **Spec**: `specs/AIB-247-byok-bring-your/spec.md`
**Input**: Feature specification from `/specs/AIB-247-byok-bring-your/spec.md`

## Summary

Allow project owners to securely store, manage, and use their own API keys for AI providers (Anthropic, OpenAI) at the project level. Keys are encrypted at rest with AES-256-GCM, never exposed after initial submission, validated against provider APIs, and injected into workflow executions. Free-plan users must configure BYOK keys before workflows can run.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), Prisma 6.x, shadcn/ui, TanStack Query v5, Node.js native `crypto` module
**Storage**: PostgreSQL 14+ via Prisma ORM (new `ProjectApiKey` model)
**Testing**: Vitest (unit + integration), Playwright (E2E browser tests)
**Target Platform**: Vercel (Next.js deployment)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Key save/replace < 3s, key validation < 5s, workflow key retrieval < 100ms
**Constraints**: AES-256-GCM authenticated encryption, HTTPS-only transmission, zero key exposure in logs/responses
**Scale/Scope**: 2 providers (Anthropic, OpenAI), per-project scoping, owner-only management

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in strict TypeScript with explicit types |
| II. Component-Driven | PASS | Uses shadcn/ui cards, follows settings page pattern |
| III. Test-Driven | PASS | Unit tests for crypto, integration for API, component for UI |
| IV. Security-First | PASS | AES-256-GCM encryption, Zod validation, owner-only access, no key logging |
| V. Database Integrity | PASS | Prisma migration for new model, unique constraints at schema level |
| VI. AI-First Development | PASS | No human documentation, follows existing patterns |
| Forbidden Dependencies | PASS | Uses Node.js native `crypto`, no new dependencies required |
| Color Standards | PASS | Tailwind semantic tokens only |

**Gate Result**: PASS - No violations detected.

## Project Structure

### Documentation (this feature)

```
specs/AIB-247-byok-bring-your/
├── plan.md              # This file
├── research.md          # Phase 0: Technical research
├── data-model.md        # Phase 1: Data model design
├── quickstart.md        # Phase 1: Implementation quickstart
├── contracts/           # Phase 1: API contracts
│   └── api-keys.md      # REST endpoints for BYOK
└── tasks.md             # Phase 2: Task breakdown (NOT created by /plan)
```

### Source Code (repository root)

```
app/
├── api/projects/[projectId]/api-keys/
│   ├── route.ts                    # GET (list masked), POST (create/replace)
│   └── [provider]/
│       ├── route.ts                # DELETE (remove key)
│       └── validate/route.ts       # POST (test key against provider)
├── projects/[projectId]/settings/  # Existing settings page (add BYOK section)

components/
└── settings/
    └── api-keys-card.tsx           # BYOK settings UI card

lib/
├── crypto/
│   └── encryption.ts               # AES-256-GCM encrypt/decrypt utilities
├── db/
│   └── api-keys.ts                 # Database operations for ProjectApiKey
└── validation/
    └── api-key-formats.ts          # Provider-specific format validation

prisma/
├── schema.prisma                   # Add ProjectApiKey model + ApiKeyProvider enum
└── migrations/                     # New migration

tests/
├── unit/
│   ├── crypto-encryption.test.ts   # AES-256-GCM unit tests
│   └── api-key-formats.test.ts     # Format validation tests
├── integration/
│   └── api-keys/
│       └── crud.test.ts            # API endpoint integration tests
└── unit/components/
    └── api-keys-card.test.tsx      # Settings card component tests
```

**Structure Decision**: Follows existing Next.js App Router conventions. New API routes nested under `projects/[projectId]/api-keys/` per REST resource pattern. Encryption utilities in `lib/crypto/` (new directory). Settings UI extends existing `components/settings/` pattern.

## Complexity Tracking

*No violations to justify.*
