import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import {
  CONSTITUTION_PATH,
  type ConstitutionDiffResponse,
  type ConstitutionError,
} from '@/lib/types/constitution';

const ProjectIdSchema = z
  .string()
  .regex(/^\d+$/, 'Project ID must be a number')
  .transform((val) => parseInt(val, 10));

const ShaSchema = z
  .string()
  .regex(/^[a-f0-9]{40}$/, 'SHA must be a 40-character hexadecimal string');

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse<ConstitutionDiffResponse | ConstitutionError>> {
  try {
    const { projectId: projectIdString } = await context.params;

    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json({ error: 'Invalid project ID', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const projectId = projectIdResult.data;

    const { searchParams } = new URL(request.url);
    const sha = searchParams.get('sha');

    if (!sha) {
      return NextResponse.json({ error: 'Missing required query parameter: sha', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const shaResult = ShaSchema.safeParse(sha);
    if (!shaResult.success) {
      return NextResponse.json({ error: 'Invalid SHA format', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const validatedSha = shaResult.data;

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

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return NextResponse.json({ error: 'GitHub integration not configured', code: 'GITHUB_API_ERROR' }, { status: 500 });
    }

    const octokit = new Octokit({ auth: githubToken });

    const { data: commit } = await octokit.repos.getCommit({
      owner: project.githubOwner,
      repo: project.githubRepo,
      ref: validatedSha,
    });

    const filteredFiles = commit.files?.filter((file) => file.filename === CONSTITUTION_PATH) || [];

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

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('[constitution/diff/GET] Error:', error);
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      return NextResponse.json({ error: 'Commit not found in repository', code: 'COMMIT_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch diff from GitHub', code: 'GITHUB_API_ERROR' }, { status: 500 });
  }
}
