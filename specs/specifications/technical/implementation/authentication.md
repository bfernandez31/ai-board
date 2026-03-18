# Authentication Implementation

NextAuth.js setup, session management, Personal Access Tokens (PAT), and the guarded test-only override path used by automated tests.

## NextAuth.js Configuration

**Location**: `lib/auth.ts`

```typescript
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import GitHub from "next-auth/providers/github"
import { createOrUpdateDevUser, createOrUpdateUser, validateGitHubProfile } from "@/app/lib/auth/user-service"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      authorization: { params: { scope: "read:user user:email" } },
    }),
    // Dev login — only registered when DEV_LOGIN_SECRET is set
    ...(process.env.DEV_LOGIN_SECRET ? [
      Credentials({
        id: "dev-login",
        name: "Dev Login",
        credentials: {
          email: { label: "Email", type: "email" },
          secret: { label: "Secret", type: "password" },
        },
        async authorize(credentials) {
          const email = credentials?.email as string | undefined;
          const secret = credentials?.secret as string | undefined;
          if (!email || !secret) return null;
          if (secret !== process.env.DEV_LOGIN_SECRET) return null;
          try {
            const { id } = await createOrUpdateDevUser(email);
            return { id, email, name: email.split('@')[0] || email };
          } catch {
            return null;
          }
        },
      }),
    ] : []),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'dev-login') return true; // handled by authorize
      if (account?.provider !== 'github') return false;
      if (!validateGitHubProfile(profile)) return false;
      const { id: userId } = await createOrUpdateUser(profile, account);
      user.id = userId;
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) { token.id = user.id; token.userId = user.id; }
      return token;
    },
    async session({ session, token, user }) {
      if (session.user) {
        session.user.id = (user?.id || token?.id || token?.userId) as string;
      }
      return session;
    },
  },

  pages: { signIn: '/auth/signin', error: '/auth/error' },

  session: {
    strategy: process.env.NODE_ENV === 'test' ? "database" : "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
})
```

## Dev Login (Preview Environments)

**Purpose**: Allow sign-in with email + shared secret in preview/staging deployments where GitHub OAuth is not configured.

**Activation**: Requires two environment variables:
- `DEV_LOGIN_SECRET` (server-side) — registers the Credentials provider and validates the shared secret
- `NEXT_PUBLIC_DEV_LOGIN=true` (client-side) — shows the `DevLoginForm` on the sign-in page

When `DEV_LOGIN_SECRET` is absent the provider is not registered and no credentials-based login is possible.

**Component**: `components/auth/dev-login-form.tsx`

```typescript
// Displayed on sign-in page only when NEXT_PUBLIC_DEV_LOGIN === "true"
export function DevLoginForm({ callbackUrl }: { callbackUrl: string }) {
  // email + secret fields, calls signIn("dev-login", { email, secret, redirect: false })
  // redirects to callbackUrl on success, shows inline error on failure
}
```

**User persistence**: `app/lib/auth/user-service.ts` — `createOrUpdateDevUser(email)`

```typescript
export async function createOrUpdateDevUser(email: string): Promise<{ id: string }> {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email },
      update: { updatedAt: new Date() },
      create: {
        id: crypto.randomUUID(),
        email,
        name: email.split('@')[0] || email,
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    await tx.account.upsert({
      where: { provider_providerAccountId: { provider: 'credentials', providerAccountId: email } },
      update: {},
      create: {
        id: crypto.randomUUID(),
        userId: user.id,
        type: 'credentials',
        provider: 'credentials',
        providerAccountId: email,
      },
    });

    return { id: user.id };
  });
}
```

**Security notes**:
- Secret compared server-side inside `authorize()` — never exposed to the client
- Should only be enabled on non-production deployments
- Any email can be used; the user record is created on first login

### Dev Login Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant UI as DevLoginForm
    participant NA as NextAuth (Credentials)
    participant US as user-service
    participant DB as Database

    U->>UI: Enter email + secret
    UI->>NA: signIn("dev-login", { email, secret })
    NA->>NA: Compare secret vs DEV_LOGIN_SECRET
    alt Secret mismatch
        NA-->>UI: error
        UI-->>U: "Invalid email or secret"
    else Secret valid
        NA->>US: createOrUpdateDevUser(email)
        US->>DB: Upsert User + Account (credentials)
        DB-->>US: user.id
        US-->>NA: { id }
        NA-->>UI: ok: true
        UI->>U: Redirect to callbackUrl
    end
