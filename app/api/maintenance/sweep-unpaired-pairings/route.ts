import { NextRequest, NextResponse } from 'next/server';
import { verifyWorkflowToken } from '@/app/lib/auth/workflow-auth';
import { sweepUnpairedPairings } from '@/lib/drift/sweep';

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await verifyWorkflowToken(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sweepUnpairedPairings();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[drift-sweep] Unexpected error', error);
    return NextResponse.json(
      { error: 'Sweep failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
