import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import type { ProjectsListResponse } from '@/app/lib/types/project';

export async function GET() {
  try {
    // Fetch all projects with ticket counts
    const projects = await prisma.project.findMany({
      include: {
        _count: {
          select: { tickets: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Transform to API response shape
    const response: ProjectsListResponse = projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      updatedAt: project.updatedAt.toISOString(),
      ticketCount: project._count.tickets,
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
