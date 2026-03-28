import { prisma } from '@/lib/db/client';
import type { HealthScanType, HealthScanStatus } from '@prisma/client';
import { calculateGlobalScore } from './score-calculator';

export async function getHealthScore(projectId: number) {
  return prisma.healthScore.findUnique({
    where: { projectId },
  });
}

export async function getLatestScans(projectId: number) {
  const scanTypes: HealthScanType[] = ['SECURITY', 'COMPLIANCE', 'TESTS', 'SPEC_SYNC'];

  const scans = await Promise.all(
    scanTypes.map((scanType) =>
      prisma.healthScan.findFirst({
        where: { projectId, scanType },
        orderBy: { createdAt: 'desc' },
      })
    )
  );

  const results: Record<string, Awaited<ReturnType<typeof prisma.healthScan.findFirst>>> = {};
  scanTypes.forEach((type, i) => {
    results[type] = scans[i] ?? null;
  });

  return results;
}

export async function getActiveScan(projectId: number, scanType: HealthScanType) {
  return prisma.healthScan.findFirst({
    where: {
      projectId,
      scanType,
      status: { in: ['PENDING', 'RUNNING'] as HealthScanStatus[] },
    },
  });
}

export async function getScanHistory(
  projectId: number,
  opts: { type?: HealthScanType | undefined; page: number; pageSize: number }
) {
  const where = {
    projectId,
    ...(opts.type ? { scanType: opts.type } : {}),
  };

  const [scans, total] = await Promise.all([
    prisma.healthScan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.healthScan.count({ where }),
  ]);

  return {
    scans,
    pagination: {
      page: opts.page,
      pageSize: opts.pageSize,
      total,
      totalPages: Math.ceil(total / opts.pageSize),
    },
  };
}

export async function upsertHealthScore(
  projectId: number,
  scanType: HealthScanType,
  score: number,
  completedAt: Date
) {
  const scoreFieldMap: Record<string, string> = {
    SECURITY: 'securityScore',
    COMPLIANCE: 'complianceScore',
    TESTS: 'testsScore',
    SPEC_SYNC: 'specSyncScore',
  };

  const lastScanFieldMap: Record<string, string> = {
    SECURITY: 'lastSecurityScanAt',
    COMPLIANCE: 'lastComplianceScanAt',
    TESTS: 'lastTestsScanAt',
    SPEC_SYNC: 'lastSpecSyncScanAt',
  };

  const scoreField = scoreFieldMap[scanType];
  const lastScanField = lastScanFieldMap[scanType];

  if (!scoreField || !lastScanField) return;

  // Get or create the health score record
  const existing = await prisma.healthScore.upsert({
    where: { projectId },
    create: {
      projectId,
      [scoreField]: score,
      [lastScanField]: completedAt,
      lastScanAt: completedAt,
    },
    update: {
      [scoreField]: score,
      [lastScanField]: completedAt,
      lastScanAt: completedAt,
    },
  });

  // Recompute global score from all sub-scores
  const globalScore = calculateGlobalScore({
    SECURITY: existing.securityScore,
    COMPLIANCE: existing.complianceScore,
    TESTS: existing.testsScore,
    SPEC_SYNC: existing.specSyncScore,
    QUALITY_GATE: existing.qualityGateScore,
  });

  await prisma.healthScore.update({
    where: { projectId },
    data: { globalScore },
  });
}

export async function computePassiveModuleScores(projectId: number) {
  // Quality Gate: average of completed verify job qualityScores
  const qualityGateResult = await prisma.job.aggregate({
    where: {
      ticket: { projectId },
      qualityScore: { not: null },
    },
    _avg: { qualityScore: true },
    _max: { completedAt: true },
  });

  // Last Clean: most recent completed cleanup job
  const lastCleanJob = await prisma.job.findFirst({
    where: {
      ticket: { projectId },
      command: 'clean',
      status: 'COMPLETED',
    },
    orderBy: { completedAt: 'desc' },
    select: { id: true, completedAt: true },
  });

  return {
    qualityGateScore: qualityGateResult._avg.qualityScore
      ? Math.round(qualityGateResult._avg.qualityScore)
      : null,
    qualityGateLastScanAt: qualityGateResult._max.completedAt,
    lastCleanAt: lastCleanJob?.completedAt ?? null,
    lastCleanJobId: lastCleanJob?.id ?? null,
  };
}
