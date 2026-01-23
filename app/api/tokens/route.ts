import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/db/users';
import {
  createPersonalAccessToken,
  getUserPersonalAccessTokens,
} from '@/lib/db/personal-access-tokens';

// Maximum tokens per user to prevent abuse
const MAX_TOKENS_PER_USER = 10;

const createTokenSchema = z.object({
  name: z
    .string()
    .min(1, 'Token name is required')
    .max(100, 'Token name must be 100 characters or less'),
});

/**
 * GET /api/tokens
 * List all personal access tokens for the current user
 */
export async function GET(): Promise<NextResponse> {
  try {
    const userId = await requireAuth();
    const tokens = await getUserPersonalAccessTokens(userId);

    return NextResponse.json({
      tokens: tokens.map((t) => ({
        id: t.id,
        name: t.name,
        tokenPreview: t.tokenPreview,
        createdAt: t.createdAt.toISOString(),
        lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Tokens GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/tokens
 * Create a new personal access token
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireAuth();

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validationResult = createTokenSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues.map((err) => ({
            message: err.message,
            path: err.path,
          })),
        },
        { status: 400 }
      );
    }

    // Check token limit
    const existingTokens = await getUserPersonalAccessTokens(userId);
    if (existingTokens.length >= MAX_TOKENS_PER_USER) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_TOKENS_PER_USER} tokens allowed per user` },
        { status: 400 }
      );
    }

    const { plainToken, token } = await createPersonalAccessToken(
      userId,
      validationResult.data.name
    );

    // Return the plain token once - user must copy it now
    return NextResponse.json(
      {
        token: plainToken,
        id: token.id,
        name: token.name,
        tokenPreview: token.tokenPreview,
        createdAt: token.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Tokens POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
