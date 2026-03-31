import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import type { HealthTrendsResponse, TrendDataPoint } from '@/lib/health/types';

const ACTIVE_SCAN_TYPES = ['SECURITY', 'COMPLIANCE', 'TESTS', 'SPEC_SYNC'] as const;
const MAX_DATA_POINTS = 20;

const SCAN_TYPE_TO_KEY = {
  SECURITY: 'security',
  COMPLIANCE: 'compliance',
  TESTS: 'tests',
  SPEC_SYNC: 'specSync',
} as const satisfies Record<typeof ACTIVE_SCAN_TYPES[number], keyof HealthTrendsResponse>;

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

    const result: HealthTrendsResponse = {
      security: [],
      compliance: [],
      tests: [],
      specSync: [],
    };

    for (const scanType of ACTIVE_SCAN_TYPES) {
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

      const key = SCAN_TYPE_TO_KEY[scanType];
      result[key] = scans
        .reverse()
        .map((scan): TrendDataPoint => ({
          score: scan.score!,
          date: scan.completedAt!.toISOString(),
        }));
    }

    return NextResponse.json(result);
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
