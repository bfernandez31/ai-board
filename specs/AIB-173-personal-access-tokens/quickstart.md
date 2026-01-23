# Quickstart: Personal Access Tokens Implementation

**Feature Branch**: `AIB-173-personal-access-tokens`
**Date**: 2026-01-23

## Implementation Sequence

### 1. Database Schema

Add PersonalAccessToken model to Prisma schema and generate migration.

**Files**:
- `prisma/schema.prisma` - Add model and User relation

**Verification**: `bunx prisma migrate dev --name add-personal-access-tokens`

---

### 2. Token Utilities

Create token generation and validation utilities.

**Files**:
- `lib/tokens/generate.ts` - Token creation with hashing
- `lib/tokens/validate.ts` - Token validation with hash verification
- `lib/db/tokens.ts` - Database operations (CRUD)

**Key Functions**:
```typescript
// generate.ts
generatePersonalAccessToken(): { token, hash, salt, preview }

// validate.ts
validateToken(token: string): Promise<{ userId: string } | null>

// tokens.ts
createToken(userId, name, hash, salt, preview): Promise<TokenListItem>
listTokens(userId): Promise<TokenListItem[]>
deleteToken(id, userId): Promise<void>
updateLastUsed(id): Promise<void>
```

**Verification**: Unit tests pass (`bun run test:unit`)

---

### 3. Authentication Integration

Extend existing auth helpers to support Bearer tokens.

**Files**:
- `lib/db/users.ts` - Add `getCurrentUserOrToken()` helper

**Integration Point**:
```typescript
// Before (session only)
const user = await getCurrentUser();

// After (token OR session)
const user = await getCurrentUserOrToken(request);
```

**Verification**: Integration tests pass with both auth methods

---

### 4. API Endpoints

Create token management API routes.

**Files**:
- `app/api/tokens/route.ts` - GET (list), POST (create)
- `app/api/tokens/[id]/route.ts` - DELETE (revoke)

**Verification**: Integration tests for all endpoints

---

### 5. UI Components

Create token management UI with shadcn/ui.

**Files**:
- `app/settings/tokens/page.tsx` - Settings page
- `components/tokens/token-list.tsx` - Token table
- `components/tokens/token-item.tsx` - Single token row
- `components/tokens/create-token-dialog.tsx` - Generation modal
- `components/tokens/delete-token-dialog.tsx` - Deletion confirmation

**Verification**: E2E tests for token generation flow

---

### 6. Rate Limiting

Add basic rate limiting for token validation.

**Files**:
- `lib/tokens/rate-limit.ts` - In-memory rate limiter

**Verification**: Rate limit triggers on excessive requests

---

## File Checklist

### New Files

| File | Purpose |
|------|---------|
| `lib/tokens/generate.ts` | Token generation + hashing |
| `lib/tokens/validate.ts` | Token validation |
| `lib/tokens/rate-limit.ts` | Rate limiting |
| `lib/db/tokens.ts` | Token database operations |
| `app/api/tokens/route.ts` | List/create endpoints |
| `app/api/tokens/[id]/route.ts` | Delete endpoint |
| `app/settings/tokens/page.tsx` | Settings page |
| `components/tokens/token-list.tsx` | Token table |
| `components/tokens/token-item.tsx` | Token row |
| `components/tokens/create-token-dialog.tsx` | Create modal |
| `components/tokens/delete-token-dialog.tsx` | Delete modal |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add PersonalAccessToken model |
| `lib/db/users.ts` | Add getCurrentUserOrToken() |

### Test Files

| File | Coverage |
|------|----------|
| `tests/unit/tokens/generate.test.ts` | Token generation, hashing |
| `tests/unit/tokens/validate.test.ts` | Token validation |
| `tests/integration/tokens/api.test.ts` | API endpoints |
| `tests/e2e/tokens.spec.ts` | UI flows (browser-required) |

---

## Validation Commands

```bash
# Schema migration
bunx prisma migrate dev --name add-personal-access-tokens
bunx prisma generate

# Type checking
bun run type-check

# Unit tests
bun run test:unit tests/unit/tokens/

# Integration tests
bun run test:integration tests/integration/tokens/

# E2E tests
bun run test:e2e tests/e2e/tokens.spec.ts

# Full test suite
bun run test
```
