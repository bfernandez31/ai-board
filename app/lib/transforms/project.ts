import type { ProjectWithCount } from '@/app/lib/types/project';
import type { getUserProjects } from '@/lib/db/projects';

type ProjectQueryResult = Awaited<ReturnType<typeof getUserProjects>>[number];

/**
 * Transform a Prisma project query result into the API response shape.
 * Used by both the API route and the server component to avoid duplication.
 */
export function toProjectResponse(project: ProjectQueryResult): ProjectWithCount {
  const lastShipped = project.tickets[0];
  return {
    id: project.id,
    key: project.key,
    name: project.name,
    description: project.description,
    githubOwner: project.githubOwner,
    githubRepo: project.githubRepo,
    deploymentUrl: project.deploymentUrl,
    updatedAt: project.updatedAt.toISOString(),
    ticketCount: project._count.tickets,
    lastShippedTicket: lastShipped
      ? {
          id: lastShipped.id,
          ticketKey: lastShipped.ticketKey,
          title: lastShipped.title,
          updatedAt: lastShipped.updatedAt.toISOString(),
        }
      : null,
    healthScore: project.healthScore ?? null,
  };
}
