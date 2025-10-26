# API Contracts: Automatic User Creation for GitHub OAuth

**Feature**: 054-901-automatic-user
**Date**: 2025-10-26

## Overview

This feature does NOT introduce new HTTP API endpoints. Instead, it implements **NextAuth.js callbacks** that execute server-side during GitHub OAuth authentication.

The contracts in this directory define the expected behavior of these callbacks and the user service layer.

## Contract Files

### `nextauth-callbacks.ts`

TypeScript interfaces and documentation for:

1. **Callback Signatures**:
   - `signInCallback`: Creates/updates User and Account during sign-in
   - `jwtCallback`: Adds userId to JWT token
   - `sessionCallback`: Adds userId to session object

2. **Service Contracts**:
   - `UserServiceContract`: Database operations for user management
   - `AuthTransactionContract`: Transaction behavior for atomic upserts
   - `AuthErrorContract`: Error handling and logging requirements

3. **Quality Contracts**:
   - `ConcurrencyContract`: Behavior under concurrent requests
   - `SecurityContract`: Input validation and data protection
   - `PerformanceContract`: Response time and scalability targets

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub OAuth Flow                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. User clicks "Sign in with GitHub"                      │
│     → NextAuth redirects to GitHub OAuth                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. User authorizes app on GitHub                          │
│     → GitHub redirects back with authorization code        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. NextAuth exchanges code for access token               │
│     → Fetches user profile from GitHub API                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. signInCallback (THIS FEATURE)                          │
│     ✓ Validate email presence                             │
│     ✓ Upsert User record (email as key)                   │
│     ✓ Upsert Account record (provider + providerAccountId)│
│     ✓ Return true (allow) or false (reject)               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  5. jwtCallback (THIS FEATURE)                             │
│     ✓ Add userId to JWT token                             │
│     ✓ Return modified token                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  6. NextAuth creates session                                │
│     → Sets secure HTTP-only cookie with JWT                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  7. sessionCallback (THIS FEATURE)                         │
│     ✓ Add userId from JWT to session.user                 │
│     ✓ Return modified session                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  8. User redirected to application                          │
│     → Can now create projects (userId exists)              │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling

### Validation Errors

**Missing Email**:
```typescript
// signInCallback returns false
// User sees: "Sign-in failed. Please try again."
// Log: "GitHub profile missing email"
```

**Non-GitHub Provider**:
```typescript
// signInCallback returns false
// User sees: "Unsupported sign-in provider"
// Log: "Provider ${provider} not supported"
```

### Database Errors

**Connection Timeout**:
```typescript
// signInCallback catches timeout error
// Returns false (reject authentication)
// User sees: "Unable to complete sign-in. Please try again later."
// Log: "Database timeout during user creation"
```

**Transaction Rollback**:
```typescript
// Prisma transaction fails
// signInCallback returns false
// User sees: "Sign-in failed. Please try again."
// Log: "Transaction failed during user creation"
```

## Concurrency Scenarios

### Scenario 1: Same User, Concurrent Requests

```
Request 1 (t=0ms):  signInCallback → User.upsert(email) → CREATE
Request 2 (t=5ms):  signInCallback → User.upsert(email) → UPDATE
Result: One User record, both requests succeed
```

### Scenario 2: Different Users, Concurrent Requests

```
Request 1 (t=0ms):  signInCallback → User.upsert(alice@github.com) → CREATE
Request 2 (t=0ms):  signInCallback → User.upsert(bob@github.com) → CREATE
Result: Two User records, both requests succeed
```

### Scenario 3: Connection Pool Exhaustion

```
Requests 1-15:  Acquire database connection (pool size = 15)
Request 16:     Waits for available connection (timeout = 20s)
Request 16 (t=20s): Timeout error, signInCallback returns false
Result: Request 16 fails, user must retry
```

## Testing Strategy

### Unit Tests (Vitest)

Test the user service layer in isolation:

```typescript
describe('UserService', () => {
  it('creates user on first sign-in', async () => {
    const mockProfile = { email: 'alice@github.com', ... };
    const mockAccount = { provider: 'github', ... };

    const result = await userService.createOrUpdateUser(mockProfile, mockAccount);

    expect(result.id).toBeDefined();
    expect(mockPrisma.user.upsert).toHaveBeenCalled();
  });

  it('rejects sign-in when email is missing', async () => {
    const mockProfile = { email: null, ... };
    const isValid = userService.validateGitHubProfile(mockProfile);

    expect(isValid).toBe(false);
  });
});
```

### E2E Tests (Playwright)

Test the complete OAuth flow:

```typescript
test('first-time user can sign in and create project', async ({ page }) => {
  // 1. Navigate to sign-in page
  await page.goto('/auth/signin');

  // 2. Click "Sign in with GitHub" (mocked in test environment)
  await page.click('button:has-text("Sign in with GitHub")');

  // 3. Verify redirected to application
  await expect(page).toHaveURL('/projects');

  // 4. Verify User record created in database
  const user = await prisma.user.findUnique({
    where: { email: 'test@github.com' },
  });
  expect(user).toBeTruthy();

  // 5. Verify user can create project (no FK error)
  await page.click('button:has-text("New Project")');
  await page.fill('input[name="name"]', 'My Project');
  await page.click('button:has-text("Create")');

  await expect(page.locator('text=My Project')).toBeVisible();
});
```

## Performance Benchmarks

### Target Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| SignIn Callback Duration | < 500ms | Database upsert + transaction |
| Concurrent Sign-Ins | 50 | No errors, all succeed |
| Database Connections | 10-15 | Per serverless instance |
| Connection Timeout | 20s | Prisma pool timeout |

### Measurement Strategy

1. **Local Development**: Use `console.time()` in callback
2. **Production**: Use Vercel Analytics or custom logging
3. **Load Testing**: Use k6 or Artillery to simulate 50 concurrent sign-ins

## Security Checklist

- [ ] Email validation (required field)
- [ ] Provider validation (GitHub only)
- [ ] Access tokens stored securely (Prisma encryption if configured)
- [ ] JWT signed with NEXTAUTH_SECRET
- [ ] Cookies use `secure: true` in production
- [ ] No sensitive data in JWT or session (user-visible)
- [ ] userId from session used for authorization checks
- [ ] Foreign key constraints enforce data integrity

## References

- NextAuth.js Callbacks: https://next-auth.js.org/configuration/callbacks
- GitHub OAuth API: https://docs.github.com/en/rest/users/users
- Prisma Transactions: https://www.prisma.io/docs/concepts/components/prisma-client/transactions
- Vercel Serverless Limits: https://vercel.com/docs/concepts/limits/overview
