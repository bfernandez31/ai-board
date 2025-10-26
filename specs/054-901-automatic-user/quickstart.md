# Quickstart Guide: Automatic User Creation for GitHub OAuth

**Feature**: 054-901-automatic-user
**Audience**: Developers implementing this feature
**Time to Implement**: 2-3 hours

## Prerequisites

- [x] NextAuth.js configured with GitHub provider
- [x] Prisma schema includes User and Account models
- [x] PostgreSQL database accessible from Vercel
- [x] GitHub OAuth app credentials (GITHUB_ID, GITHUB_SECRET)
- [x] NEXTAUTH_SECRET environment variable set

## Implementation Checklist

### Step 1: Create User Service Module (30 minutes)

**File**: `app/lib/auth/user-service.ts`

**Purpose**: Isolate database operations for testability

**Implementation**:

```typescript
import { prisma } from '@/app/lib/db/prisma';
import type { Account } from 'next-auth';

export interface GitHubProfile {
  id: number;
  email: string;
  name: string | null;
  login: string;
  avatar_url: string;
  email_verified: boolean;
}

export async function createOrUpdateUser(
  profile: GitHubProfile,
  account: Account
): Promise<{ id: string }> {
  return await prisma.$transaction(async (tx) => {
    // Upsert User record
    const user = await tx.user.upsert({
      where: { email: profile.email },
      update: {
        name: profile.name || profile.login,
        image: profile.avatar_url,
      },
      create: {
        id: String(profile.id), // Use GitHub ID as User ID
        email: profile.email,
        name: profile.name || profile.login,
        emailVerified: new Date(),
        image: profile.avatar_url,
      },
    });

    // Upsert Account record
    await tx.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'github',
          providerAccountId: String(profile.id),
        },
      },
      update: {
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
      },
      create: {
        id: crypto.randomUUID(),
        userId: user.id,
        type: 'oauth',
        provider: 'github',
        providerAccountId: String(profile.id),
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
        token_type: account.token_type,
        scope: account.scope,
        id_token: account.id_token,
      },
    });

    return { id: user.id };
  });
}

export function validateGitHubProfile(profile: any): profile is GitHubProfile {
  if (!profile?.email) {
    console.error('GitHub profile missing email', {
      providerId: profile?.id,
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  return true;
}
```

**Tests**: Create `tests/unit/auth/user-service.test.ts` (see Testing section)

---

### Step 2: Create NextAuth Configuration Module (30 minutes)

**File**: `app/lib/auth/nextauth-config.ts`

**Purpose**: Configure NextAuth callbacks with user creation logic

**Implementation**:

```typescript
import { NextAuthOptions } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';
import { createOrUpdateUser, validateGitHubProfile } from './user-service';

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Validate provider
      if (account?.provider !== 'github') {
        console.error('Unsupported provider', { provider: account?.provider });
        return false;
      }

      // Validate profile
      if (!validateGitHubProfile(profile)) {
        return false; // Reject authentication
      }

      // Create or update user in database
      try {
        await createOrUpdateUser(profile, account);
        return true; // Allow authentication
      } catch (error) {
        console.error('Failed to create/update user during sign-in', {
          email: profile.email,
          provider: account.provider,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
        return false; // Reject authentication
      }
    },

    async jwt({ token, user }) {
      // Add userId to JWT on first sign-in
      if (user) {
        token.userId = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      // Add userId from JWT to session
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin', // Custom sign-in page
    error: '/auth/error', // Error page
  },
  session: {
    strategy: 'jwt', // Required for Vercel serverless
  },
};
```

**TypeScript Types**: Create `types/next-auth.d.ts` (see Type Extensions section)

---

### Step 3: Update NextAuth Route Handler (10 minutes)

**File**: `app/api/auth/[...nextauth]/route.ts`

**Purpose**: Use the new configuration

**Implementation**:

