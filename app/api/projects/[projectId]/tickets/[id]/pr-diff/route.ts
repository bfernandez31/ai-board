/**
 * GET /api/projects/[projectId]/tickets/[id]/pr-diff
 *
 * Single live read powering the in-app PR diff viewer (AIB-879). Resolves the
 * ticket's PR, its changed files + inline review comments (live from GitHub via
 * the acting user's OAuth token), merges the persisted layer-decomposition
 * snapshot, and assembles the Overview. Read-only: no mutation, no review
 * computation (FR-012, SC-002).
 *
 * @see specs/AIB-879-visualiseur-de-diff/contracts/pr-diff-api.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { requireAuth } from '@/lib/db/users';
import { prisma } from '@/lib/db/client';
import { resolveTicket } from '@/app/lib/utils/ticket-resolver';
import { createUserGitHubClient, requireRepoScope } from '@/lib/github/user-client';
import {
  resolvePr,
  listPrFiles,
  listPrReviewComments,
  mapPrFile,
  attachReviewComments,
  PrStateError,
  type RawPrFile,
  type RawReviewComment,
} from '@/lib/github/pr-state';
import { parseLayerDecomposition, reconcileLayers } from '@/lib/pr-layers';
import { getScoreThreshold } from '@/lib/quality-score';
import type {
  FileChange,
  PrDiffResponse,
  PrOverview,
  PrSummary,
} from '@/app/lib/schemas/pr-diff';

function isTestMode(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.TEST_MODE === 'true' ||
    !!process.env.TEST_USER_ID
  );
}

/**
 * Deterministic test-mode PR state. Scenarios are driven by the ticket branch:
 *  - branch contains "no-pr"        → no PR (pr: null empty state)
 *  - branch contains "auth-required"→ AUTH_REQUIRED (missing GitHub scope)
 *  - otherwise                      → a reviewed PR with files + comments (one outdated)
 * The fixture runs the real `mapPrFile`/`attachReviewComments` derivation so source
 * attribution and outdated-anchoring are genuinely exercised.
 */