```

## Test User Override Guard

**Locations**: `lib/auth/test-user-override.ts`, `lib/db/users.ts`, `proxy.ts`

Automated tests can impersonate a seeded test user only through an explicit opt-in override. The override uses:

- `x-test-user-id`: requested test user ID
- `x-ai-board-test-auth-override: true`: explicit opt-in signal

The override is accepted only when the runtime is an explicit test context:

- `TEST_MODE=true`, or
- `NODE_ENV=test`

Any other use of `x-test-user-id` is blocked and never authenticates a caller.

```typescript
export const TEST_USER_HEADER = "x-test-user-id"
export const TEST_AUTH_OVERRIDE_HEADER = "x-ai-board-test-auth-override"

export function isRuntimeTestEnvironment(): boolean {
  return process.env.TEST_MODE === "true" || process.env.NODE_ENV === "test"
}

export function isExplicitTestOverrideRequest(headers: Headers): boolean {
  return (
    isRuntimeTestEnvironment() &&
    headers.get(TEST_AUTH_OVERRIDE_HEADER)?.toLowerCase() === "true"
  )
}
```

### Override Rules

- Valid browser sessions stay authoritative even if `x-test-user-id` is present
- Valid PATs stay authoritative even if `x-test-user-id` is present
- Header-only requests fail closed outside explicit test runs
- The requested override user must exist and be a seeded test user
- Blocked attempts are logged with route, requested user ID, and rejection reason

## Personal Access Token (PAT) Authentication

**Purpose**: Programmatic API access for MCP server and external integrations

**Token Format**: `pat_` + 64 hexadecimal characters (68 characters total)

**Location**: `lib/db/users.ts`, `lib/tokens/validate.ts`

### Token Validation Flow

```typescript
import { extractBearerToken, validateToken } from '@/lib/tokens/validate';

export async function getCurrentUserOrToken(request: NextRequest) {
  // Extract Bearer token from Authorization header
  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);

  if (token) {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') || 'unknown';

    const result = await validateToken(token, ip);

    if (result.valid && result.userId) {
      const user = await prisma.user.findUnique({
        where: { id: result.userId },
        select: { id: true, email: true, name: true }
      });

      if (user?.email) {
        return { id: user.id, email: user.email, name: user.name };
      }
    }

    // Token provided but invalid - throw immediately
    throw new Error(result.error || 'Unauthorized');
  }

  // Fall back to session auth or explicit test override
  return getCurrentUser();
}
```

### Dual Authentication Pattern

API routes support both session and PAT authentication via `requireAuth(request?)`:

```typescript
// lib/db/users.ts
export async function requireAuth(request?: NextRequest): Promise<string> {
  if (request) {
    // Use dual auth (Bearer token OR session) when request is provided
    const user = await getCurrentUserOrToken(request);
    return user.id;
  }
  // Fall back to session-only auth
  const user = await getCurrentUser();
  return user.id;
}
```

### Authorization Helpers with PAT Support

```typescript
// lib/db/auth-helpers.ts
export async function verifyProjectAccess(
  projectId: number,
  request?: NextRequest
): Promise<AuthorizedProject> {
  const userId = await requireAuth(request);
  // ... project access validation
}

export async function verifyTicketAccess(
  ticketId: number,
  request?: NextRequest
): Promise<Ticket> {
  const userId = await requireAuth(request);
  // ... ticket access validation
}
```

### API Route with PAT Support

```typescript
// Pass request to enable PAT authentication
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const projectId = parseInt((await context.params).projectId, 10);

  // Supports both session and PAT authentication
  await verifyProjectAccess(projectId, request);

  // ... perform operation
}
```

### MCP Server Integration

The MCP server uses PAT authentication to access AI-Board API:

**Configuration**: `~/.aiboard/config.json`

```json
{
  "apiUrl": "https://ai-board-three.vercel.app",
  "token": "pat_<64-hex-characters>"
}
```

**Supported Endpoints**:
- `GET /api/projects` - List user's projects
- `GET /api/projects/:id` - Get project details
- `GET /api/projects/:id/tickets` - List project tickets
- `GET /api/projects/:id/tickets/:key` - Get ticket details
- `POST /api/projects/:id/tickets` - Create ticket
- `POST /api/projects/:id/tickets/:key/transition` - Move ticket

### Token Security

- Tokens are hashed (SHA-256) before storage
- Rate limiting per IP address
- Tokens can be revoked by user
- No token expiration (user-managed lifecycle)
- Tokens never logged or exposed in error messages
- Conflicting `x-test-user-id` headers do not change PAT identity

## Protected Request Enforcement

### Request Sequence

```mermaid
sequenceDiagram
    participant C as Client
    participant P as Proxy
    participant A as Auth Helper
    participant T as Token Validator
    participant S as Session Auth
    participant DB as Database

    C->>P: Request protected page or API
    alt Header-only x-test-user-id outside explicit test mode
        P-->>C: 401 API response or sign-in redirect
    else Bearer PAT
        P->>A: Continue request
        A->>T: Validate PAT
        T->>DB: Resolve token owner
        A-->>C: Authenticated as PAT owner
    else Browser session (GitHub OAuth or Dev Login)
        P->>A: Continue request
        A->>S: Resolve JWT session
        A-->>C: Authenticated as session user
    else Explicit test override
        P->>A: Continue request
        A->>DB: Resolve seeded test user
        A-->>C: Authenticated as test user
    end
