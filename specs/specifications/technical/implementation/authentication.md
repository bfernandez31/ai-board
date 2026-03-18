# Authentication Implementation

NextAuth.js setup, session management, Personal Access Tokens (PAT), and the guarded test-only override path used by automated tests.

## NextAuth.js Configuration

**Location**: `lib/auth.ts`

```typescript
import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import Credentials from "next-auth/providers/credentials"
import { createOrUpdateDevUser } from "@/app/lib/auth/user-service"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      authorization: { params: { scope: "read:user user:email" } }
    }),

    // Dev login for preview environments — only active when DEV_LOGIN_SECRET is set
    ...(process.env.DEV_LOGIN_SECRET ? [
      Credentials({
        id: "dev-login",
        credentials: {
          email: { label: "Email", type: "email" },
          secret: { label: "Secret", type: "password" },
        },
        async authorize(credentials) {
          const { email, secret } = credentials as { email?: string; secret?: string };
          if (!email || !secret) return null;
          if (secret !== process.env.DEV_LOGIN_SECRET) return null;
          const { id } = await createOrUpdateDevUser(email);
          return { id, email, name: email.split('@')[0] || email };
        },
      }),
    ] : []),
  ],

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  session: {
    strategy: process.env.NODE_ENV === 'test' ? "database" : "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});
```

**Session strategy**: JWT for production (no database round-trip per request), database adapter for the `test` environment only.

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
    else Browser session (GitHub OAuth or Dev Login JWT)
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

### Development

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret

# GitHub OAuth
GITHUB_ID=
GITHUB_SECRET=

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_board_dev
```

### Preview Environments

```env
# NextAuth
NEXTAUTH_URL=https://<deployment-url>.vercel.app
NEXTAUTH_SECRET=<random-secret>

# Dev login — enables Credentials-based login when GitHub OAuth callback URLs don't match
DEV_LOGIN_SECRET=<shared-secret>
NEXT_PUBLIC_DEV_LOGIN=true
```

## Dev Login for Preview Environments

Vercel preview deployments get random URLs per deploy, making GitHub OAuth callback URLs unusable. The dev login provider offers a Credentials-based alternative that works on any URL.

**Activation**: both environment variables must be set:

| Variable | Side | Purpose |
|---|---|---|
| `DEV_LOGIN_SECRET` | Server | Shared secret that gates the Credentials provider. If unset, the provider is not registered. |
| `NEXT_PUBLIC_DEV_LOGIN=true` | Client | Causes the sign-in page to render the dev login form. |

### User identity

`createOrUpdateDevUser(email)` in `app/lib/auth/user-service.ts` generates a deterministic user ID from a SHA-256 hash of `dev:{email}` (first 24 hex chars), ensuring the same user ID is produced on every login:

```typescript
export async function createOrUpdateDevUser(email: string): Promise<{ id: string }> {
  const devUserId = crypto.createHash('sha256').update(`dev:${email}`).digest('hex').slice(0, 24);

  const user = await prisma.user.upsert({
    where: { email },
    update: { updatedAt: new Date() },
    create: { id: devUserId, email, name: email.split('@')[0] || email, emailVerified: new Date(), updatedAt: new Date() },
  });

  return { id: user.id };
}
```

### Sign-in flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as SignInPage
    participant C as DevLoginForm
    participant API as NextAuth /api/auth
    participant DB as Database

    U->>UI: GET /auth/signin
    UI->>UI: Check NEXT_PUBLIC_DEV_LOGIN
    UI-->>U: Render GitHub button + Dev Login form (if enabled)

    U->>C: Enter email + secret, submit
    C->>API: POST signIn("dev-login", { email, secret })
    API->>API: authorize() — validate secret vs DEV_LOGIN_SECRET
    API->>DB: createOrUpdateDevUser(email) — upsert with deterministic ID
    DB-->>API: { id }
    API-->>C: JWT session token
    C-->>U: Redirect to callbackUrl (/projects)
```

### Components

- **`app/auth/signin/page.tsx`** — Server component; renders `<DevLoginForm>` when `NEXT_PUBLIC_DEV_LOGIN === "true"`.
- **`components/auth/dev-login-form.tsx`** — Client component with email + secret fields; calls `signIn("dev-login")` with `redirect: false`, then navigates via `window.location.href`.

### Security properties

- Secret is never stored; compared in-memory per request.
- Provider not registered unless `DEV_LOGIN_SECRET` is set — no attack surface in production.
- User ID is deterministic so sessions survive server restarts.
- Dev users are stored in the same `User` table as OAuth users, subject to the same authorization rules.

## Sign-In Page

**File**: `app/auth/signin/page.tsx`

The page is a Next.js Server Component. It renders the GitHub OAuth button unconditionally, and the dev login form conditionally based on `NEXT_PUBLIC_DEV_LOGIN`:

```typescript
export default async function SignInPage({ searchParams }) {
  const callbackUrl = (await searchParams).callbackUrl || "/projects"

  return (
    <>
      {/* GitHub OAuth — always shown */}
      <form action={async () => { "use server"; await signIn("github", { redirectTo: callbackUrl }) }}>
        <Button type="submit">Continue with GitHub</Button>
      </form>

      {/* Dev login — shown only on preview deployments */}
      {process.env.NEXT_PUBLIC_DEV_LOGIN === "true" && (
        <DevLoginForm callbackUrl={callbackUrl} />
      )}
    </>
  )
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
