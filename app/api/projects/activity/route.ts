import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ACTIVITY_HEATMAP_AGENT_VALUES,
  DEFAULT_ACTIVITY_HEATMAP_AGENT,
  DEFAULT_ACTIVITY_HEATMAP_VIEW,
} from '@/lib/projects/activity-heatmap-types';
import {
  getProjectsActivityHeatmap,
  isValidActivityHeatmapYearView,
} from '@/lib/projects/activity-heatmap';

const querySchema = z.object({
  view: z.string().optional().default(DEFAULT_ACTIVITY_HEATMAP_VIEW),
  agent: z.enum(ACTIVITY_HEATMAP_AGENT_VALUES).optional().default(DEFAULT_ACTIVITY_HEATMAP_AGENT),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      view: searchParams.get('view') ?? undefined,
      agent: searchParams.get('agent') ?? undefined,
    });

    if (!parsed.success || !isValidActivityHeatmapYearView(parsed.data.view)) {
      return NextResponse.json(
        { error: 'Invalid activity heatmap filters', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const data = await getProjectsActivityHeatmap(
      {
        view: parsed.data.view,
        agent: parsed.data.agent,
      },
      request
    );

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_ERROR' },
        { status: 401 }
      );
    }

    console.error('Projects activity heatmap API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity heatmap', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
