# Authentication Implementation

NextAuth.js setup, session management, Personal Access Tokens (PAT), and mock authentication for development/testing.

## NextAuth.js Configuration

**Location**: `app/api/auth/[...nextauth]/route.ts`

```typescript
import NextAuth, { NextAuthOptions } from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/app/lib/db';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],

  pages: {
    signIn: '/auth/signin',
  },

  callbacks: {
    async session({ session, user }) {
      // Add user ID to session
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },

  session: {
    strategy: 'database',  // Store sessions in database
    maxAge: 30 * 24 * 60 * 60,  // 30 days
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

## Mock Authentication (Development/Test)

**Test Mode**: Enabled when `NODE_ENV !== 'production'`

Tests and development tooling authenticate via the `x-test-user-id` HTTP header. This header is only accepted in non-production environments — guarded at two layers:

**Layer 1 — `lib/db/users.ts` (`getCurrentUser`)**:

```typescript
const testUserId = headersList.get('x-test-user-id')

if (process.env.NODE_ENV !== 'production' && testUserId) {
  const user = await prisma.user.findUnique({ where: { id: testUserId } })
  if (user) return user
}
// Fall through to NextAuth session
```

**Layer 2 — `proxy.ts` (`preAuthCheck`)**:

```typescript
// NEXT_TEST_MODE is inlined at build time via next.config.ts env
if (process.env.NEXT_TEST_MODE && req.headers.get('x-test-user-id') !== null) {
  return NextResponse.next()
}
```

`NEXT_TEST_MODE` is a build-time constant set in `next.config.ts`:

```typescript
env: {
  NEXT_TEST_MODE: process.env.NODE_ENV !== 'production' ? 'true' : '',
},
```

This is necessary because the Edge Runtime (`proxy.ts` runs as middleware) cannot reliably read `process.env.NODE_ENV` at runtime — the value must be inlined at build time.

**Defense-in-depth — header stripping**:

In non-test environments, `proxy.ts` strips the `x-test-user-id` header from pass-through responses so downstream handlers cannot access it even if it slips past the pre-auth check:

```typescript
if (!process.env.NEXT_TEST_MODE && req.headers.has('x-test-user-id') && response?.ok) {
  const cleanHeaders = new Headers(req.headers)
  cleanHeaders.delete('x-test-user-id')
  return NextResponse.next({ request: { headers: cleanHeaders } })
}
```

**Benefits**:
- No manual login in development
- Automated E2E tests without auth complexity
- Same security model (ownership validation still enforced)
- Production is fully isolated — header is ignored and stripped

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

  // Fall back to session auth
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
# NextAuth (mock mode auto-enabled)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret

# GitHub OAuth (optional for mock mode)
GITHUB_ID=
GITHUB_SECRET=

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_board_dev
```

### Build-time Constants

`NEXT_TEST_MODE` is injected by `next.config.ts` — it is NOT set manually. It evaluates to `'true'` in non-production builds and `''` (falsy) in production builds. It exists solely to allow the Edge Runtime middleware (`proxy.ts`) to gate test-header bypass at build time.

## Sign-In Page

**File**: `app/auth/signin/page.tsx`

```typescript
'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export default function SignInPage() {
  const handleGitHubSignIn = async () => {
    await signIn('github', {
      callbackUrl: '/projects',
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sign in to AI Board</h1>
        </div>

        <div className="space-y-4">
          <Button
            onClick={handleGitHubSignIn}
            className="w-full"
            variant="outline"
          >
            Sign in with GitHub
          </Button>

          <Button disabled className="w-full" variant="outline">
            GitLab (Coming soon)
          </Button>

          <Button disabled className="w-full" variant="outline">
            BitBucket (Coming soon)
          </Button>
        </div>
      </div>
    </div>
  );
}
```

## Middleware Protection

**File**: `proxy.ts`

The app uses a custom proxy middleware (not the default NextAuth middleware) to handle authentication at the Edge layer. It supports three auth paths:

1. **PAT (Bearer token)** — passes through for API token requests
2. **Test header** — allows `x-test-user-id` bypass in non-production builds only (see Mock Authentication above)
3. **NextAuth session** — delegates to `authProxy` for all other requests

```typescript
export const config = {
  matcher: ['/projects/:path*', '/api/:path*'],
}
```

**Effect**:
- Unauthenticated requests to `/projects/*` and `/api/*` are redirected to `/auth/signin`
- Preserves original URL in `callbackUrl` parameter
- `x-test-user-id` header is stripped in production builds (defense-in-depth)

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

### Test Header Security
- `x-test-user-id` is **only** accepted when `NODE_ENV !== 'production'`
- Gated at both the middleware layer (`NEXT_TEST_MODE` build-time constant) and the handler layer (`NODE_ENV` runtime check)
- Header is actively stripped by `proxy.ts` in production builds (defense-in-depth) so downstream handlers cannot access it even if a check is missed

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
