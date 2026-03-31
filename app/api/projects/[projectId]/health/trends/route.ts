import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { ACTIVE_SCAN_TYPES } from '@/lib/health/types';
import type { HealthScanType } from '@prisma/client';

const trendsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
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

    await verifyProjectAccess(projectId, request);

    const { searchParams } = new URL(request.url);
    const parsed = trendsQuerySchema.safeParse({
      limit: searchParams.get('limit') || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid limit', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { limit } = parsed.data;

    const trendQueries = ACTIVE_SCAN_TYPES.map((scanType: HealthScanType) =>
      prisma.healthScan.findMany({
        where: {
          projectId,
          scanType,
          status: 'COMPLETED',
          score: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          completedAt: true,
          score: true,
        },
      })
    );

    const results = await Promise.all(trendQueries);

    const trends: Record<string, { date: string; score: number }[]> = {};
    ACTIVE_SCAN_TYPES.forEach((scanType, index) => {
      const moduleResults = results[index];
      if (moduleResults) {
        trends[scanType] = moduleResults.map((scan) => ({
          date: (scan.completedAt ?? new Date()).toISOString(),
          score: scan.score ?? 0,
        }));
      } else {
        trends[scanType] = [];
      }
    });

    return NextResponse.json({ trends });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    console.error('[Health Trends] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
