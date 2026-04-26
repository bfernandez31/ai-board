/**
 * Outcome capture orchestrator. Phases follow workflows/capture-on-ship.md exactly.
 *
 * Triggered both from `lib/tickets/transition.ts` (live, fire-and-forget) and from the
 * backfill script. Single derivation pipeline; the only difference between the two
 * trigger paths is the caller.
 */

import type { Job, Project, Ticket } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { ensureFreshConfig, isConfigStale } from '@/lib/config-sync';
import { aggregateJobCounts } from './classification';
import { extractChangeShape } from './derivation';
import {
  deriveSemanticTags,
  getTestPatternsForProject,
  type ProjectStackConfig,
} from './stack-indicator-lookup';
import { fetchCommitFiles } from './github-files';
import { persistOutcome } from './persist';
import {
  QUALITY_THRESHOLD_FRICTION_FREE,
  RULE_SET_VERSION,
  type DerivedOutcome,
  type PartialReason,
} from './types';

export interface CaptureInput {
  ticketId: number;
  projectId: number;
  workflowType: Ticket['workflowType'];
  shippedAt: Date;
}

export interface CaptureResult {
  status: 'created' | 'duplicate' | 'failed';
  partial: boolean;
  partialReason: PartialReason | null;
  durationMs: number;
}

function logPhase(ticketId: number, phase: number, durationMs: number, extra?: Record<string, unknown>) {
  console.log(
    `[outcome-capture] phase=${phase} ticketId=${ticketId} durationMs=${durationMs}`,
    extra ?? {}
  );
}

function emptyChangeShape() {
  return {
    filesTouched: [] as string[],
    linesAdded: null as number | null,
    linesRemoved: null as number | null,
    testCodeRatio: null as number | null,
    domains: [] as string[],
    domainFileCounts: {} as Record<string, number>,
    touchedDbSchema: false,
    touchedTests: false,
    touchedCi: false,
  };
}

/**
 * Sum a numeric column across jobs, returning null if every contributing value is null.
 */
function sumOrNull(jobs: Job[], pick: (j: Job) => number | null | undefined): number | null {
  let sum = 0;
  let anyNonNull = false;
  for (const j of jobs) {
    const v = pick(j);
    if (v !== null && v !== undefined) {
      anyNonNull = true;
      sum += v;
    }
  }
  return anyNonNull ? sum : null;
}

function unionTools(jobs: Job[]): string[] {
  const set = new Set<string>();
  for (const j of jobs) {
    for (const t of j.toolsUsed ?? []) set.add(t);
  }
  return Array.from(set).sort();
}

function buildPartialOutcome(
  input: CaptureInput,
  reason: PartialReason,
  jobs: Job[]
): DerivedOutcome {
  const counts = aggregateJobCounts(jobs);
  return {
    ticketId: input.ticketId,
    projectId: input.projectId,
    workflowType: input.workflowType,
    shippedAt: input.shippedAt,
    ruleSetVersion: RULE_SET_VERSION,
    totalCostUsd: sumOrNull(jobs, (j) => j.costUsd),
    totalDurationMs: sumOrNull(jobs, (j) => j.durationMs),
    totalInputTokens: sumOrNull(jobs, (j) => j.inputTokens),
    totalOutputTokens: sumOrNull(jobs, (j) => j.outputTokens),
    totalThinkingTokens: sumOrNull(jobs, (j) => j.thinkingTokens),
    totalCacheReadTokens: sumOrNull(jobs, (j) => j.cacheReadTokens),
    totalCacheCreationTokens: sumOrNull(jobs, (j) => j.cacheCreationTokens),
    toolsUsed: unionTools(jobs),
    pipelineJobCount: counts.pipelineJobCount,
    frictionJobCount: counts.frictionJobCount,
    totalJobCount: counts.totalJobCount,
    jobCountByPrefix: counts.jobCountByPrefix,
    qualityScore: null,
    ...emptyChangeShape(),
    frictionFree: false,
    partial: true,
    partialReason: reason,
  };
}

