import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getProjectsActivityData } from '@/lib/projects/activity';

const querySchema = z.object({
  year: z.string().optional(),
  agent: z.string().optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const parsedFilters = querySchema.parse({
      year: searchParams.get('year') || undefined,
      agent: searchParams.get('agent') || undefined,
    });
    const filters = {
      ...(parsedFilters.year ? { year: parsedFilters.year } : {}),
      ...(parsedFilters.agent ? { agent: parsedFilters.agent } : {}),
    };

    const data = await getProjectsActivityData(filters, request);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid activity filters' }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('Projects activity API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
