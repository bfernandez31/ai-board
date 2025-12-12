/**
 * GET /api/projects/[projectId]/constitution/history
 *
 * Fetches commit history for the constitution file.
 *
 * @returns JSON response with array of commits (sha, author, message, url)
 *
 * @throws 400 - Validation error (invalid project ID)
 * @throws 401 - Unauthorized
 * @throws 404 - Project not found
 * @throws 500 - GitHub API error or internal server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import {
  CONSTITUTION_PATH,
  type ConstitutionHistoryResponse,
  type ConstitutionError,
} from '@/lib/types/constitution';

/**
 * Zod schema for validating projectId path parameter
 */
const ProjectIdSchema = z
  .string()
  .regex(/^\d+$/, 'Project ID must be a number')
  .transform((val) => parseInt(val, 10));

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse<ConstitutionHistoryResponse | ConstitutionError>> {
  try {
    const params = await context.params;
    const { projectId: projectIdString } = params;

    // Validate projectId
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      console.error('[constitution/history/GET] Invalid project ID:', {
        projectId: projectIdString,
        error: projectIdResult.error.message,
      });
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const projectId = projectIdResult.data;

    // Verify project access (owner or member)
    let project;
    try {
      project = await verifyProjectAccess(projectId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Project not found') {
        return NextResponse.json(
          { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
          { status: 404 }
        );
      }
      // Unauthorized
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Mock GitHub API in test environment
    if (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true' || process.env.TEST_USER_ID) {
      console.log('[constitution/history/GET] Using mock data (test mode)');
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

    // Initialize GitHub API client
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error('[constitution/history/GET] GITHUB_TOKEN not configured');
      return NextResponse.json(
        { error: 'GitHub integration not configured', code: 'GITHUB_API_ERROR' },
        { status: 500 }
      );
    }

    const octokit = new Octokit({ auth: githubToken });

    console.log('[constitution/history/GET] Fetching commit history:', {
      owner: project.githubOwner,
      repo: project.githubRepo,
      path: CONSTITUTION_PATH,
    });

    // Fetch commit history from GitHub
    const { data: commits } = await octokit.repos.listCommits({
      owner: project.githubOwner,
      repo: project.githubRepo,
      sha: 'main',
      path: CONSTITUTION_PATH,
    });

    // Transform GitHub API response to our schema
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

    console.log('[constitution/history/GET] Successfully fetched commit history:', {
      commitCount: response.commits.length,
    });

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('[constitution/history/GET] Error fetching commit history:', error);

    // GitHub API errors
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      return NextResponse.json(
        { error: 'Constitution file not found in repository', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Generic error
    return NextResponse.json(
      { error: 'Failed to fetch commit history from GitHub', code: 'GITHUB_API_ERROR' },
      { status: 500 }
    );
  }
}
