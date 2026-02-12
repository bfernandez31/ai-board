import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/auth-helpers';
import { fetchConstitutionContent, updateConstitutionContent } from '@/lib/github/constitution-fetcher';
import { validateMarkdown } from '@/app/lib/git/validate';
import {
  type ConstitutionContent,
  type ConstitutionNotFound,
  type ConstitutionUpdateResponse,
  type ConstitutionError,
} from '@/lib/types/constitution';

const ProjectIdSchema = z
  .string()
  .regex(/^\d+$/, 'Project ID must be a number')
  .transform((val) => parseInt(val, 10));

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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse<ConstitutionContent | ConstitutionNotFound | ConstitutionError>> {
  try {
    const { projectId: projectIdString } = await context.params;

    const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
    if (!projectIdResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
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

    try {
      const constitution = await fetchConstitutionContent({
        owner: project.githubOwner,
        repo: project.githubRepo,
      });
      return NextResponse.json(constitution);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
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

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse<ConstitutionUpdateResponse | ConstitutionError>> {
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

      return NextResponse.json(
        { error: fieldErrorMessages || 'Validation error', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { content, commitMessage } = parseResult.data;

    const validation = await validateMarkdown(content);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Invalid markdown: ${validation.error}`, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    let currentSha: string;
    try {
      const current = await fetchConstitutionContent({
        owner: project.githubOwner,
        repo: project.githubRepo,
      });
      currentSha = current.sha;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
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
    console.error('[constitution/PUT] Error:', error);
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
