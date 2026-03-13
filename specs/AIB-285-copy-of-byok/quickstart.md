# Quickstart: BYOK Implementation

**Branch**: `AIB-285-copy-of-byok` | **Date**: 2026-03-13

## Implementation Order

### Layer 1: Foundation (no UI dependency)
1. **Prisma schema** - Add `ProjectAPIKey` model and `APIProvider` enum
2. **Encryption utility** - `lib/encryption/api-keys.ts` (AES-256-GCM encrypt/decrypt)
3. **Environment** - Add `ENCRYPTION_MASTER_KEY` to `.env.example`

### Layer 2: API Routes
4. **Database helpers** - `lib/db/api-keys.ts` (CRUD operations with encryption)
5. **Validation utility** - `lib/api-keys/validate.ts` (provider-specific key validation)
6. **API routes** - `app/api/projects/[projectId]/api-keys/` (GET, POST, DELETE, validate)

### Layer 3: Workflow Integration
7. **Transition update** - Modify `lib/workflows/transition.ts` to inject decrypted keys into workflow inputs
8. **Pre-dispatch check** - Block workflow dispatch for external projects without configured keys (FR-009)

### Layer 4: UI
9. **APIKeysCard component** - `components/settings/api-keys-card.tsx`
10. **Settings page update** - Add APIKeysCard to `app/projects/[projectId]/settings/page.tsx`

### Layer 5: Tests
11. **Unit tests** - Encryption utility, format validation
12. **Integration tests** - API endpoints (save, list, delete, validate)
13. **Component tests** - APIKeysCard rendering and interactions

## Key Files to Create

| File | Purpose |
|------|---------|
| `lib/encryption/api-keys.ts` | AES-256-GCM encryption/decryption functions |
| `lib/db/api-keys.ts` | Database CRUD for ProjectAPIKey |
| `lib/api-keys/validate.ts` | Provider-specific key validation (Anthropic, OpenAI) |
| `app/api/projects/[projectId]/api-keys/route.ts` | GET (list) + POST (save) endpoints |
| `app/api/projects/[projectId]/api-keys/validate/route.ts` | POST (test key) endpoint |
| `app/api/projects/[projectId]/api-keys/[provider]/route.ts` | DELETE endpoint |
| `components/settings/api-keys-card.tsx` | UI card for managing API keys |

## Key Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `ProjectAPIKey` model, `APIProvider` enum, relation on `Project` |
| `lib/workflows/transition.ts` | Inject BYOK keys into workflow dispatch inputs |
| `app/projects/[projectId]/settings/page.tsx` | Add APIKeysCard to settings page |
| `.env.example` | Add `ENCRYPTION_MASTER_KEY` |

## Critical Constraints

- **NEVER** log or return plaintext API keys (FR-010, FR-011)
- **NEVER** send keys to client after initial submission (FR-011)
- Use `verifyProjectOwnership()` for all mutating endpoints (FR-012)
- Trim whitespace before validation and storage (edge case)
- Support save-without-validation when provider is unreachable (FR-014)
