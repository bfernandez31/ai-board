import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { getAnalyticsData } from '@/lib/analytics/queries';
import {
  ANALYTICS_AGENT_VALUES,
  STATUS_SCOPE_VALUES,
  TIME_RANGE_VALUES,
  normalizeAnalyticsQueryState,
} from '@/lib/analytics/types';

const querySchema = z.object({
  range: z.enum(TIME_RANGE_VALUES).default('30d'),
  statusScope: z.enum(STATUS_SCOPE_VALUES).default('shipped'),
  agentScope: z.union([z.literal('all'), z.enum(ANALYTICS_AGENT_VALUES)]).default('all'),
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
    const parsed = querySchema.parse({
      range: searchParams.get('range') || '30d',
      statusScope: searchParams.get('statusScope') || 'shipped',
      agentScope: searchParams.get('agentScope') || 'all',
    });
    const filters = normalizeAnalyticsQueryState(parsed);

    const data = await getAnalyticsData(projectId, filters);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid analytics filter', code: 'INVALID_QUERY' }, { status: 400 });
    }
    if (error instanceof Error) {
      if (error.message === 'Invalid analytics filter') {
        return NextResponse.json({ error: 'Invalid analytics filter', code: 'INVALID_QUERY' }, { status: 400 });
      }
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
