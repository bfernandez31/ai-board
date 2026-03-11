/**
 * GET /api/projects/:projectId/members
 *
 * Fetch all users who are members of a project for autocomplete dropdown
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyProjectOwnership } from '@/lib/db/auth-helpers';
import { z } from 'zod';
import { requireAuth } from '@/lib/db/users';
import { getUserSubscription } from '@/lib/billing/subscription';

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

    // 3. Fetch project members from ProjectMember join table (exclude system user)
    const projectMembers = await prisma.projectMember.findMany({
      where: {
        projectId: projectIdNumber,
        user: { email: { not: 'ai-board@system.local' } },
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

const addMemberSchema = z.object({
  email: z.string().email(),
});

/**
 * POST /api/projects/:projectId/members
 *
 * Add a member to a project. Requires Team plan.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const projectIdNumber = parseInt(projectId, 10);

    if (isNaN(projectIdNumber)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    await verifyProjectOwnership(projectIdNumber);

    // Check plan allows members
    const userId = await requireAuth();
    const subscription = await getUserSubscription(userId);
    if (!subscription.limits.membersEnabled) {
      return NextResponse.json(
        { error: 'Project members require the Team plan. Upgrade to add members.', code: 'PLAN_LIMIT' },
        { status: 403 }
      );
    }

    // Check per-project member count limit
    if (subscription.limits.maxMembersPerProject !== null) {
      const memberCount = await prisma.projectMember.count({
        where: { projectId: projectIdNumber },
      });
      if (memberCount >= subscription.limits.maxMembersPerProject) {
        return NextResponse.json(
          { error: `Member limit reached. Your ${subscription.plan} plan allows ${subscription.limits.maxMembersPerProject} members per project.`, code: 'PLAN_LIMIT' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { email } = addMemberSchema.parse(body);

    const userToAdd = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!userToAdd) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: projectIdNumber,
          userId: userToAdd.id,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member' },
        { status: 409 }
      );
    }

    await prisma.projectMember.create({
      data: {
        projectId: projectIdNumber,
        userId: userToAdd.id,
      },
    });

    return NextResponse.json(
      { id: userToAdd.id, email: userToAdd.email, name: userToAdd.name },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }
    console.error('[POST /api/projects/:projectId/members] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add member' },
      { status: 500 }
    );
  }
}
