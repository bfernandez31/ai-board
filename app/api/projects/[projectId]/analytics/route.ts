import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { getAnalyticsData } from '@/lib/analytics/queries';

const querySchema = z.object({
  range: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectAccess(projectId);

    const { searchParams } = new URL(request.url);
    const { range } = querySchema.parse({
      range: searchParams.get('range') || '30d',
    });

    const data = await getAnalyticsData(projectId, range);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid time range' }, { status: 400 });
    }
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
