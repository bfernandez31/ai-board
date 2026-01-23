# Research: Personal Access Tokens for API Authentication

**Feature Branch**: `AIB-173-personal-access-tokens`
**Research Date**: 2026-01-23

## Phase 0 Research Summary

All unknowns from Technical Context have been resolved through codebase exploration and best practices research.

---

## Decision 1: Token Format and Generation

### What Was Chosen
- **Format**: `pat_{entropy}` where entropy is 32 random bytes encoded as hex (64 characters)
- **Total length**: 68 characters (`pat_` prefix + 64 hex characters)
- **Generation**: `crypto.randomBytes(32)` for cryptographically secure entropy

### Rationale
- **256-bit entropy** (32 bytes) exceeds security requirements and makes brute-force infeasible
- **Hex encoding** is simple, compatible, and provides consistent length
- `pat_` prefix (Personal Access Token) follows industry conventions (GitHub uses `ghp_`, npm uses `npm_`)
- No checksum required - hash validation provides integrity checking

### Alternatives Considered
1. **Base62 encoding**: More compact (~50 chars vs 64) but adds dependency and complexity
2. **CRC32 checksum suffix**: Adds 6 chars, useful for secret scanning but not required for our use case
3. **JWT format**: Overcomplicated for simple bearer tokens, larger payload

---

## Decision 2: Token Hashing Strategy

### What Was Chosen
- **Algorithm**: SHA-256 with per-token random salt (16 bytes)
- **Storage**: Separate `hash` and `salt` columns in database
- **Lookup**: By token preview (last 4 characters) + hash verification

### Rationale
- SHA-256 provides O(1) lookup unlike bcrypt which requires iterating all tokens
- Salt prevents rainbow table attacks
- Fast enough for API request validation (<1ms per hash)
- Matches spec auto-resolved decision: "SHA-256 with unique salt per token"

### Implementation Pattern
```typescript
// Generation (show once)
const token = `pat_${crypto.randomBytes(32).toString('hex')}`;
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.createHash('sha256')
  .update(salt + token)
  .digest('hex');

// Storage
{ salt, hash, preview: token.slice(-4) }

// Validation (per request)
const candidateHash = crypto.createHash('sha256')
  .update(storedSalt + providedToken)
  .digest('hex');
return crypto.timingSafeEqual(
  Buffer.from(candidateHash, 'hex'),
  Buffer.from(storedHash, 'hex')
);
```

### Alternatives Considered
1. **Bcrypt**: More secure but requires iterating all tokens for lookup (O(n))
2. **PBKDF2**: Good security but slower than needed for token validation
3. **Argon2**: Overkill for tokens, adds external dependency

---

## Decision 3: Authentication Integration Strategy

### What Was Chosen
- **Integration point**: Route handlers (not middleware)
- **Pattern**: Create `getCurrentUserOrToken()` helper that tries Bearer token first, falls back to session
- **Coexistence**: Both auth methods work simultaneously on all API endpoints

### Rationale
- Middleware runs on Edge Runtime which limits database access for token lookup
- Route handlers already have Prisma access for authorization checks
- Gradual migration: existing routes keep working, new helper adds token support
- Follows existing pattern: `validateWorkflowAuth()` is used in route handlers, not middleware

### Integration Flow
```
Request → Middleware (session check, passes through Bearer tokens)
       → Route Handler (calls getCurrentUserOrToken())
       → Token validation OR session fallback
       → Existing authorization helpers (verifyProjectAccess, etc.)
```

### Alternatives Considered
1. **Middleware-level validation**: Would require Edge-compatible token lookup (complex)
2. **Replace getCurrentUser()**: Breaking change to existing code
3. **Separate token-only endpoints**: Duplicates API surface, maintenance burden

---

## Decision 4: Rate Limiting Implementation

### What Was Chosen
- **Strategy**: Route-handler level rate limiting with in-memory fallback
- **Limit**: 60 requests per minute per IP for token validation endpoints
- **Implementation**: Simple in-memory rate limiter for initial release

### Rationale
- Vercel serverless makes persistent rate limiting complex (Redis required for production)
- In-memory provides basic protection against scripted attacks per function instance
- 60/minute allows 1 req/sec legitimate use while preventing automated guessing
- Can upgrade to Redis-based (Upstash/Vercel KV) in future iteration

### Initial Implementation
```typescript
// Simple per-instance rate limiter
const attempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || now > record.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (record.count >= 60) return false;
  record.count++;
  return true;
}
```

### Alternatives Considered
1. **Upstash Redis**: Better for production but adds infrastructure dependency
2. **Vercel KV**: Requires setup, pricing considerations
3. **No rate limiting**: Rejected - brute-force protection required by spec

---

## Decision 5: Token Management UI Location

### What Was Chosen
- **Route**: `/settings/tokens`
- **Components**: Dedicated token management page with shadcn/ui components
- **Pattern**: User-level settings (not project-level)

### Rationale
- Matches spec auto-resolved decision: "create new user-level settings page at `/settings/tokens`"
- Tokens are user-scoped, not project-scoped
- `/settings/` namespace allows future expansion for other user settings
- Follows existing app structure: new page under `/app/settings/tokens/page.tsx`

### UI Components Needed
1. `TokenList` - Table of existing tokens
2. `CreateTokenDialog` - Modal for generating new token
3. `DeleteTokenDialog` - Confirmation for revocation
4. `TokenDisplay` - One-time display of generated token with copy button

---

## Decision 6: Database Model Design

### What Was Chosen
```prisma
model PersonalAccessToken {
  id         Int       @id @default(autoincrement())
  userId     String
  name       String    @db.VarChar(100)
  hash       String    @db.VarChar(64)   // SHA-256 hex
  salt       String    @db.VarChar(32)   // 16 bytes hex
  preview    String    @db.VarChar(4)    // Last 4 chars
  lastUsedAt DateTime?
  createdAt  DateTime  @default(now())
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, hash])
  @@index([userId])
  @@index([preview])
}
```

### Rationale
- **Cascade delete**: Tokens deleted when user deleted (spec requirement)
- **lastUsedAt nullable**: Null means never used (spec requirement)
- **preview**: Last 4 chars for display without exposing full token
- **No expiration**: Initial release doesn't include expiration (can add later)
- **No scopes**: Initial release grants full user permissions (can add later)

### Indexes
- `userId`: List user's tokens
- `preview`: Fast lookup during validation (filter before hash comparison)

---

## Technology Decisions Summary

| Area | Decision | Source |
|------|----------|--------|
| Token format | `pat_{64-hex-chars}` | Industry best practice |
| Entropy | 32 bytes / 256 bits | Security standard |
| Hashing | SHA-256 + salt | Spec requirement, O(1) lookup |
| Auth integration | Route-handler helper | Codebase pattern |
| Rate limiting | In-memory 60/min/IP | Serverless-compatible |
| UI route | `/settings/tokens` | Spec auto-resolution |
| Storage | PostgreSQL via Prisma | Existing stack |
| Components | shadcn/ui | Constitution requirement |

---

## References

### Internal Patterns
- `lib/auth.ts` - NextAuth configuration
- `lib/db/auth-helpers.ts` - Authorization helpers (verifyProjectAccess)
- `lib/db/users.ts` - getCurrentUser(), requireAuth()
- `app/lib/workflow-auth.ts` - Bearer token validation pattern

### External Standards
- [GitHub Token Format](https://github.blog/2021-04-05-behind-githubs-new-authentication-token-formats/)
- [OWASP API Security](https://owasp.org/www-project-api-security/)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)
