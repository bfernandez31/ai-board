import { Octokit } from '@octokit/rest';
import { RequestError } from '@octokit/request-error';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireAdminOrNotFound } from '@/app/lib/auth/admin';
import { reconcileOrphanedRunningReports } from '@/app/lib/insights/reconcile';
import {
  countShippedClaudeTicketsSince,
  getEarliestClaudeJobTimestamp,
} from '@/app/lib/insights/predicate';
import {
  InsightsAlreadyRunningError,
  createRunningReportAndJob,
  getLastCompletedRunEnd,
  getRunningReport,
  markFailed,
} from '@/app/lib/insights/repository';
import { isWorkflowTestMode } from '@/app/lib/workflows/test-mode';

export const dynamic = 'force-dynamic';

const WORKFLOW_FILE = 'insights-analyze.yml';

interface TriggerSuccessBody {
  id: number;
  status: 'RUNNING';
  createdAt: string;
}

type RefusalCode = 'NO_CLAUDE_JOBS' | 'NO_NEW_SHIPPED' | 'ALREADY_RUNNING';

interface RefusalBody {
  refusalCode: RefusalCode;
  message: string;
}

function refusal(code: RefusalCode, message: string): NextResponse {
  const body: RefusalBody = { refusalCode: code, message };
  return NextResponse.json(body, { status: 409 });
}

/**
 * POST /api/admin/insights/trigger — start an Insights analysis (AIB-791
 * US3, D-5, FR-006..FR-015, FR-022).
 *
 * Flow (contracts/admin-api.md):
 *   1. requireAdminOrNotFound
 *   2. reconcileOrphanedRunningReports
 *   3. pre-flight: NO_CLAUDE_JOBS vs NO_NEW_SHIPPED
 *   4. concurrency gate: ALREADY_RUNNING
 *   5. compute periodStart/periodEnd
 *   6. single-transaction insert of InsightsReport + Job
 *   7. workflow dispatch
 *   8. on dispatch failure: atomic transition to FAILED + delete Job (D-5)
 */
export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireAdminOrNotFound(request);
  if (!auth.ok) return auth.response;

  await reconcileOrphanedRunningReports(new Date());

  const prevEnd = await getLastCompletedRunEnd();
  const shippedSince = await countShippedClaudeTicketsSince(prevEnd);

  if (shippedSince === 0) {
    // First-ever run with zero shipped Claude tickets: NO_CLAUDE_JOBS. Once
    // any Claude ticket has shipped, `shippedSince` (counted against a null
    // floor) will be ≥ 1 and we land in the NO_NEW_SHIPPED branch below
    // with a real `prevEnd` to reference. Never synthesize `new Date()` as
    // a "last run" — the operator would see a fabricated timestamp that
    // does not correspond to any real run.
    if (prevEnd === null) {
      return refusal(
        'NO_CLAUDE_JOBS',
        'No shipped Claude tickets to analyze yet'
      );
    }
    return refusal(
      'NO_NEW_SHIPPED',
      `No new shipped tickets since last run on ${prevEnd.toISOString()}`
    );
  }

  // Fast-path read for the common case where a run is already visible. The
  // authoritative gate is the partial-unique index enforced inside
  // createRunningReportAndJob — this early refusal just avoids an
  // unnecessary transaction round trip.
  const running = await getRunningReport();
  if (running) {
    return refusal(
      'ALREADY_RUNNING',
      `Already running since ${running.createdAt.toISOString()}`
    );
  }

  const now = new Date();
  const periodStart = prevEnd ?? (await getEarliestClaudeJobTimestamp()) ?? now;
  const periodEnd = now;

  // The driving Job needs a projectId. Insights jobs aren't tied to a single
  // project; we record the configured ai-board host project (the repo we
  // dispatch against) so existing project-scoped log queries still resolve.
  // Selection: GITHUB_OWNER/GITHUB_REPO env match first, then the smallest
  // id as a last-resort fallback so dev/test environments keep working.
  const aiboardOwnerEnv = process.env.GITHUB_OWNER ?? null;
  const aiboardRepoEnv = process.env.GITHUB_REPO ?? null;
  const hostProject =
    aiboardOwnerEnv && aiboardRepoEnv
      ? await prisma.project.findFirst({
          where: { githubOwner: aiboardOwnerEnv, githubRepo: aiboardRepoEnv },
          orderBy: { id: 'asc' },
          select: { id: true, githubOwner: true, githubRepo: true, defaultBranch: true },
        })
      : null;
  const fallbackProject =
    hostProject ??
    (await prisma.project.findFirst({
      orderBy: { id: 'asc' },
      select: { id: true, githubOwner: true, githubRepo: true, defaultBranch: true },
    }));
  if (!fallbackProject) {
    return NextResponse.json(
      { error: 'No project configured to host the insights job' },
      { status: 500 }
    );
  }

  let report;
  let jobId: number;
  try {
    const created = await createRunningReportAndJob({
      periodStart,
      periodEnd,
      now,
      projectId: fallbackProject.id,
    });
    report = created.report;
    jobId = created.jobId;
  } catch (error) {
    if (error instanceof InsightsAlreadyRunningError) {
      const current = await getRunningReport();
      return refusal(
        'ALREADY_RUNNING',
        current
          ? `Already running since ${current.createdAt.toISOString()}`
          : 'Another insights run is already in progress'
      );
    }
    throw error;
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!isWorkflowTestMode(githubToken)) {
    const aiboardOwner = process.env.GITHUB_OWNER;
    const aiboardRepo = process.env.GITHUB_REPO;
    if (!aiboardOwner || !aiboardRepo) {
      await markFailed(report.id, 'GITHUB_OWNER/GITHUB_REPO not configured');
      await prisma.job.delete({ where: { id: jobId } }).catch(() => undefined);
      return NextResponse.json(
        {
          refusalCode: 'DISPATCH_FAILED',
          message: 'Workflow dispatch failed',
          code: 'GITHUB_ERROR',
        },
        { status: 502 }
      );
    }

    try {
      const octokit = new Octokit({ auth: githubToken });
      // Prefer the explicit dispatch ref, then the host project's
      // defaultBranch, then 'main'. Hard-coding 'main' breaks deployments
      // whose default branch is renamed (e.g. master/trunk).
      const dispatchRef =
        process.env.INSIGHTS_WORKFLOW_REF ??
        fallbackProject.defaultBranch ??
        'main';
      await octokit.actions.createWorkflowDispatch({
        owner: aiboardOwner,
        repo: aiboardRepo,
        workflow_id: WORKFLOW_FILE,
        ref: dispatchRef,
        inputs: {
          report_id: String(report.id),
          job_id: String(jobId),
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof RequestError) {
        const reason = `Workflow dispatch failed: ${error.status} ${error.message}`;
        await markFailed(report.id, reason);
        await prisma.job
          .delete({ where: { id: jobId } })
          .catch(() => undefined);
        return NextResponse.json(
          {
            refusalCode: 'DISPATCH_FAILED',
            message: 'Workflow dispatch failed',
            code: 'GITHUB_ERROR',
          },
          { status: 502 }
        );
      }
      throw error;
    }
  }

  const body: TriggerSuccessBody = {
    id: report.id,
    status: 'RUNNING',
    createdAt: report.createdAt.toISOString(),
  };
  return NextResponse.json(body, { status: 201 });
}
