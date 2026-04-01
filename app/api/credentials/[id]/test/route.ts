import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserOrToken } from '@/lib/db/users';
import { testCredential } from '@/lib/ai-credentials/service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUserOrToken(request);
    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid credential ID' }, { status: 400 });
    }

    const result = await testCredential(id, user.id);

    if (!result) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    }

    return NextResponse.json({
      readinessStatus: result.readinessStatus,
      lastVerifiedAt: new Date().toISOString(),
      verificationCode: result.verificationCode,
      verificationMessage: result.verificationMessage,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to test credential:', error);
    return NextResponse.json({ error: 'Failed to test credential' }, { status: 500 });
  }
}
