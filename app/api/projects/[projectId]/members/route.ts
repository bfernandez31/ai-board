/**
 * GET /api/projects/:projectId/members
 *
 * Fetch all users who are members of a project for autocomplete dropdown
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { z } from 'zod';

/**
 * Zod schema for project member response
 */
const projectMemberSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().email(),
});

const getProjectMembersResponseSchema = z.object({
  members: z.array(projectMemberSchema),
});

export type GetProjectMembersResponse = z.infer<typeof getProjectMembersResponseSchema>;

/**
 * GET /api/projects/:projectId/members
 *
 * Returns all users who are members of the specified project
 *
 * @param request - Next.js request object
 * @param params - Route parameters { projectId: string }
 * @returns JSON response with members array or error
 *
 * Responses:
 * - 200: Success with members array
 * - 401: Unauthorized (no session)
 * - 403: Forbidden (project not owned by user)
 * - 404: Project not found
 * - 500: Internal server error
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    // 1. Parameter validation
    const { projectId } = await params;
    const projectIdNumber = parseInt(projectId, 10);

    if (isNaN(projectIdNumber)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    // 2. Authorization: Verify project ownership (also validates authentication)
    await verifyProjectOwnership(projectIdNumber);

    // 3. Fetch project members from ProjectMember join table
    const projectMembers = await prisma.projectMember.findMany({
      where: {
        projectId: projectIdNumber,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
    });

    // Extract users from ProjectMember records
    const members = projectMembers.map(pm => pm.user);

    // 4. Return response
    const response: GetProjectMembersResponse = {
      members,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[GET /api/projects/:projectId/members] Error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized - No session found' },
          { status: 401 }
        );
      }
      if (error.message === 'Forbidden') {
        return NextResponse.json(
          { error: 'Forbidden - Project not owned by user' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch project members' },
      { status: 500 }
    );
  }
}
