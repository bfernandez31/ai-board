# Data Model: Automatic User Creation for GitHub OAuth

**Feature**: 054-901-automatic-user
**Date**: 2025-10-26

## Overview

This feature uses **existing** User and Account models from the Prisma schema. No schema migrations are required. The implementation adds business logic to create/update these records during NextAuth.js authentication callbacks.

## Entities

### User (EXISTING - NO CHANGES)

Represents an authenticated user in the application.

**Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PRIMARY KEY | Unique identifier (NextAuth-generated) |
| `name` | String? | NULLABLE | Display name from OAuth provider |
| `email` | String | UNIQUE, NOT NULL | Email address (primary identifier) |
| `emailVerified` | DateTime? | NULLABLE | Email verification timestamp |
| `image` | String? | NULLABLE | Profile image URL from OAuth |
| `createdAt` | DateTime | DEFAULT now() | Account creation timestamp |
| `updatedAt` | DateTime | AUTO-UPDATE | Last modification timestamp |

**Relationships**:
- `accounts`: One-to-many with Account (OAuth provider linkages)
- `sessions`: One-to-many with Session (active login sessions)
- `projects`: One-to-many with Project (owned projects)
- `comments`: One-to-many with Comment (authored comments)
- `memberships`: One-to-many with ProjectMember (project memberships)

**Indexes**:
- Primary key on `id`
- Unique constraint on `email`
- Index on `email` for fast lookups

**Constraints**:
- Email must be unique (enforced at database level)
- Email cannot be null (required for user creation)

