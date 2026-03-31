import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import { ACTIVE_SCAN_TYPES, SCAN_TYPE_TO_TREND_KEY } from '@/lib/health/types';
import type { HealthTrendsResponse, TrendDataPoint } from '@/lib/health/types';

const MAX_DATA_POINTS = 20;

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

    const scanResults = await Promise.all(
      ACTIVE_SCAN_TYPES.map(async (scanType) => {
        const scans = await prisma.healthScan.findMany({
          where: {
            projectId,
            scanType,
            status: 'COMPLETED',
            score: { not: null },
          },
          orderBy: { completedAt: 'desc' },
          take: MAX_DATA_POINTS,
          select: {
            score: true,
            completedAt: true,
          },
        });
        const key = SCAN_TYPE_TO_TREND_KEY[scanType]!;
        const points: TrendDataPoint[] = scans
          .reverse()
          .map((scan) => ({ score: scan.score!, date: scan.completedAt!.toISOString() }));
        return { key, points };
      })
    );

    const result: HealthTrendsResponse = { security: [], compliance: [], tests: [], specSync: [] };
    for (const { key, points } of scanResults) {
      result[key] = points;
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }
    console.error('[Health Trends] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
