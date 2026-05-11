/**
 * Workflow-token-authenticated cross-tenant read of the raw native Claude
 * session JSONL artifact (AIB-791 US3, D-6).
 *
 * Threat model:
 *   - This endpoint is gated only by `WORKFLOW_API_TOKEN` (no user session).
 *     Compromise of that token already grants read/write access to log
 *     artifact uploads for every project's jobs (see existing
 *     `/api/jobs/:id/logs/raw-artifact` routes); this endpoint shares that
 *     trust boundary.
 *   - We restrict the response to JOBS whose effective agent is CLAUDE, via
 *     the SHARED predicate in `app/lib/insights/predicate.ts`. A Codex job
 *     id returns 404, exactly as the workflow's enumeration would skip it.
 *   - The endpoint streams the existing `raw-logs/<projectId>/<ticketId>/
 *     <jobId>.jsonl.gz` blob (already produced by AIB-783's capture path);
 *     no new artifact location is introduced.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { validateWorkflowAuth } from '@/app/lib/auth/workflow-auth';
import { streamJobLogArtifact } from '@/app/lib/blob/client';
import { buildJobLogRawArtifactKey } from '@/app/lib/logs/artifact-key';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
): Promise<Response> {
  const auth = validateWorkflowAuth(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId: jobIdString } = await context.params;
  const jobId = Number.parseInt(jobIdString, 10);
  if (!Number.isFinite(jobId) || jobId <= 0) {
    return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      projectId: true,
      ticketId: true,
      ticket: {
        select: {
          agent: true,
          project: { select: { defaultAgent: true } },
        },
      },
    },
  });
  if (!job || job.ticketId === null || !job.ticket) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Apply the shared effective-agent predicate (D-6, P-4). Non-Claude
  // returns 404 so the workflow's enumeration can't accidentally widen.
  const effective =
    job.ticket.agent ?? job.ticket.project.defaultAgent ?? 'CLAUDE';
  if (effective !== 'CLAUDE') {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const artifactKey = buildJobLogRawArtifactKey(
    job.projectId,
    job.ticketId,
    job.id
  );

  let result;
  try {
    result = await streamJobLogArtifact(artifactKey);
  } catch (error) {
    console.error('[GET admin/insights/jobs/:jobId/raw-native] blob stream failed', error);
    return NextResponse.json(
      { error: 'Blob backend unavailable', code: 'BLOB_UNREACHABLE' },
      { status: 502 }
    );
  }
  if (!result) {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
  }

  return new Response(result.stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/gzip',
      'Cache-Control': 'private, no-store',
      'Content-Length': String(result.size),
    },
  });
}
