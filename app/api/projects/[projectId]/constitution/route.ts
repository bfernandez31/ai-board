/**
 * Constitution API Routes
 *
 * GET /api/projects/[projectId]/constitution
 * - Fetches the constitution markdown file from the project's GitHub repository
 *
 * PUT /api/projects/[projectId]/constitution
 * - Updates the constitution content in the project's GitHub repository
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { fetchConstitutionContent, updateConstitutionContent } from '@/lib/github/constitution-fetcher';
import { validateMarkdown } from '@/app/lib/git/validate';
import {
  CONSTITUTION_PATH,
  type ConstitutionContent,
  type ConstitutionNotFound,
  type ConstitutionUpdateResponse,
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
 * Zod schema for constitution update request
 */
const ConstitutionUpdateSchema = z.object({
  content: z
    .string()
    .min(1, 'Content cannot be empty')
    .max(1048576, 'Content cannot exceed 1MB'),
  commitMessage: z
    .string()
    .max(500, 'Commit message cannot exceed 500 characters')
    .optional(),
});

/**
 * GET /api/projects/[projectId]/constitution
 *
 * Fetches the constitution content from the project's GitHub repository.
 *
 * @returns ConstitutionContent on success, ConstitutionNotFound if file doesn't exist
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse<ConstitutionContent | ConstitutionNotFound | ConstitutionError>> {
  try {
    const params = await context.params;
    const { projectId: projectIdString } = params;

    // Validate projectId
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      console.error('[constitution/GET] Invalid project ID:', {
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

    // Fetch constitution content from GitHub
    try {
      const constitution = await fetchConstitutionContent({
        owner: project.githubOwner,
        repo: project.githubRepo,
      });

      console.log('[constitution/GET] Successfully fetched constitution:', {
        projectId,
        contentLength: constitution.content.length,
      });

      return NextResponse.json(constitution);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        console.log('[constitution/GET] Constitution file not found:', {
          projectId,
          path: CONSTITUTION_PATH,
        });
        return NextResponse.json(
          {
            error: 'Constitution file not found',
            exists: false,
            guidance: 'Create a constitution using the /speckit.constitution command in Claude Code.',
          } as ConstitutionNotFound,
          { status: 404 }
        );
      }
      throw error;
    }
  } catch (error: unknown) {
    console.error('[constitution/GET] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[projectId]/constitution
 *
 * Updates the constitution content in the project's GitHub repository.
 *
 * @returns ConstitutionUpdateResponse on success
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse<ConstitutionUpdateResponse | ConstitutionError>> {
  try {
    const params = await context.params;
    const { projectId: projectIdString } = params;

    // Validate projectId
    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      console.error('[constitution/PUT] Invalid project ID:', {
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

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const parseResult = ConstitutionUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      const flattened = parseResult.error.flatten();
      const fieldErrorMessages = Object.entries(flattened.fieldErrors)
        .map(
          ([field, errors]) =>
            `${field}: ${(errors as string[] | undefined)?.join(', ') || 'error'}`
        )
        .join('; ');

      console.error('[constitution/PUT] Validation failed:', {
        projectId,
        issues: parseResult.error.issues,
      });

      return NextResponse.json(
        { error: fieldErrorMessages || 'Validation error', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { content, commitMessage } = parseResult.data;

    // Validate markdown syntax
    const validation = await validateMarkdown(content);
    if (!validation.valid) {
      console.error('[constitution/PUT] Invalid markdown:', {
        projectId,
        error: validation.error,
      });
      return NextResponse.json(
        { error: `Invalid markdown: ${validation.error}`, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // First, fetch current constitution to get SHA
    let currentSha: string;
    try {
      const current = await fetchConstitutionContent({
        owner: project.githubOwner,
        repo: project.githubRepo,
      });
      currentSha = current.sha;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        // File doesn't exist yet, we can't update it
        return NextResponse.json(
          {
            error: 'Constitution file not found. Create it first using /speckit.constitution command.',
            code: 'NOT_FOUND',
          },
          { status: 404 }
        );
      }
      throw error;
    }

    // Update constitution content
    try {
      const updateParams: Parameters<typeof updateConstitutionContent>[0] = {
        owner: project.githubOwner,
        repo: project.githubRepo,
        content,
        sha: currentSha,
      };
      if (commitMessage !== undefined) {
        updateParams.commitMessage = commitMessage;
      }
      const result = await updateConstitutionContent(updateParams);

      console.log('[constitution/PUT] Successfully updated constitution:', {
        projectId,
        commitSha: result.commitSha,
      });

      return NextResponse.json({
        success: true,
        commitSha: result.commitSha,
        updatedAt: result.updatedAt,
        message: 'Constitution updated successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Another user has modified')) {
          return NextResponse.json(
            { error: error.message, code: 'MERGE_CONFLICT' },
            { status: 409 }
          );
        }
        if (error.message.includes('not found')) {
          return NextResponse.json(
            { error: error.message, code: 'NOT_FOUND' },
            { status: 404 }
          );
        }
      }
      throw error;
    }
  } catch (error: unknown) {
    console.error('[constitution/PUT] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
