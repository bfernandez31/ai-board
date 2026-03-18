# Authentication Implementation

NextAuth.js setup, session management, Personal Access Tokens (PAT), GitHub OAuth, and environment-gated dev login for development and preview access.

## NextAuth.js Configuration

**Primary Configuration**: `lib/auth.ts`
**Route Handler**: `app/api/auth/[...nextauth]/route.ts`

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

## Environment-Specific Authentication Modes

Authentication behavior depends on runtime environment:

- **Production**: GitHub OAuth only
- **Vercel preview**: GitHub OAuth plus optional credentials-based dev login when `DEV_LOGIN_SECRET` is configured
- **Development**: GitHub OAuth plus optional credentials-based dev login when `DEV_LOGIN_SECRET` is configured
- **Test**: NextAuth uses the Prisma adapter with database-backed sessions and the test user `test@e2e.local`

The credentials-based dev login is not a general production auth path. It is enabled only when:
- `DEV_LOGIN_SECRET` is present after trimming whitespace
- `NODE_ENV !== 'production'` or `VERCEL_ENV === 'preview'`

## Dev Login Provider

**Files**:
- `lib/auth.ts`
- `app/lib/auth/dev-login.ts`
- `app/lib/auth/user-service.ts`

The app registers a NextAuth Credentials provider with provider id `dev-login` only when dev login is enabled for the current environment.

### Validation Flow

1. The sign-in page posts `email` and `secret` to NextAuth using provider id `dev-login`
2. `authorizeDevLogin()` validates the payload with Zod
3. The provided secret is compared to `DEV_LOGIN_SECRET` using `timingSafeEqual`
4. The email is normalized to trimmed lowercase before persistence
5. The app upserts a `User` record and a matching `Account` record with `provider="credentials"`
6. NextAuth creates a session for that user

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Sign-In Page
    participant NA as NextAuth
    participant DL as authorizeDevLogin
    participant DB as PostgreSQL

    U->>UI: Submit email + shared secret
    UI->>NA: signIn("dev-login", credentials)
    NA->>DL: authorize(credentials)
    DL->>DL: Validate email and secret
    DL->>DL: timingSafeEqual(secret, DEV_LOGIN_SECRET)
    DL->>DB: Upsert User and credentials Account
    DB-->>DL: User record
    DL-->>NA: Authorized user
    NA-->>UI: Session + redirect
```

### Failure Behavior

- Invalid email format returns `null` from the provider authorize callback
- Missing or incorrect shared secret returns `null`
- Disabled environments return `null`
- NextAuth redirects back to `/auth/signin?error=CredentialsSignin`
- The sign-in page maps that error code to the user-facing message `Invalid email or secret.`

### Persistence Rules

- Dev login users are keyed by normalized email address
- The related NextAuth account uses:
  - `provider: "credentials"`
  - `providerAccountId: <normalized email>`
- Repeat sign-ins reuse the same user and account rows
- `emailVerified` is set when the credentials user is created or refreshed

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
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret
DEV_LOGIN_SECRET=<shared-preview-secret>

# GitHub OAuth
GITHUB_ID=
GITHUB_SECRET=

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_board_dev
```

## Sign-In Page

**File**: `app/auth/signin/page.tsx`

```typescript
export default async function SignInPage({ searchParams }) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl || "/projects";
  const devLoginEnabled = isDevLoginEnabled();
  const devLoginError = getDevLoginErrorMessage(params.error);

  return (
    <Card>
      {devLoginError ? <Alert>{devLoginError}</Alert> : null}

      <form action={async () => { "use server"; await signIn("github", { redirectTo: callbackUrl }); }}>
        <Button type="submit">Continue with GitHub</Button>
      </form>

      {devLoginEnabled ? (
        <form action={async (formData) => {
          "use server";
          await signIn("dev-login", {
            email: formData.get("email"),
            secret: formData.get("secret"),
            redirectTo: callbackUrl,
          });
        }}>
          <Input name="email" type="email" required />
          <Input name="secret" type="password" required />
          <Button type="submit">Sign in with Dev Login</Button>
        </form>
      ) : null}
    </Card>
  );
}
```

**Behavior**:
- GitHub remains the primary sign-in path in all environments
- The dev login form is rendered only when the credentials provider is enabled
- The page preserves `callbackUrl` for both GitHub and dev login flows
- GitLab and BitBucket remain disabled placeholder actions

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
- JWT sessions in normal runtime and database-backed sessions in test runtime
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