```

### Proxy Behavior

`proxy.ts` provides defense in depth before route handlers run:

- Public routes bypass the guard
- PAT requests continue to route handlers
- Explicit test override requests continue only in explicit test context
- Protected API requests with blocked `x-test-user-id` usage return `401` with `AUTH_REQUIRED`
- Protected page requests with blocked `x-test-user-id` usage redirect to `/auth/signin`

If a valid session cookie is already present, the request continues and the session identity remains authoritative.

## Session Management

### Server-Side Session Access

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  // Use userId for authorization checks
}
```

### Client-Side Session Access

```typescript
'use client';

import { useSession } from 'next-auth/react';

export function UserProfile() {
  const { data: session, status } = useSession();

  if (status === 'loading') return <Loading />;
  if (status === 'unauthenticated') return <SignIn />;

  return <div>Hello {session.user.name}</div>;
}
```

## Authorization Patterns

### Project Access Validation (Owner OR Member)

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  const userId = session.user.id;
  const projectId = parseInt(params.projectId);

  // Check ownership first (performance optimization - no join needed)
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId }
  });

  if (project) {
    // User is owner - proceed with authorized operation
    return /* ... */;
  }

  // Check membership (requires join)
  const membership = await prisma.projectMember.findFirst({
    where: {
      projectId,
      userId
    },
    include: { project: true }
  });

  if (!membership) {
    // User is neither owner nor member
    const exists = await prisma.project.findUnique({
      where: { id: projectId }
    });

    return exists
      ? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      : NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  // User is member - proceed with authorized operation
  // Use membership.project for project data
}
```

**Authorization Helper Pattern**:

```typescript
// Helper function for reusable authorization logic
async function verifyProjectAccess(projectId: number, userId: string) {
  // Check ownership first
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId }
  });

  if (project) {
    return { hasAccess: true, isOwner: true, project };
  }

  // Check membership
  const membership = await prisma.projectMember.findFirst({
    where: { projectId, userId },
    include: { project: true }
  });

  if (membership) {
    return { hasAccess: true, isOwner: false, project: membership.project };
  }

  return { hasAccess: false, isOwner: false, project: null };
}
```

### Comment Author Validation (With Project Access Check)

```typescript
// Delete comment - only author can delete, and user must have project access
const comment = await prisma.comment.findUnique({
  where: { id: commentId },
  include: { ticket: { include: { project: true } } }
});

if (!comment) {
  return NextResponse.json({ error: 'Not Found' }, { status: 404 });
}

// Check project access (owner OR member)
const { hasAccess } = await verifyProjectAccess(
  comment.ticket.project.id,
  session.user.id
);

if (!hasAccess) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// Check comment authorship
if (comment.userId !== session.user.id) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

await prisma.comment.delete({ where: { id: commentId } });
```

## Test User Management

Seeded test users exist for automated validation, but they are not implicitly trusted by runtime auth. Tests must run in explicit test context and send the override opt-in header for `x-test-user-id` to take effect.

### Global Test Setup

**File**: `tests/global-setup.ts`

```typescript
import { prisma } from '@/app/lib/db';

export default async function globalSetup() {
  // Create test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@e2e.local' },
    update: {},
    create: {
      email: 'test@e2e.local',
      name: 'E2E Test User',
      emailVerified: new Date(),
    },
  });

  // Create test projects with userId
  await prisma.project.upsert({
    where: { id: 1 },
    update: { userId: testUser.id },
    create: {
      id: 1,
      name: '[e2e] Test Project',
      githubOwner: 'test',
      githubRepo: 'test',
      userId: testUser.id,
    },
  });

  // Store for other tests
  process.env.TEST_USER_ID = testUser.id;
}
```

### Test Helper Pattern

**File**: `tests/helpers/db-setup.ts`

```typescript
export async function ensureTestUser() {
  return await prisma.user.upsert({
    where: { email: 'test@e2e.local' },
    update: {},
    create: {
      email: 'test@e2e.local',
      name: 'E2E Test User',
      emailVerified: new Date(),
    },
  });
}

export async function createTestTicket(data: Partial<Ticket>) {
  const testUser = await ensureTestUser();

  const project = await prisma.project.findFirst({
    where: { userId: testUser.id },
  });

  return await prisma.ticket.create({
    data: {
      title: data.title || '[e2e] Test Ticket',
      description: data.description || 'Test description',
      projectId: project!.id,
      ...data,
    },
  });
}
```

## Environment Variables

### Production

```env
# NextAuth
NEXTAUTH_URL=https://ai-board.vercel.app
NEXTAUTH_SECRET=<random-secret>

