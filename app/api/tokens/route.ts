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
        { error: error.issues[0]?.message || 'Validation error', code: 'VALIDATION_ERROR' },
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
