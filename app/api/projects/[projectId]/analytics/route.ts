import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { getAnalyticsData } from '@/lib/analytics/queries';

const querySchema = z.object({
  range: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
  outcome: z.enum(['shipped', 'closed', 'all-completed']).default('shipped'),
  agent: z.enum(['all', 'CLAUDE', 'CODEX']).default('all'),
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
    const filters = querySchema.parse({
      range: searchParams.get('range') || undefined,
      outcome: searchParams.get('outcome') || undefined,
      agent: searchParams.get('agent') || undefined,
    });

    const data = await getAnalyticsData(projectId, filters);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid analytics filters' }, { status: 400 });
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
