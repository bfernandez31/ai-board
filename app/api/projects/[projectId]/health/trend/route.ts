import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { prisma } from '@/lib/db/client';
import type { HealthScanType } from '@prisma/client';
import type { TrendDataPoint } from '@/lib/health/types';

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

    const queryModule = (scanType: HealthScanType) =>
      prisma.healthScan.findMany({
        where: {
          projectId,
          scanType,
          status: 'COMPLETED',
          score: { not: null },
        },
        orderBy: { completedAt: 'desc' },
        take: 20,
        select: {
          score: true,
          completedAt: true,
        },
      });

    const [security, compliance, tests, specSync] = await Promise.all([
      queryModule('SECURITY'),
      queryModule('COMPLIANCE'),
      queryModule('TESTS'),
      queryModule('SPEC_SYNC'),
    ]);

    const mapToTrendData = (scans: { score: number | null; completedAt: Date | null }[]): TrendDataPoint[] =>
      [...scans]
        .reverse()
        .map((s) => ({
          score: s.score!,
          date: s.completedAt!.toISOString(),
        }));

    return NextResponse.json({
      trends: {
        security: mapToTrendData(security),
        compliance: mapToTrendData(compliance),
        tests: mapToTrendData(tests),
        specSync: mapToTrendData(specSync),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    console.error('[Health Trend] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
