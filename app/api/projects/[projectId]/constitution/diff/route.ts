/**
 * GET /api/projects/[projectId]/constitution/diff
 *
 * Fetches the diff for a specific commit affecting the constitution file.
 *
 * @param request - Next.js request object with query parameters (sha required)
 * @param context - Route context with projectId param
 *
 * @returns JSON response with commit SHA and files array
 *
 * @throws 400 - Validation error (invalid project ID or SHA format)
 * @throws 401 - Unauthorized
 * @throws 404 - Project or commit not found
 * @throws 500 - GitHub API error or internal server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import {
  CONSTITUTION_PATH,
  type ConstitutionDiffResponse,
  type ConstitutionError,
} from '@/lib/types/constitution';

/**
 * Zod schema for validating projectId path parameter
 */
const ProjectIdSchema = z
  .string()
  .regex(/^\d+$/, 'Project ID must be a number')
  .transform((val) => parseInt(val, 10));

/**
 * Zod schema for validating SHA query parameter
 */
const ShaSchema = z
  .string()
  .regex(/^[a-f0-9]{40}$/, 'SHA must be a 40-character hexadecimal string');

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse<ConstitutionDiffResponse | ConstitutionError>> {
  try {
    const params = await context.params;
    const { projectId: projectIdString } = params;

    // Validate projectId
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      console.error('[constitution/diff/GET] Invalid project ID:', {
        projectId: projectIdString,
        error: projectIdResult.error.message,
      });
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const projectId = projectIdResult.data;

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const sha = searchParams.get('sha');

    if (!sha) {
      console.error('[constitution/diff/GET] Missing sha query parameter');
      return NextResponse.json(
        { error: 'Missing required query parameter: sha', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const shaResult = ShaSchema.safeParse(sha);
    if (!shaResult.success) {
      console.error('[constitution/diff/GET] Invalid SHA format:', {
        sha,
        error: shaResult.error.message,
      });
      return NextResponse.json(
        { error: 'Invalid SHA format', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const validatedSha = shaResult.data;

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
      console.log('[constitution/diff/GET] Using mock data (test mode)');
      const response: ConstitutionDiffResponse = {
        sha: validatedSha,
        files: [
          {
            filename: CONSTITUTION_PATH,
            status: 'modified',
            additions: 5,
            deletions: 2,
            patch: `@@ -1,3 +1,6 @@\n # Project Constitution\n \n-Old content\n+New content\n+Additional line\n Mock changes`,
          },
        ],
      };
      return NextResponse.json(response);
    }

    // Initialize GitHub API client
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error('[constitution/diff/GET] GITHUB_TOKEN not configured');
      return NextResponse.json(
        { error: 'GitHub integration not configured', code: 'GITHUB_API_ERROR' },
        { status: 500 }
      );
    }

    const octokit = new Octokit({ auth: githubToken });

    console.log('[constitution/diff/GET] Fetching commit diff:', {
      owner: project.githubOwner,
      repo: project.githubRepo,
      ref: validatedSha,
    });

    // Fetch commit details from GitHub
    const { data: commit } = await octokit.repos.getCommit({
      owner: project.githubOwner,
      repo: project.githubRepo,
      ref: validatedSha,
    });

    // Filter files to only include the constitution file
    const filteredFiles = commit.files?.filter((file) => file.filename === CONSTITUTION_PATH) || [];

    // Transform GitHub API response to our schema
    const response: ConstitutionDiffResponse = {
      sha: commit.sha,
      files: filteredFiles.map((file) => {
        const diffFile: ConstitutionDiffResponse['files'][number] = {
          filename: file.filename,
          status: file.status as 'added' | 'modified' | 'removed',
          additions: file.additions,
          deletions: file.deletions,
        };
        if (file.patch !== undefined) {
          diffFile.patch = file.patch;
        }
        return diffFile;
      }),
    };

    console.log('[constitution/diff/GET] Successfully fetched commit diff:', {
      sha: response.sha,
      fileCount: response.files.length,
    });

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('[constitution/diff/GET] Error fetching commit diff:', error);

    // GitHub API errors
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      return NextResponse.json(
        { error: 'Commit not found in repository', code: 'COMMIT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Generic error
    return NextResponse.json(
      { error: 'Failed to fetch diff from GitHub', code: 'GITHUB_API_ERROR' },
      { status: 500 }
    );
  }
}