function buildTestFixture(branch: string): {
  pr: PrSummary | null;
  files: FileChange[];
  truncated: boolean;
  authRequired: boolean;
} {
  if (branch.includes('auth-required')) {
    return { pr: null, files: [], truncated: false, authRequired: true };
  }
  if (branch.includes('no-pr')) {
    return { pr: null, files: [], truncated: false, authRequired: false };
  }

  const rawFiles: RawPrFile[] = [
    {
      filename: 'prisma/schema.prisma',
      status: 'modified',
      additions: 3,
      deletions: 0,
      patch: '@@ -1,3 +1,6 @@\n context1\n context2\n context3\n+added4\n+added5\n+added6',
    },
    {
      filename: 'lib/pr-layers.ts',
      status: 'added',
      additions: 50,
      deletions: 0,
      patch: '@@ -0,0 +1,3 @@\n+export const a = 1;\n+export const b = 2;\n+export const c = 3;',
    },
    {
      filename: 'components/ticket/pr-diff-viewer.tsx',
      status: 'added',
      additions: 120,
      deletions: 0,
      patch: '@@ -0,0 +1,2 @@\n+export function PrDiffViewer() {}\n+// viewer',
    },
    {
      filename: 'app/api/new-route.ts',
      status: 'added',
      additions: 10,
      deletions: 0,
      patch: '@@ -0,0 +1,1 @@\n+// added after review',
    },
    {
      filename: 'assets/logo.png',
      status: 'modified',
      additions: 0,
      deletions: 0,
      // no patch → binary
    },
  ];

  const files = rawFiles.map((raw) => mapPrFile(raw).file);

  const rawComments: RawReviewComment[] = [
    {
      id: 1,
      path: 'prisma/schema.prisma',
      line: 4,
      body: 'Our review: nullable column looks good.',
      created_at: '2026-06-30T10:00:00Z',
      user: { login: 'ai-board[bot]', type: 'Bot' },
    },
    {
      id: 2,
      path: 'lib/pr-layers.ts',
      line: 2,
      body: 'Dependency bot: consider pinning.',
      created_at: '2026-06-30T10:05:00Z',
      user: { login: 'dependabot[bot]', type: 'Bot' },
    },
    {
      id: 3,
      path: 'components/ticket/pr-diff-viewer.tsx',
      line: 1,
      body: 'Human reviewer: nice work.',
      created_at: '2026-06-30T10:10:00Z',
      user: { login: 'alice', type: 'User' },
    },
    {
      id: 4,
      path: 'prisma/schema.prisma',
      line: null, // anchor no longer exists → outdated
      body: 'Outdated: this referred to a removed line.',
      created_at: '2026-06-30T09:00:00Z',
      user: { login: 'bob', type: 'User' },
    },
  ];

  attachReviewComments(files, rawComments);

  const pr: PrSummary = {
    number: 542,
    title: 'AIB-879 diff viewer',
    state: 'open',
    url: 'https://github.com/test/test/pull/542',
  };

  return { pr, files, truncated: false, authRequired: false };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const { projectId: projectIdString, id: ticketIdentifier } = await context.params;

    // Validate projectId
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }
    const projectId = parseInt(projectIdResult.data, 10);

    // Authorize: owner or member (throws Unauthorized / Project not found)
    const project = await verifyProjectAccess(projectId, request);

    // Resolve ticket within the project
    const ticket = await resolveTicket(projectId, ticketIdentifier);
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }
    if (!ticket.branch) {
      return NextResponse.json(
        { error: `Branch not found for ticket #${ticket.id}`, code: 'BRANCH_NOT_FOUND' },
        { status: 404 }
      );
    }
    const branch = ticket.branch;

    // Resolve the live PR state (files + comments). Test mode short-circuits the
    // GitHub calls with a deterministic fixture; production uses the acting user's
    // OAuth token.
    let pr: PrSummary | null;
    let files: FileChange[];
    let truncated: boolean;

    if (isTestMode()) {
      const fixture = buildTestFixture(branch);
      if (fixture.authRequired) {
        return NextResponse.json(
          {
            error: 'GitHub authorization required: reconnect GitHub with repo scope.',
            code: 'AUTH_REQUIRED',
          },
          { status: 403 }
        );
      }
      pr = fixture.pr;
      files = fixture.files;
      truncated = fixture.truncated;
    } else {
      const userId = await requireAuth(request);
      let octokit;
      try {
        await requireRepoScope(userId);
        octokit = await createUserGitHubClient(userId);
      } catch {
        return NextResponse.json(
          {
            error: 'GitHub authorization required: reconnect GitHub with repo scope.',
            code: 'AUTH_REQUIRED',
          },
          { status: 403 }
        );
      }

      const owner = project.githubOwner;
      const repo = project.githubRepo;

      pr = await resolvePr(octokit, { owner, repo, branch });
      if (!pr) {
        files = [];
        truncated = false;
      } else {
        const result = await listPrFiles(octokit, owner, repo, pr.number);
        files = result.files;
        truncated = result.truncated;
        await listPrReviewComments(octokit, owner, repo, pr.number, files);
      }
    }

    // No PR → empty state (200, not an error).
    if (!pr) {
      const emptyOverview: PrOverview = {
        pr: null,
        reviewSynthesis: null,
        qualityScore: null,
        qualityThreshold: null,
      };
      const emptyResponse: PrDiffResponse = {
        pr: null,
        overview: emptyOverview,
        layers: [],
        files: [],
        truncated: false,
      };
      return NextResponse.json(emptyResponse);
    }

    // Load the latest COMPLETED verify job carrying the layer artifact + score.
    const verifyJob = await prisma.job.findFirst({
      where: { ticketId: ticket.id, command: 'verify', status: 'COMPLETED' },
      orderBy: { startedAt: 'desc' },
      select: { qualityScore: true, layerDecomposition: true },
    });

    const artifact = parseLayerDecomposition(verifyJob?.layerDecomposition ?? null);
    const layers = reconcileLayers(artifact, files);

    const qualityScore = verifyJob?.qualityScore ?? null;
    const overview: PrOverview = {
      pr,
      reviewSynthesis: null,
      qualityScore,
      qualityThreshold: qualityScore != null ? getScoreThreshold(qualityScore) : null,
    };

    const response: PrDiffResponse = {
      pr,
      overview,
      layers,
      files,
      truncated,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    if (error instanceof PrStateError) {
      const status = error.code === 'GITHUB_FORBIDDEN' ? 403 : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized: Please sign in', code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }
      if (error.message === 'Forbidden' || error.message === 'Project not found') {
        return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 });
      }
    }
    console.error('[pr-diff/GET] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PR diff from GitHub', code: 'GITHUB_API_ERROR' },
      { status: 500 }
    );
  }
}
