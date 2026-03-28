import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { getHealthScore, getLatestScans, computePassiveModuleScores } from '@/lib/health/queries';
import { getScoreThreshold } from '@/lib/health/score-calculator';
import { HEALTH_MODULES } from '@/lib/health/constants';
import type { ModuleStatus, ModuleResponse, LatestScanInfo } from '@/lib/health/types';

const paramsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
});

type RouteParams = { projectId: string };

function jsonError(status: number, error: string, code: string): NextResponse {
  return NextResponse.json({ error, code }, { status });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  try {
    const paramsResult = paramsSchema.safeParse(await context.params);
    if (!paramsResult.success) {
      return jsonError(400, 'Invalid project ID', 'VALIDATION_ERROR');
    }

    const { projectId } = paramsResult.data;
    await verifyProjectAccess(projectId, request);

    const [healthScore, latestScans, passiveData] = await Promise.all([
      getHealthScore(projectId),
      getLatestScans(projectId),
      computePassiveModuleScores(projectId),
    ]);

    const modules: ModuleResponse[] = HEALTH_MODULES.map((moduleConfig) => {
      const { type, name, isPassive } = moduleConfig;

      if (type === 'QUALITY_GATE') {
        return {
          type,
          name,
          score: passiveData.qualityGateScore,
          status: (passiveData.qualityGateScore != null ? 'completed' : 'never_scanned') as ModuleStatus,
          isPassive: true,
          lastScanAt: passiveData.qualityGateLastScanAt?.toISOString() ?? null,
          summary: passiveData.qualityGateScore != null
            ? `Average quality score across verify jobs`
            : null,
          latestScan: null,
        };
      }

      if (type === 'LAST_CLEAN') {
        return {
          type,
          name,
          score: null,
          status: (passiveData.lastCleanAt != null ? 'completed' : 'never_scanned') as ModuleStatus,
          isPassive: true,
          lastScanAt: passiveData.lastCleanAt?.toISOString() ?? null,
          summary: passiveData.lastCleanAt != null
            ? `Last cleanup completed`
            : null,
          latestScan: null,
        };
      }

      // Active modules
      const latestScan = latestScans[type];
      let status: ModuleStatus = 'never_scanned';
      let score: number | null = null;
      let summary: string | null = null;
      let lastScanAt: string | null = null;
      let latestScanInfo: LatestScanInfo | null = null;

      if (latestScan) {
        switch (latestScan.status) {
          case 'PENDING':
          case 'RUNNING':
            status = 'scanning';
            break;
          case 'COMPLETED':
            status = 'completed';
            score = latestScan.score;
            summary = latestScan.issuesFound > 0
              ? `${latestScan.issuesFound} issue${latestScan.issuesFound !== 1 ? 's' : ''} found, ${latestScan.issuesFixed} fixed`
              : 'No issues found';
            lastScanAt = latestScan.completedAt?.toISOString() ?? latestScan.createdAt.toISOString();
            break;
          case 'FAILED':
            status = 'failed';
            lastScanAt = latestScan.createdAt.toISOString();
            break;
        }

        latestScanInfo = {
          id: latestScan.id,
          status: latestScan.status,
          baseCommit: latestScan.baseCommit,
          headCommit: latestScan.headCommit,
          issuesFound: latestScan.issuesFound,
          issuesFixed: latestScan.issuesFixed,
          errorMessage: latestScan.errorMessage,
        };
      }

      // If we have a cached score from HealthScore table, use it
      if (status === 'completed' || status === 'never_scanned') {
        const scoreFieldMap: Record<string, 'securityScore' | 'complianceScore' | 'testsScore' | 'specSyncScore'> = {
          SECURITY: 'securityScore',
          COMPLIANCE: 'complianceScore',
          TESTS: 'testsScore',
          SPEC_SYNC: 'specSyncScore',
        };
        const field = scoreFieldMap[type];
        if (field && healthScore?.[field] != null) {
          score = healthScore[field];
        }
      }

      return {
        type,
        name,
        score,
        status,
        isPassive,
        lastScanAt,
        summary,
        latestScan: latestScanInfo,
      };
    });

    const globalScore = healthScore?.globalScore ?? null;
    const globalLabel = globalScore != null ? getScoreThreshold(globalScore) : null;
    const lastScanAt = healthScore?.lastScanAt?.toISOString() ?? null;

    return NextResponse.json({
      globalScore,
      globalLabel,
      modules,
      lastScanAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Project not found') {
      return jsonError(404, 'Project not found', 'PROJECT_NOT_FOUND');
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return jsonError(401, 'Unauthorized', 'AUTH_REQUIRED');
    }
    return jsonError(500, 'Internal server error', 'INTERNAL_ERROR');
  }
}
