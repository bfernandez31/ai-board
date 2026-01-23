# Quickstart: Personal Access Tokens Implementation

**Feature**: AIB-184-personal-access-tokens
**Date**: 2026-01-23

## Implementation Order

Execute in this order to ensure dependencies are satisfied:

1. **Database Schema** - Add PersonalAccessToken model
2. **Token Utilities** - Create/validate/hash functions
3. **API Endpoints** - CRUD operations for tokens
4. **Auth Integration** - Bearer token authentication
5. **UI Components** - Token management interface
6. **Tests** - Integration and component tests

## Step 1: Database Schema

### File: `prisma/schema.prisma`

Add to User model:
```prisma
model User {
  // ... existing fields
  personalAccessTokens  PersonalAccessToken[]
}
```

Add new model:
```prisma
model PersonalAccessToken {
  id            Int       @id @default(autoincrement())
  userId        String
  name          String    @db.VarChar(50)
  tokenLookup   String    @unique @db.VarChar(64)
  tokenHash     String    @db.VarChar(255)
  tokenPreview  String    @db.VarChar(4)
  createdAt     DateTime  @default(now())
  lastUsedAt    DateTime?

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

Run migration:
```bash
bunx prisma migrate dev --name add-personal-access-tokens
```

## Step 2: Token Utilities

### File: `lib/auth/token-utils.ts`

```typescript
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const TOKEN_PREFIX = 'pat_';
const BCRYPT_ROUNDS = 12;

export function generateToken(): string {
  const randomPart = crypto.randomBytes(16).toString('hex');
  return `${TOKEN_PREFIX}${randomPart}`;
}

export function getTokenLookup(plainToken: string): string {
  return crypto.createHash('sha256').update(plainToken).digest('hex');
}

export function getTokenPreview(plainToken: string): string {
  return plainToken.slice(-4);
}

export async function hashToken(plainToken: string): Promise<string> {
  return bcrypt.hash(plainToken, BCRYPT_ROUNDS);
}

export async function verifyToken(plainToken: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainToken, hash);
}

export function isValidTokenFormat(token: string): boolean {
  return /^pat_[a-f0-9]{32}$/.test(token);
}
```

### File: `lib/validations/token.ts`

```typescript
import { z } from 'zod';

export const createTokenSchema = z.object({
  name: z
    .string()
    .min(1, 'Token name is required')
    .max(50, 'Token name must be 50 characters or less')
    .trim(),
});

export type CreateTokenInput = z.infer<typeof createTokenSchema>;
```

## Step 3: Database Operations

### File: `lib/db/tokens.ts`

```typescript
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/db/users';
import {
  generateToken,
  getTokenLookup,
  getTokenPreview,
  hashToken,
  verifyToken,
} from '@/lib/auth/token-utils';

const MAX_TOKENS_PER_USER = 10;

export async function listTokens() {
  const userId = await requireAuth();
  return prisma.personalAccessToken.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      tokenPreview: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });
}

export async function createToken(name: string) {
  const userId = await requireAuth();

  // Check token limit
  const count = await prisma.personalAccessToken.count({ where: { userId } });
  if (count >= MAX_TOKENS_PER_USER) {
    throw new Error('TOKEN_LIMIT_EXCEEDED');
  }

  const plainToken = generateToken();
  const tokenLookup = getTokenLookup(plainToken);
  const tokenHash = await hashToken(plainToken);
  const tokenPreview = getTokenPreview(plainToken);

  const created = await prisma.personalAccessToken.create({
    data: {
      userId,
      name,
      tokenLookup,
      tokenHash,
      tokenPreview,
    },
    select: {
      id: true,
      name: true,
      tokenPreview: true,
      createdAt: true,
    },
  });

  // Return plain token ONCE - never stored
  return {
    ...created,
    token: plainToken,
  };
}

export async function revokeToken(tokenId: number) {
  const userId = await requireAuth();

  const deleted = await prisma.personalAccessToken.deleteMany({
    where: { id: tokenId, userId },
  });

  if (deleted.count === 0) {
    throw new Error('Token not found');
  }
}

export async function validateToken(plainToken: string): Promise<string | null> {
  const tokenLookup = getTokenLookup(plainToken);

  const token = await prisma.personalAccessToken.findUnique({
    where: { tokenLookup },
    select: { id: true, userId: true, tokenHash: true },
  });

  if (!token) return null;

  const isValid = await verifyToken(plainToken, token.tokenHash);
  if (!isValid) return null;

  // Update lastUsedAt asynchronously (don't block)
  prisma.personalAccessToken
    .update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(console.error);

  return token.userId;
}
```

## Step 4: API Endpoints

### File: `app/api/tokens/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { listTokens, createToken } from '@/lib/db/tokens';
import { createTokenSchema } from '@/lib/validations/token';

