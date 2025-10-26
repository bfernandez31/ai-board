# Research: Automatic User Creation for GitHub OAuth

**Feature**: 054-901-automatic-user
**Date**: 2025-10-26

## Phase 0: Research Findings

### 1. NextAuth.js Callbacks for Database Persistence

**Decision**: Use `signIn` and `jwt` callbacks to create/update User and Account records

**Rationale**:
- NextAuth.js supports custom callbacks that execute during the authentication flow
- The `signIn` callback runs after successful OAuth authentication, before session creation
- This callback has access to user profile data from GitHub and can perform database operations
- JWT strategy (required for Vercel serverless) does not auto-persist users, requiring manual callback implementation
- The `jwt` callback can enrich the JWT token with the database user ID for subsequent requests

**Alternatives Considered**:
1. **Prisma Adapter**: Auto-persists users but incompatible with Vercel serverless (connection pooling issues)
   - Rejected: Vercel serverless environment requires JWT strategy due to cold starts and connection limits
2. **Middleware-based approach**: Persist users after authentication via middleware
   - Rejected: Race condition risk (user might access protected routes before database write completes)
3. **API route trigger**: Separate API call to create user after OAuth
   - Rejected: Adds complexity, user must wait for two sequential operations

**Implementation Approach**:
```typescript
// nextauth-config.ts
callbacks: {
  async signIn({ user, account, profile }) {
    // Create/update User and Account in database
    // Return false to reject authentication on failure
    return true; // or false
  },
  async jwt({ token, user }) {
    // Add database user ID to JWT token
    return token;
  },
  async session({ session, token }) {
    // Add user ID from JWT to session object
    return session;
  }
}
```

### 2. Concurrent Database Operations and Idempotency

**Decision**: Use Prisma `upsert` with email as unique identifier within a transaction

**Rationale**:
- `upsert` atomically creates or updates records based on a unique constraint
- PostgreSQL `ON CONFLICT` (underlying mechanism) handles concurrent writes gracefully
- Email is the stable identifier (GitHub user ID can change if account is transferred)
- Transaction ensures User and Account are created atomically (all-or-nothing)
- Prisma's connection pooling handles concurrent database requests efficiently

**Alternatives Considered**:
1. **Manual SELECT + INSERT/UPDATE**: Check if user exists, then create/update
   - Rejected: Race condition window between SELECT and INSERT (two users could both see "no user" and both INSERT)
2. **Database locks**: Use `FOR UPDATE` locks during user creation
   - Rejected: Adds complexity, reduces concurrency, requires manual lock management
3. **Application-level mutex**: Serialize authentication requests in memory
   - Rejected: Doesn't work in serverless (each request is a separate function invocation)

**Best Practices**:
- Use email uniqueness constraint at database level (Prisma schema)
- Wrap User + Account creation in `prisma.$transaction()`
- Handle unique constraint violations gracefully (log and retry)
- Set reasonable retry limits (2-3 attempts max to avoid infinite loops)

**Code Pattern**:
```typescript
await prisma.$transaction(async (tx) => {
  const user = await tx.user.upsert({
    where: { email: profile.email },
    update: { name: profile.name },
    create: { email: profile.email, name: profile.name },
  });

  await tx.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: 'github',
        providerAccountId: account.providerAccountId
      }
    },
    update: { /* token refresh */ },
    create: { userId: user.id, provider: 'github', /* ... */ },
  });

  return user;
});
```

### 3. Error Handling for Authentication Failures

**Decision**: Fail authentication by returning `false` from `signIn` callback on database errors

**Rationale**:
- Prevents orphaned sessions (JWT token created but no database user)
- Maintains referential integrity (Project.userId constraint requires valid User)
- NextAuth automatically shows error to user when `signIn` returns `false`
- Logs provide debugging context for production issues
- User can retry authentication (transient database errors may resolve)

**Alternatives Considered**:
1. **Allow authentication to succeed, create user lazily**: Let user sign in, create User record on first project creation
   - Rejected: Violates fail-fast principle, user sees confusing error later ("foreign key constraint violation")
2. **Queue user creation**: Authenticate user, enqueue database write for background processing
   - Rejected: User might access protected routes before user record exists, adds complexity
3. **Retry indefinitely**: Keep retrying database write until success
   - Rejected: Could cause timeout, no clear failure path, poor UX

**Error Logging Pattern**:
```typescript
try {
  await createOrUpdateUser(profile, account);
  return true;
} catch (error) {
  console.error('Failed to create user during sign-in', {
    email: profile.email,
    provider: account.provider,
    error: error.message,
    timestamp: new Date().toISOString(),
  });
  return false; // Reject authentication
}
```

