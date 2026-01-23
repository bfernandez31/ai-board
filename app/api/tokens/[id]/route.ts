import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/db/users';
import { deletePersonalAccessToken } from '@/lib/db/personal-access-tokens';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/tokens/[id]
 * Delete a personal access token
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const userId = await requireAuth();
    const { id } = await params;

    const tokenId = parseInt(id, 10);
    if (isNaN(tokenId)) {
      return NextResponse.json({ error: 'Invalid token ID' }, { status: 400 });
    }

    const deleted = await deletePersonalAccessToken(userId, tokenId);
    if (!deleted) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Tokens DELETE] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