async function getQualityScore(ticketId: number): Promise<number | null> {
  const lastVerify = await prisma.job.findFirst({
    where: {
      ticketId,
      command: 'verify',
      status: 'COMPLETED',
      qualityScore: { not: null },
    },
    orderBy: { completedAt: 'desc' },
    select: { qualityScore: true },
  });
  return lastVerify?.qualityScore ?? null;
}

function readProjectStackConfig(project: Project | null): ProjectStackConfig | null {
  if (!project || !project.config) return null;
  // Prisma Json column — we trust it's an object since we wrote it via lib/config-sync.ts.
  const cfg = project.config as Record<string, unknown>;
  const projectMeta = (cfg.project as Record<string, unknown> | undefined) ?? undefined;
  const services = (cfg.services as Array<Record<string, unknown>> | undefined) ?? [];
  const testing = (cfg.testing as Record<string, unknown> | undefined) ?? undefined;
  return {
    project: {
      language: (projectMeta?.language as string | null | undefined) ?? null,
      framework: (projectMeta?.framework as string | null | undefined) ?? null,
    },
    services: services.map((s) => ({ type: (s?.type as string | null | undefined) ?? null })),
    testing: { framework: (testing?.framework as string | null | undefined) ?? null },
  };
}

export async function captureOutcomeOnShip(input: CaptureInput): Promise<CaptureResult> {
  const t0 = Date.now();

  // Phase 1: Idempotency check
  const existing = await prisma.ticketOutcome.findUnique({ where: { ticketId: input.ticketId } });
  if (existing) {
    logPhase(input.ticketId, 1, Date.now() - t0, { skipped: 'duplicate' });
    return {
      status: 'duplicate',
      partial: existing.partial,
      partialReason: (existing.partialReason as PartialReason | null) ?? null,
      durationMs: Date.now() - t0,
    };
  }
  const t1 = Date.now();
  logPhase(input.ticketId, 1, t1 - t0);

  // Phase 2: Aggregate job telemetry
  const jobs = await prisma.job.findMany({ where: { ticketId: input.ticketId } });
  if (jobs.length === 0) {
    const partial = buildPartialOutcome(input, 'no_jobs', []);
    const result = await persistOutcome(partial);
    return {
      status: result.created ? 'created' : 'duplicate',
      partial: true,
      partialReason: 'no_jobs',
      durationMs: Date.now() - t0,
    };
  }
  logPhase(input.ticketId, 2, Date.now() - t1, { jobs: jobs.length });

  // Phase 3: Classify jobs (we'll use this throughout)
  const t3 = Date.now();
  const counts = aggregateJobCounts(jobs);
  logPhase(input.ticketId, 3, Date.now() - t3, { ...counts });

  // Phase 4: Resolve quality score
  const t4 = Date.now();
  const qualityScore = await getQualityScore(input.ticketId);
  logPhase(input.ticketId, 4, Date.now() - t4, { qualityScore });

  // Phase 5: Resolve commit references and fetch files
  const t5 = Date.now();
  const uniqueShas = Array.from(
    new Set(
      jobs
        .map((j) => j.commitSha)
        .filter((sha): sha is string => typeof sha === 'string' && sha.length > 0)
    )
  );

  if (uniqueShas.length === 0) {
    const partial = buildPartialOutcome(input, 'no_commit_reference', jobs);
    const result = await persistOutcome(partial);
    return {
      status: result.created ? 'created' : 'duplicate',
      partial: true,
      partialReason: 'no_commit_reference',
      durationMs: Date.now() - t0,
    };
  }

  // Load project (with config) for stack metadata
  const project = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!project) {
    // The ticket exists but the project does not — return an error rather than a partial.
    return {
      status: 'failed',
      partial: false,
      partialReason: null,
      durationMs: Date.now() - t0,
    };
  }

  // Refresh project config if stale (best-effort; capture continues with whatever metadata exists).
  if (isConfigStale(project)) {
    try {
      await ensureFreshConfig(project);
    } catch (err) {
      console.warn(`[outcome-capture] config sync failed (non-fatal)`, err);
    }
  }

  // Re-read after potential config refresh
  const refreshedProject = await prisma.project.findUnique({ where: { id: input.projectId } });
  const stackConfig = readProjectStackConfig(refreshedProject);

  const fetched = await fetchCommitFiles({
    owner: project.githubOwner,
    repo: project.githubRepo,
    shas: uniqueShas,
  });

  if (fetched.failure === 'repository_unreachable') {
    const partial = buildPartialOutcome(input, 'repository_unreachable', jobs);
    const result = await persistOutcome(partial);
    return {
      status: result.created ? 'created' : 'duplicate',
      partial: true,
      partialReason: 'repository_unreachable',
      durationMs: Date.now() - t0,
    };
  }

  if (fetched.failure === 'fetch_failed_after_retry') {
    const partial = buildPartialOutcome(input, 'fetch_failed_after_retry', jobs);
    const result = await persistOutcome(partial);
    return {
      status: result.created ? 'created' : 'duplicate',
      partial: true,
      partialReason: 'fetch_failed_after_retry',
      durationMs: Date.now() - t0,
    };
  }
  logPhase(input.ticketId, 5, Date.now() - t5, {
    shas: uniqueShas.length,
    fetchedFiles: fetched.files.length,
  });

  // Phase 6+7: Compute change-shape (lines, files, domains, ratio)
  const t6 = Date.now();
  const testPatterns = getTestPatternsForProject(stackConfig);
  const shape = extractChangeShape({ files: fetched.files, testPatterns });
  logPhase(input.ticketId, 6, Date.now() - t6);

  // Phase 8: Derive semantic tags
  const t8 = Date.now();
  const tags = deriveSemanticTags(shape.filesTouched, stackConfig);
  logPhase(input.ticketId, 8, Date.now() - t8, { ...tags });

  // Phase 9: Compute frictionFree
  const frictionFree =
    counts.frictionJobCount === 0 &&
    qualityScore !== null &&
    qualityScore >= QUALITY_THRESHOLD_FRICTION_FREE;

  // Phase 10: Persist
  const derived: DerivedOutcome = {
    ticketId: input.ticketId,
    projectId: input.projectId,
    workflowType: input.workflowType,
    shippedAt: input.shippedAt,
    ruleSetVersion: RULE_SET_VERSION,
    totalCostUsd: sumOrNull(jobs, (j) => j.costUsd),
    totalDurationMs: sumOrNull(jobs, (j) => j.durationMs),
    totalInputTokens: sumOrNull(jobs, (j) => j.inputTokens),
    totalOutputTokens: sumOrNull(jobs, (j) => j.outputTokens),
    totalThinkingTokens: sumOrNull(jobs, (j) => j.thinkingTokens),
    totalCacheReadTokens: sumOrNull(jobs, (j) => j.cacheReadTokens),
    totalCacheCreationTokens: sumOrNull(jobs, (j) => j.cacheCreationTokens),
    toolsUsed: unionTools(jobs),
    pipelineJobCount: counts.pipelineJobCount,
    frictionJobCount: counts.frictionJobCount,
    totalJobCount: counts.totalJobCount,
    jobCountByPrefix: counts.jobCountByPrefix,
    qualityScore,
    filesTouched: shape.filesTouched,
    linesAdded: shape.linesAdded,
    linesRemoved: shape.linesRemoved,
    testCodeRatio: shape.testCodeRatio,
    domains: shape.domains,
    domainFileCounts: shape.domainFileCounts,
    touchedDbSchema: tags.touchedDbSchema,
    touchedTests: tags.touchedTests,
    touchedCi: tags.touchedCi,
    frictionFree,
    partial: false,
    partialReason: null,
  };

  const persistResult = await persistOutcome(derived);
  const totalMs = Date.now() - t0;
  logPhase(input.ticketId, 10, totalMs, {
    created: persistResult.created,
    frictionFree,
  });
  return {
    status: persistResult.created ? 'created' : 'duplicate',
    partial: false,
    partialReason: null,
    durationMs: totalMs,
  };
}

export const _testing = {
  buildPartialOutcome,
  readProjectStackConfig,
};