### 4. NextAuth.js TypeScript Types

**Decision**: Use official NextAuth type extensions for callbacks and JWT

**Rationale**:
- NextAuth provides TypeScript module augmentation for custom JWT/session fields
- Type safety ensures callback signatures match NextAuth expectations
- Prevents runtime errors from incorrect callback return types
- IDE autocomplete improves developer experience

**Implementation**:
```typescript
// types/next-auth.d.ts
import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string; // Add database user ID
      email: string;
      name: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string; // Add database user ID to JWT
  }
}
```

### 5. Testing Strategies for Authentication Flows

**Decision**: Hybrid testing - Vitest for upsert logic, Playwright for E2E authentication

**Rationale**:
- **Unit tests (Vitest)**: Fast feedback for database upsert logic and concurrent scenarios
  - Mock Prisma client to simulate unique constraint violations
  - Test retry logic and error handling in isolation
  - Run in milliseconds, ideal for TDD cycle
- **E2E tests (Playwright)**: Validate complete OAuth flow with real NextAuth
  - Test first-time user creation (GitHub OAuth → database record → project creation)
  - Test returning user update (changed email/name reflected in database)
  - Mock GitHub OAuth provider in test environment
  - Run in seconds, ensures integration works end-to-end

**Test Coverage Matrix**:

| Test Type | Scenario | Tool | Speed |
|-----------|----------|------|-------|
| Unit | User upsert logic | Vitest | ~1ms |
| Unit | Concurrent authentication (race conditions) | Vitest | ~10ms |
| Unit | Error handling (database failures) | Vitest | ~1ms |
| E2E | First-time GitHub sign-in | Playwright | ~2s |
| E2E | Returning user sign-in | Playwright | ~2s |
| E2E | Project creation after sign-in | Playwright | ~3s |

**Mock Authentication Pattern for Tests**:
```typescript
// For E2E tests, mock GitHub OAuth in test environment
// NextAuth supports custom OAuth providers for testing
{
  providers: [
    {
      id: 'github-mock',
      name: 'GitHub (Mock)',
      type: 'oauth',
      authorization: { url: 'http://localhost:3000/mock/oauth' },
      // Mock token and profile endpoints
    }
  ]
}
```

### 6. Performance Optimization for Database Writes

**Decision**: Use Prisma connection pooling with optimized pool size for Vercel

**Rationale**:
- Vercel serverless functions have limited concurrent connections
- Prisma connection pooling reuses database connections across requests
- Connection pool size should match Vercel's concurrency limits (100 functions max)
- Proper pool configuration prevents "too many connections" errors

**Configuration**:
```env
# .env
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20"
```

**Best Practices**:
- Set `connection_limit` to 10-15 per serverless function instance
- Set `pool_timeout` to 20 seconds (balance between waiting and failing fast)
- Use Prisma's `$disconnect()` on serverless function teardown (not needed for Vercel, auto-managed)
- Monitor database connection usage in production (PostgreSQL `pg_stat_activity`)

### 7. Security Considerations for OAuth Data

**Decision**: Store minimal OAuth data, validate email presence, use HTTPS-only cookies

**Rationale**:
- GitHub access tokens are sensitive and should be encrypted (Prisma supports field-level encryption via extensions)
- Email must be present and verified (reject authentication if GitHub email is private)
- NextAuth cookies should use `secure: true` (HTTPS-only) in production
- Token refresh should use NextAuth's built-in refresh token flow

**Validation Pattern**:
```typescript
async signIn({ user, account, profile }) {
  if (!profile?.email) {
    console.error('GitHub profile missing email', { userId: account.providerAccountId });
    return false; // Reject authentication
  }

  // Additional validation: email should be verified by GitHub
  if (profile.email_verified === false) {
    console.error('GitHub email not verified', { email: profile.email });
    return false;
  }

  return true;
}
```

## Summary

This research identified the following implementation patterns:

1. **NextAuth Callbacks**: Use `signIn`, `jwt`, and `session` callbacks for database persistence
2. **Idempotency**: Prisma `upsert` with email uniqueness constraint and transactions
3. **Error Handling**: Fail authentication on database errors (return `false` from callback)
4. **TypeScript**: Module augmentation for custom JWT/session fields
5. **Testing**: Vitest for unit tests, Playwright for E2E authentication flows
6. **Performance**: Prisma connection pooling optimized for Vercel serverless
7. **Security**: Email validation, HTTPS-only cookies, minimal OAuth data storage

All technical unknowns from Technical Context have been resolved. Ready for Phase 1 (design artifacts).