```typescript
import NextAuth from 'next-auth';
import { authOptions } from '@/app/lib/auth/nextauth-config';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

---

### Step 4: Add TypeScript Type Extensions (10 minutes)

**File**: `types/next-auth.d.ts`

**Purpose**: Extend NextAuth types with custom fields

**Implementation**:

```typescript
import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string; // Add database user ID
      email: string;
      name: string;
      image?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string; // Add database user ID to JWT
  }
}
```

---

### Step 5: Write Unit Tests (45 minutes)

**File**: `tests/unit/auth/user-service.test.ts`

**Purpose**: Test database operations in isolation

**Implementation**:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createOrUpdateUser, validateGitHubProfile } from '@/app/lib/auth/user-service';
import { prisma } from '@/app/lib/db/prisma';

// Mock Prisma
vi.mock('@/app/lib/db/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrUpdateUser', () => {
    it('creates user on first sign-in', async () => {
      const mockProfile = {
        id: 12345,
        email: 'alice@github.com',
        name: 'Alice',
        login: 'alice',
        avatar_url: 'https://github.com/alice.png',
        email_verified: true,
      };

      const mockAccount = {
        provider: 'github',
        providerAccountId: '12345',
        access_token: 'token',
        refresh_token: null,
        expires_at: null,
      } as any;

      const mockUser = { id: '12345' };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback({
          user: {
            upsert: vi.fn().mockResolvedValue(mockUser),
          },
          account: {
            upsert: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await createOrUpdateUser(mockProfile, mockAccount);

      expect(result.id).toBe('12345');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('updates user on returning sign-in', async () => {
      // Similar test for update branch
    });

    it('throws error when transaction fails', async () => {
      const mockProfile = {
        id: 12345,
        email: 'alice@github.com',
        name: 'Alice',
        login: 'alice',
        avatar_url: 'https://github.com/alice.png',
        email_verified: true,
      };

      const mockAccount = {
        provider: 'github',
        providerAccountId: '12345',
      } as any;

      (prisma.$transaction as any).mockRejectedValue(new Error('Database error'));

      await expect(createOrUpdateUser(mockProfile, mockAccount)).rejects.toThrow('Database error');
    });
  });

  describe('validateGitHubProfile', () => {
    it('returns true for valid profile', () => {
      const profile = {
        id: 12345,
        email: 'alice@github.com',
        name: 'Alice',
        login: 'alice',
        avatar_url: 'https://github.com/alice.png',
        email_verified: true,
      };

      expect(validateGitHubProfile(profile)).toBe(true);
    });

    it('returns false when email is missing', () => {
      const profile = {
        id: 12345,
        email: null,
        name: 'Alice',
      };

      expect(validateGitHubProfile(profile)).toBe(false);
    });

    it('returns false when profile is null', () => {
      expect(validateGitHubProfile(null)).toBe(false);
    });
  });
});
```

**Run**: `bun run test:unit tests/unit/auth/user-service.test.ts`

---

### Step 6: Write E2E Tests (45 minutes)

**File**: `tests/e2e/auth/first-time-signin.spec.ts`

**Purpose**: Test complete OAuth flow end-to-end

**Implementation**:

```typescript
import { test, expect } from '@playwright/test';
import { prisma } from '@/app/lib/db/prisma';

test.describe('First-Time GitHub Sign-In', () => {
  test.beforeEach(async () => {
    // Clean up test user
    await prisma.user.deleteMany({
      where: { email: 'test@github.com' },
    });
  });

  test('creates user record and allows project creation', async ({ page }) => {
    // 1. Navigate to sign-in page
    await page.goto('/auth/signin');

    // 2. Click "Sign in with GitHub"
    await page.click('button:has-text("Sign in with GitHub")');

    // 3. Verify redirected to projects page (mock OAuth in test env)
    await expect(page).toHaveURL('/projects');

    // 4. Verify User record created
    const user = await prisma.user.findUnique({
      where: { email: 'test@github.com' },
    });
    expect(user).toBeTruthy();
    expect(user?.name).toBe('Test User');

    // 5. Verify Account record created
    const account = await prisma.account.findFirst({
      where: { userId: user!.id },
    });
    expect(account).toBeTruthy();
    expect(account?.provider).toBe('github');

    // 6. Verify user can create project (no FK error)
    await page.click('button:has-text("New Project")');
    await page.fill('input[name="name"]', 'My First Project');
    await page.fill('input[name="githubRepo"]', 'my-repo');
    await page.click('button:has-text("Create")');

    await expect(page.locator('text=My First Project')).toBeVisible();
  });

  test('rejects authentication when email is missing', async ({ page }) => {
    // Mock GitHub OAuth to return profile without email
    // Verify user sees error message
    // Verify no User record created
  });
});
```

