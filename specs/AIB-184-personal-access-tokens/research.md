# Research: Personal Access Tokens for API Authentication

**Feature**: AIB-184-personal-access-tokens
**Date**: 2026-01-23

## Research Tasks

### 1. Token Hashing Algorithm

**Decision**: bcrypt with cost factor 12

**Rationale**:
- bcrypt is an adaptive hash function designed for password/secret storage
- Cost factor 12 provides ~250ms hash time on modern hardware - appropriate security/performance tradeoff
- Already used in many authentication systems (industry standard)
- Built-in salt generation prevents rainbow table attacks

**Alternatives Considered**:
- SHA-256: Rejected - too fast for secrets, vulnerable to brute-force
- Argon2: Considered - excellent security but less ecosystem support in Node.js
- scrypt: Considered - good but bcrypt has better library support

**Implementation Note**: Use `bcrypt` npm package (well-maintained, native bindings for performance)

---

### 2. Token Format and Generation

**Decision**: `pat_` prefix + 32 character hex string (128-bit entropy)

**Rationale**:
- Prefix makes tokens instantly identifiable (aids debugging, log scanning)
- 128-bit entropy (32 hex chars) provides 2^128 possible values - computationally infeasible to brute-force
- Hex encoding is URL-safe and easy to copy/paste
- Total length: 36 characters (`pat_` + 32 chars)

**Alternatives Considered**:
- UUID v4: Rejected - predictable format, hyphens complicate copy/paste
- Base64 encoding: Considered - slightly shorter but special characters cause issues
- Raw bytes: Rejected - not human-readable for debugging

**Implementation Note**: Use `crypto.randomBytes(16).toString('hex')` for cryptographically secure generation

---

### 3. Token Validation Strategy

**Decision**: Database lookup on every request (no caching)

**Rationale**:
- Immediate revocation is a security requirement (FR-011)
- Token deletion must immediately prevent API access
- Simplifies implementation - no cache invalidation logic needed
- Database read is cheap (~5-10ms) compared to bcrypt comparison

**Alternatives Considered**:
- Short-lived cache (1-5 min): Rejected - delays revocation, complexity not justified
- JWT tokens with refresh: Rejected - over-engineered for this use case
- Stateless tokens: Rejected - cannot revoke without blacklist

**Performance Note**: If high-volume API usage causes issues, consider adding read replicas or a brief (30-second) invalidation-aware cache in the future.

---

### 4. Authentication Integration

**Decision**: Extend existing middleware to check Bearer token before NextAuth session

**Rationale**:
- Existing `middleware.ts` handles auth for all routes
- Token auth should work identically to session auth from the API's perspective
- Both auth methods return the same user context

**Implementation Approach**:
1. Check `Authorization: Bearer pat_xxx` header first
2. If valid token found, set user context and proceed
3. If no Bearer token, fall back to existing NextAuth session check
4. Both paths produce identical `{ userId }` for downstream handlers

**Key Files to Modify**:
- `/lib/db/users.ts` - Add `getUserFromToken()` function
- `/lib/auth/` - New `token-auth.ts` for token validation logic
- Existing auth helpers automatically work (they use `requireAuth()`)

---

### 5. Token Preview Storage

**Decision**: Store last 4 characters of plain token before hashing

**Rationale**:
- Allows users to identify tokens without exposing full value
- Industry standard pattern (GitHub, Stripe, AWS all use 4-char previews)
- Stored separately from hash - no security risk

**Implementation Note**: Extract preview before hashing: `const preview = plainToken.slice(-4)`

---

### 6. Maximum Tokens Per User

**Decision**: 10 tokens per user (enforced at API level)

**Rationale**:
- Prevents abuse (token hoarding, enumeration attacks)
- 10 is sufficient for typical use cases (CLI, MCP, CI, few other tools)
- Easy to increase later if user feedback indicates need

**Implementation Note**: Check count before creation, return 400 error with clear message if limit exceeded

---

### 7. Token Name Constraints

**Decision**: 1-50 characters, allow duplicates per user

**Rationale**:
- Minimum 1 char prevents empty/whitespace-only names
- Maximum 50 chars is sufficient for descriptive names without database bloat
- Allow duplicates - users can distinguish by preview and creation date
- Unique constraint would add friction with no real benefit

**Zod Schema**:
```typescript
z.string().min(1, 'Token name is required').max(50, 'Token name must be 50 characters or less')
```

---

### 8. Error Response Strategy

**Decision**: Generic "Unauthorized" for all auth failures

**Rationale**:
- Security best practice - don't reveal whether token exists, is revoked, or malformed
- Prevents enumeration attacks
- Consistent with existing auth error patterns in codebase

**Implementation Note**: All token validation failures return `{ error: 'Unauthorized' }` with 401 status

---

### 9. Last Used Timestamp Update

**Decision**: Update on every successful authentication

**Rationale**:
- Provides visibility into token usage for security audit
- Helps users identify stale tokens to revoke
- Minimal performance impact (async update after request processing)

**Implementation Note**: Update `lastUsedAt` timestamp after successful token validation, but don't block the request on this update

---

### 10. UI Component Selection

**Decision**: Token management at `/settings/tokens` using existing shadcn/ui patterns

**Rationale**:
- Consistent with existing settings pages (`/projects/[id]/settings`)
- User-level settings (not project-level) - tokens work across all projects
- Use Card, Dialog, Button, Input components already in codebase

**Components Needed**:
- `TokenListCard` - Display tokens with name, preview, dates, revoke button
- `CreateTokenDialog` - Modal with name input, displays generated token once
- `RevokeTokenDialog` - AlertDialog confirmation before deletion

---

### 11. Testing Strategy

**Decision**: Integration tests for API, Component tests for UI (per Testing Trophy)

**Rationale**:
- API endpoint testing covers auth logic, database operations, error cases
- Component tests cover form validation, copy-to-clipboard, confirmation dialogs
- No E2E tests needed - no browser-required features (OAuth, drag-drop, keyboard)

**Test Files**:
- `/tests/integration/tokens/crud.test.ts` - All API endpoint tests
- `/tests/unit/components/token-card.test.tsx` - UI interaction tests

---

## Dependencies

| Package | Purpose | Already Installed? |
|---------|---------|-------------------|
| bcrypt | Token hashing | Yes (dev dependency) |
| crypto (Node.js built-in) | Secure random generation | Yes (built-in) |
| zod | Request validation | Yes |
| shadcn/ui | UI components | Yes |

**Note**: All dependencies already exist in project - no new packages needed.

---

## Open Questions (Resolved)

All technical questions have been resolved through research. No NEEDS CLARIFICATION items remain.