**State Transitions**: Not applicable (users don't have workflow states)

### Account (EXISTING - NO CHANGES)

Represents the OAuth provider linkage for a User.

**Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | String | PRIMARY KEY | Unique identifier (NextAuth-generated) |
| `userId` | String | FOREIGN KEY, NOT NULL | Reference to User.id |
| `type` | String | NOT NULL | Account type (e.g., "oauth") |
| `provider` | String | NOT NULL | OAuth provider name (e.g., "github") |
| `providerAccountId` | String | NOT NULL | Provider's user ID (stable identifier) |
| `refresh_token` | String? | NULLABLE | OAuth refresh token (encrypted) |
| `access_token` | String? | NULLABLE | OAuth access token (encrypted) |
| `expires_at` | Int? | NULLABLE | Token expiration timestamp (Unix) |
| `token_type` | String? | NULLABLE | Token type (e.g., "bearer") |
| `scope` | String? | NULLABLE | OAuth scopes granted |
| `id_token` | String? | NULLABLE | OpenID Connect ID token |
| `session_state` | String? | NULLABLE | OAuth session state |

**Relationships**:
- `user`: Many-to-one with User (each account belongs to one user)

**Indexes**:
- Primary key on `id`
- Unique composite constraint on `[provider, providerAccountId]`
- Index on `userId` for relationship queries

**Constraints**:
- `userId` foreign key references `User.id` (CASCADE delete)
- Unique composite constraint prevents duplicate provider linkages
- `provider` and `providerAccountId` cannot be null

**State Transitions**: Not applicable (accounts don't have workflow states)

## Validation Rules

### User Validation

**Email Validation** (enforced in NextAuth callback):
```typescript
// Must be present (reject authentication if missing)
if (!profile?.email) {
  return false; // Reject sign-in
}

// Must match email format (handled by GitHub OAuth)
// Must be unique (handled by Prisma schema constraint)
```

**Name Validation** (optional, defaults to GitHub username):
```typescript
const name = profile.name || profile.login || 'GitHub User';
```

**Email Verified** (recommended but not enforced):
```typescript
// Log warning if email not verified by GitHub
if (!profile.email_verified) {
  console.warn('GitHub email not verified', { email: profile.email });
  // Still allow sign-in (GitHub responsibility to verify)
}
```

### Account Validation

**Provider Validation**:
```typescript
// Only GitHub provider supported (for this feature)
if (account.provider !== 'github') {
  return false; // Reject non-GitHub providers
}

// Provider account ID must be present
if (!account.providerAccountId) {
  return false; // Reject invalid OAuth response
}
```

**Token Validation** (handled by NextAuth):
- Access token must be present for OAuth flow
- Token expiration checked by NextAuth refresh logic
- Tokens are encrypted before storage (NextAuth responsibility)

## Database Operations

### User Upsert (Create or Update)

**Operation**: `prisma.user.upsert()`

**Match Criteria**: Email address (unique constraint)

**Create Branch** (first-time sign-in):
```typescript
create: {
  id: account.providerAccountId, // Use GitHub ID as User ID
  email: profile.email,
  name: profile.name || profile.login,
  emailVerified: new Date(), // Assume GitHub-verified emails are valid
  image: profile.avatar_url,
}
```

**Update Branch** (returning user):
```typescript
update: {
  name: profile.name || profile.login, // Update name if changed
  image: profile.avatar_url, // Update avatar if changed
  updatedAt: new Date(), // Auto-updated by Prisma
}
```

**Note**: Email is NOT updated in the update branch (email is the unique identifier). If a user changes their GitHub email, NextAuth will create a new User record (expected behavior).

### Account Upsert (Create or Update)

**Operation**: `prisma.account.upsert()`

**Match Criteria**: Composite key `[provider, providerAccountId]`

**Create Branch** (first-time link):
```typescript
create: {
  id: crypto.randomUUID(), // Generate unique ID
  userId: user.id, // Link to User
  type: 'oauth',
  provider: 'github',
  providerAccountId: account.providerAccountId,
  access_token: account.access_token,
  refresh_token: account.refresh_token,
  expires_at: account.expires_at,
  token_type: account.token_type,
  scope: account.scope,
  id_token: account.id_token,
}
```

**Update Branch** (token refresh):
```typescript
update: {
  access_token: account.access_token, // Refresh access token
  refresh_token: account.refresh_token, // Refresh refresh token
  expires_at: account.expires_at, // Update expiration
}
```

### Transaction for Atomic Creation

**Pattern**: Both User and Account upserts must succeed or both fail

```typescript
await prisma.$transaction(async (tx) => {
  const user = await tx.user.upsert({
    where: { email: profile.email },
    update: { /* ... */ },
    create: { /* ... */ },
  });

  await tx.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: 'github',
        providerAccountId: account.providerAccountId,
      },
    },
    update: { /* ... */ },
    create: {
      /* ... */
      userId: user.id, // Use user ID from previous upsert
    },
  });

  return user;
});
```

**Transaction Properties**:
- Isolation level: READ COMMITTED (PostgreSQL default)
- Rollback on any error (partial success not allowed)
- Retry on serialization failures (handled by Prisma)

## Concurrency Handling

### Race Condition Scenarios

**Scenario 1**: Two users with different emails sign in simultaneously
- **Expected**: Two separate User records created
- **Mechanism**: Email uniqueness constraint prevents collision
- **Outcome**: Both succeed

**Scenario 2**: Same user signs in twice simultaneously (double-click)
- **Expected**: One User record, both sessions authenticated
- **Mechanism**: `upsert` with email as unique key (PostgreSQL `ON CONFLICT`)
- **Outcome**: First request creates, second request updates (both succeed)

**Scenario 3**: Database connection pool exhausted
- **Expected**: Some requests wait, others fail with timeout
- **Mechanism**: Prisma connection pooling (10-15 connections per instance)
- **Outcome**: Requests timeout after 20 seconds, return error to user

### Unique Constraint Violation Handling

**Expected Behavior**: Should never occur (upsert handles conflicts)

**Defensive Handling**:
```typescript
try {
  await createOrUpdateUser(profile, account);
} catch (error) {
  if (error.code === 'P2002') {
    // Unique constraint violation (email collision)
    // This shouldn't happen with upsert, but log for debugging
    console.error('Unexpected unique constraint violation', {
      email: profile.email,
      error: error.message,
    });
  }
  return false; // Reject authentication
}
```

**Prisma Error Codes**:
- `P2002`: Unique constraint violation
- `P2025`: Record not found (shouldn't occur with upsert)
- `P2034`: Transaction conflict (retry automatically)

## Schema Diagram

```
┌─────────────────────────────────────┐
│              User                   │
├─────────────────────────────────────┤
│ id: String (PK)                     │
│ email: String (UNIQUE)              │ ◄──┐
│ name: String?                       │    │
│ emailVerified: DateTime?            │    │
│ image: String?                      │    │
│ createdAt: DateTime                 │    │
│ updatedAt: DateTime                 │    │
└─────────────────────────────────────┘    │
              ▲                             │
              │                             │
              │ 1:N                         │
              │                             │
┌─────────────────────────────────────┐    │
│           Account                   │    │
├─────────────────────────────────────┤    │
│ id: String (PK)                     │    │
│ userId: String (FK) ────────────────┼────┘
│ provider: String                    │
│ providerAccountId: String           │
│ access_token: String?               │
│ refresh_token: String?              │
│ expires_at: Int?                    │
│ type: String                        │
│ scope: String?                      │
│ id_token: String?                   │
└─────────────────────────────────────┘
    UNIQUE(provider, providerAccountId)
```

## Migration Notes

**No database migration required**. User and Account models already exist in `prisma/schema.prisma` with all necessary fields and constraints.

**Existing Data**:
- Test users created via `tests/global-setup.ts` will continue to work
- Production users (if any) authenticated via GitHub OAuth without database persistence will need to re-authenticate once this feature is deployed

**Rollback Strategy**:
- Remove NextAuth callback logic (revert to JWT-only authentication)
- User and Account records remain in database (no data loss)
- Users can still authenticate, but new users won't be persisted

## Testing Checklist

### Unit Tests (Vitest)

- [ ] User upsert creates new user on first sign-in
- [ ] User upsert updates existing user on return sign-in
- [ ] Account upsert creates new account on first link
- [ ] Account upsert updates tokens on refresh
- [ ] Transaction rolls back if Account creation fails
- [ ] Transaction rolls back if User creation fails
- [ ] Concurrent upserts don't create duplicate users
- [ ] Email validation rejects missing email
- [ ] Provider validation rejects non-GitHub providers

### E2E Tests (Playwright)

- [ ] First-time user can sign in with GitHub
- [ ] User record is created in database after first sign-in
- [ ] Account record is created with correct provider linkage
- [ ] User can create project immediately after first sign-in (no FK error)
- [ ] Returning user sign-in updates name/image if changed
- [ ] Returning user sees their existing projects
- [ ] Concurrent sign-ins don't create duplicate users
- [ ] Missing email rejects authentication with error message
- [ ] Database error rejects authentication with error message

## Implementation Priority

1. **P1 - Core functionality**: User/Account upsert in NextAuth callback
2. **P1 - Error handling**: Validation and transaction rollback
3. **P2 - Logging**: Detailed error logs for debugging
4. **P3 - Monitoring**: Track authentication success/failure rates (future)

## References

- Prisma Schema: `prisma/schema.prisma` (lines 10-27, 118-133)
- NextAuth Types: `node_modules/next-auth/core/types.d.ts`
- Research Findings: `research.md` (Phase 0 output)
