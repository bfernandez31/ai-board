import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserOrToken } from '@/lib/db/users';
import { deleteApiCredential } from '@/lib/db/api-credentials';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/credentials/:id
 * Delete an API credential.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserOrToken(request);
    const { id } = await params;

    const credentialId = parseInt(id, 10);
    if (isNaN(credentialId)) {
      return NextResponse.json({ error: 'Invalid credential ID' }, { status: 400 });
    }

    const deleted = await deleteApiCredential(credentialId, user.id);

    if (!deleted) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Credential deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
    }
    console.error('Failed to delete credential:', error);
    return NextResponse.json({ error: 'Failed to delete credential' }, { status: 500 });
  }
}
