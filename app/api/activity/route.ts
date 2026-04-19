import { NextRequest, NextResponse } from 'next/server';
import { getActivityHeatmap } from '@/lib/db/activity';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'last-12-months';
    const agent = searchParams.get('agent') || 'all';

    const activityData = await getActivityHeatmap({ request, range, agentFilter: agent });

    return NextResponse.json(activityData);
  } catch (error) {
    console.error('[Activity API Error]', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'User not found') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