**Run**: `bun run test:e2e tests/e2e/auth/first-time-signin.spec.ts`

---

### Step 7: Configure Environment Variables (5 minutes)

**File**: `.env.local`

**Required Variables**:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# GitHub OAuth
GITHUB_ID=your-github-app-client-id
GITHUB_SECRET=your-github-app-client-secret

# Database (already configured)
DATABASE_URL=postgresql://user:pass@localhost:5432/ai_board?connection_limit=10&pool_timeout=20
```

**Production** (Vercel environment variables):
- `NEXTAUTH_URL`: `https://your-app.vercel.app`
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `GITHUB_ID`: From GitHub OAuth app settings
- `GITHUB_SECRET`: From GitHub OAuth app settings

---

## Verification Checklist

### Unit Tests
- [ ] User upsert creates new user on first sign-in
- [ ] User upsert updates existing user on return sign-in
- [ ] Account upsert creates new account on first link
- [ ] Transaction rolls back on error
- [ ] Email validation rejects missing email

### E2E Tests
- [ ] First-time user can sign in with GitHub
- [ ] User record created in database after sign-in
- [ ] User can create project immediately (no FK error)
- [ ] Returning user updates name/image if changed
- [ ] Missing email rejects authentication

### Manual Testing
- [ ] Sign in with GitHub in local development
- [ ] Verify User record in Prisma Studio
- [ ] Verify Account record with tokens
- [ ] Create a project without errors
- [ ] Sign out and sign in again (returning user)
- [ ] Verify updated profile information

---

## Troubleshooting

### "Sign-in failed" error

**Symptom**: User clicks "Sign in with GitHub" and sees error page

**Causes**:
1. Database connection failed (check DATABASE_URL)
2. GitHub OAuth credentials invalid (check GITHUB_ID, GITHUB_SECRET)
3. Email missing from GitHub profile (user has private email)

**Debug**:
```bash
# Check server logs
tail -f .next/server/logs/output.log

# Look for error messages from signIn callback
# "Failed to create/update user during sign-in"
```

### Duplicate User records

**Symptom**: Multiple User records for same email

**Cause**: Unique constraint on email not enforced (shouldn't happen with upsert)

**Fix**:
```sql
-- Verify unique constraint exists
SELECT * FROM pg_indexes WHERE tablename = 'User' AND indexdef LIKE '%UNIQUE%';

-- If missing, run Prisma migration
npx prisma migrate dev
```

### Foreign key constraint violation

**Symptom**: "Project.userId violates foreign key constraint"

**Cause**: User record not created during authentication

**Debug**:
```typescript
// Check if signIn callback returned false
// Check server logs for error messages
```

---

## Performance Optimization

### Database Connection Pooling

Optimize for Vercel serverless:

```env
# .env (production)
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
```

**Why**:
- Vercel limits concurrent serverless functions to 100
- Each function needs 1-2 database connections
- Connection pool size of 10-15 per instance is optimal

### Monitor Authentication Performance

Add timing logs to signIn callback:

```typescript
async signIn({ user, account, profile }) {
  const startTime = Date.now();

  try {
    await createOrUpdateUser(profile, account);
    const duration = Date.now() - startTime;

    console.log('User created/updated', {
      email: profile.email,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('Failed to create user', {
      email: profile.email,
      duration: `${duration}ms`,
      error: error.message,
    });

    return false;
  }
}
```

**Target**: < 500ms for sign-in callback execution

---

## Next Steps

After implementing this feature:

1. **Deploy to Vercel**: Push to main branch, verify in production
2. **Monitor Errors**: Check Vercel logs for authentication failures
3. **Test Concurrency**: Use load testing tool to simulate 50 concurrent sign-ins
4. **Enable Analytics**: Track authentication success/failure rates

---

## References

- **Feature Spec**: `specs/054-901-automatic-user/spec.md`
- **Research**: `specs/054-901-automatic-user/research.md`
- **Data Model**: `specs/054-901-automatic-user/data-model.md`
- **Contracts**: `specs/054-901-automatic-user/contracts/`
- **NextAuth Docs**: https://next-auth.js.org/configuration/callbacks
- **Prisma Docs**: https://www.prisma.io/docs/concepts/components/prisma-client/transactions
