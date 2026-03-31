import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/db/users';
import { listCredentialSummaries } from '@/lib/ai-credentials/service';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const credentials = await listCredentialSummaries(user.id);

    return NextResponse.json({ credentials });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    console.error('Failed to list AI credentials:', error);
    return NextResponse.json(
      { error: 'Failed to list AI credentials' },
      { status: 500 }
    );
  }
}