# GitHub OAuth
GITHUB_ID=<github-oauth-client-id>
GITHUB_SECRET=<github-oauth-client-secret>

# Database
DATABASE_URL=<postgresql-connection-string>
```

### Development / Preview

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret

# GitHub OAuth (optional if using dev login instead)
GITHUB_ID=
GITHUB_SECRET=

# Dev Login — set both to enable credentials-based login
DEV_LOGIN_SECRET=<shared-secret-for-preview>
NEXT_PUBLIC_DEV_LOGIN=true

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_board_dev
```

## Sign-In Page

**File**: `app/auth/signin/page.tsx`

Server component. Reads `callbackUrl` from search params (defaults to `/projects`).

Renders:
1. **GitHub OAuth button** — always visible; submits a server action calling `signIn("github")`
2. **GitLab / BitBucket buttons** — disabled, "Coming soon"
3. **DevLoginForm** — rendered only when `process.env.NEXT_PUBLIC_DEV_LOGIN === "true"`

```typescript
export default async function SignInPage({ searchParams }) {
  const { callbackUrl = "/projects" } = await searchParams;

  return (
    <Card>
      {/* GitHub button — server action */}
      <form action={async () => { "use server"; await signIn("github", { redirectTo: callbackUrl }) }}>
        <Button type="submit">Continue with GitHub</Button>
      </form>

      {/* GitLab / BitBucket disabled */}

      {process.env.NEXT_PUBLIC_DEV_LOGIN === "true" && (
        <DevLoginForm callbackUrl={callbackUrl} />
      )}
    </Card>
  );
}
```

## Middleware Protection

**File**: `middleware.ts`

```typescript
export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    '/projects/:path*',
    '/api/projects/:path*',
  ],
};
```

**Effect**:
- Redirects unauthenticated users to `/auth/signin`
- Preserves original URL in `callbackUrl` parameter
- Protected routes: `/projects/*` and `/api/projects/*`

**Public Routes** (no authentication required):
- `/` — Landing page
- `/auth/signin` — Sign-in page
- `/legal/terms` — Terms of Service
- `/legal/privacy` — Privacy Policy

## Security Considerations

### Session Security
- Database-backed sessions (no JWT vulnerabilities)
- 30-day max age with sliding window
- CSRF protection via NextAuth
- Secure cookies (httpOnly, sameSite)

### Authorization Checks
- Server-side validation on ALL API routes
- User ID extracted from session (not client)
- Project ownership verified before operations
- No client-side authorization logic

### OAuth Security
- State parameter prevents CSRF attacks
- PKCE flow for additional security (GitHub default)
- Refresh tokens handled by NextAuth
- Token expiration managed automatically

## AI-BOARD System User

**Purpose**: AI-powered ticket assistance via comment mentions

**Creation**: Auto-added to all projects on creation

```typescript
export async function getAIBoardUserId(): Promise<string> {
  const cached = aiBoard User IdCache;
  if (cached) return cached;

  const user = await prisma.user.upsert({
    where: { email: 'ai-board@system.local' },
    update: {},
    create: {
      email: 'ai-board@system.local',
      name: 'AI-BOARD',
      emailVerified: new Date(),
    },
  });

  aiBoardUserIdCache = user.id;
  return user.id;
}
```

**Auto-Membership Pattern**:

```typescript
await prisma.$transaction([
  // Create project
  prisma.project.create({ data: { ... } }),

  // Add AI-BOARD as member
  prisma.projectMember.create({
    data: {
      projectId: newProject.id,
      userId: await getAIBoardUserId(),
      role: 'member',
    },
  }),
]);
```

## Common Patterns

### Authenticated API Route with Project Access

```typescript
export async function GET(request: NextRequest) {
  // 1. Check authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Extract user ID
  const userId = session.user.id;

  // 3. Verify authorization (owner OR member)
  const { hasAccess, project } = await verifyProjectAccess(projectId, userId);

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 4. Perform operation
  const data = await prisma.ticket.findMany({
    where: { projectId }
  });

  return NextResponse.json({ data });
}
```

### Owner-Only API Route

```typescript
export async function PATCH(request: NextRequest) {
  // 1. Check authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Extract user ID
  const userId = session.user.id;

  // 3. Verify ownership (NOT membership - owner-only action)
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId }
  });

  if (!project) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 4. Perform owner-only operation (e.g., update project settings)
  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: { name: newName }
  });

  return NextResponse.json({ project: updatedProject });
}
```

### Client Component with Auth

```typescript
'use client';

import { useSession } from 'next-auth/react';

export function ProtectedComponent() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/auth/signin');
    },
  });

  if (status === 'loading') {
    return <LoadingSpinner />;
  }

  return <div>Hello {session.user.name}</div>;
}
```