export async function GET() {
  try {
    const tokens = await listTokens();
    return NextResponse.json({ tokens });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error listing tokens:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = createTokenSchema.parse(body);
    const token = await createToken(name);
    return NextResponse.json(token, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'TOKEN_LIMIT_EXCEEDED') {
        return NextResponse.json(
          {
            error: 'Maximum token limit (10) reached. Delete an existing token to create a new one.',
            code: 'TOKEN_LIMIT_EXCEEDED',
          },
          { status: 400 }
        );
      }
    }
    console.error('Error creating token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### File: `app/api/tokens/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { revokeToken } from '@/lib/db/tokens';

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const tokenId = parseInt(params.id, 10);

    if (isNaN(tokenId) || tokenId <= 0) {
      return NextResponse.json({ error: 'Invalid token ID' }, { status: 400 });
    }

    await revokeToken(tokenId);
    return NextResponse.json({ message: 'Token revoked successfully' });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Token not found') {
        return NextResponse.json({ error: 'Token not found' }, { status: 404 });
      }
    }
    console.error('Error revoking token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## Step 5: Auth Integration

### File: `lib/auth/token-auth.ts`

```typescript
import { NextRequest } from 'next/server';
import { validateToken } from '@/lib/db/tokens';
import { isValidTokenFormat } from '@/lib/auth/token-utils';

export async function getUserIdFromBearerToken(
  request: NextRequest
): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (!isValidTokenFormat(token)) return null;

  return validateToken(token);
}
```

### Update: `lib/db/users.ts`

Add token-based auth fallback to `requireAuth()`:

```typescript
import { getUserIdFromBearerToken } from '@/lib/auth/token-auth';

export async function requireAuth(): Promise<string> {
  // Check for test mode header first (existing logic)
  // ...

  // Check for Bearer token
  const request = getRequestFromContext(); // Need to pass request context
  if (request) {
    const tokenUserId = await getUserIdFromBearerToken(request);
    if (tokenUserId) return tokenUserId;
  }

  // Fall back to session auth
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  return session.user.id;
}
```

Note: The exact integration depends on how request context is passed. May need to:
- Create a middleware that sets token user in headers
- Or modify individual API routes to check Bearer token first

## Step 6: UI Components

### File: `app/settings/tokens/page.tsx`

```typescript
import { TokenListCard } from '@/components/settings/token-list-card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function TokensPage() {
  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Settings
        </Link>
      </div>

      <div className="space-y-2 mb-6">
        <h1 className="text-2xl font-bold">Personal Access Tokens</h1>
        <p className="text-muted-foreground">
          Generate tokens to authenticate external tools with the AI-Board API.
        </p>
      </div>

      <TokenListCard />
    </div>
  );
}
```

### File: `components/settings/token-list-card.tsx`

Client component that:
- Fetches tokens via `GET /api/tokens`
- Displays list with name, preview, dates
- Includes "Generate new token" button
- Opens CreateTokenDialog on click
- Opens RevokeTokenDialog on delete click

### File: `components/settings/create-token-dialog.tsx`

Dialog component that:
- Input for token name (with validation)
- On submit: POST to `/api/tokens`
- Shows generated token with copy button
- Warning that token won't be shown again
- Close button after copying

### File: `components/settings/revoke-token-dialog.tsx`

AlertDialog component that:
- Shows token name being revoked
- Warning that action is irreversible
- Confirm/Cancel buttons
- On confirm: DELETE to `/api/tokens/{id}`

## Step 7: Tests

### File: `tests/integration/tokens/crud.test.ts`

Test scenarios:
1. List tokens (empty, with tokens)
2. Create token (success, validation errors, limit exceeded)
3. Revoke token (success, not found, not owned)
4. Token validation (valid, invalid, revoked)

### File: `tests/unit/components/token-card.test.tsx`

Test scenarios:
1. Renders token list correctly
2. Copy button copies to clipboard
3. Create dialog validates name input
4. Revoke dialog shows confirmation
5. Empty state shows create prompt

## Key Patterns to Follow

1. **Error handling**: Catch specific errors, map to HTTP status codes
2. **Zod validation**: Use `.parse()` for strict validation
3. **Authorization**: Use `requireAuth()` for user ID
4. **Timestamps**: Use `.toISOString()` for JSON responses
5. **shadcn/ui**: Use Card, Dialog, AlertDialog, Button, Input components
6. **Testing Trophy**: Integration tests for API, Component tests for UI
