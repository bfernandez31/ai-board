import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import {
  CONSTITUTION_PATH,
  type ConstitutionHistoryResponse,
  type ConstitutionError,
} from '@/lib/types/constitution';

const ProjectIdSchema = z
  .string()
  .regex(/^\d+$/, 'Project ID must be a number')
  .transform((val) => parseInt(val, 10));

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse<ConstitutionHistoryResponse | ConstitutionError>> {
  try {
    const { projectId: projectIdString } = await context.params;

    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json({ error: 'Invalid project ID', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const projectId = projectIdResult.data;

    let project;
    try {
      project = await verifyProjectAccess(projectId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    if (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true' || process.env.TEST_USER_ID) {
      const response: ConstitutionHistoryResponse = {
        commits: [
          {
            sha: `mock-sha-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            author: {
              name: 'Test User',
              email: 'test@e2e.local',
              date: new Date().toISOString(),
            },
            message: 'docs(constitution): Update project constitution',
            url: `https://github.com/${project.githubOwner}/${project.githubRepo}/commit/mock-sha`,
          },
        ],
      };
      return NextResponse.json(response);
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return NextResponse.json({ error: 'GitHub integration not configured', code: 'GITHUB_API_ERROR' }, { status: 500 });
    }

    const octokit = new Octokit({ auth: githubToken });

    const { data: commits } = await octokit.repos.listCommits({
      owner: project.githubOwner,
      repo: project.githubRepo,
      sha: 'main',
      path: CONSTITUTION_PATH,
    });

    const response: ConstitutionHistoryResponse = {
      commits: commits.map((commit) => ({
        sha: commit.sha,
        author: {
          name: commit.commit.author?.name || 'Unknown',
          email: commit.commit.author?.email || 'unknown@unknown.com',
          date: commit.commit.author?.date || new Date().toISOString(),
        },
        message: commit.commit.message,
        url: commit.html_url,
      })),
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('[constitution/history/GET] Error:', error);
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      return NextResponse.json({ error: 'Constitution file not found in repository', code: 'NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch commit history from GitHub', code: 'GITHUB_API_ERROR' }, { status: 500 });
  }
}
