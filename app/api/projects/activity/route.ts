import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getProjectsActivityHeatmap } from '@/lib/db/projects';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const response = await getProjectsActivityHeatmap(
      {
        period: searchParams.get('period') ?? undefined,
        year: searchParams.get('year') ?? undefined,
        agent: searchParams.get('agent') ?? undefined,
      },
      {
        request,
        strict: true,
      }
    );

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_ERROR' },
        { status: 401 }
      );
    }

    console.error('Failed to fetch projects activity heatmap:', error);

    return NextResponse.json(
      { error: 'Failed to fetch projects activity heatmap', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
