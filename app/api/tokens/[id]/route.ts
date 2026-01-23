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
