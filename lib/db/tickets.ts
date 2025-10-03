import { prisma } from './client';
import { Stage, getAllStages } from '../stage-validation';
import { TicketWithVersion } from '../types';
import type { CreateTicketInput } from '../validations/ticket';

/**
 * Fetch all tickets grouped by stage
 * Sorted by most recently updated first
 * Returns tickets with version field for optimistic concurrency control
 */
export async function getTicketsByStage(): Promise<Record<Stage, TicketWithVersion[]>> {
  const tickets = await prisma.ticket.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      stage: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Group tickets by stage with new stage names
  const grouped = getAllStages().reduce((acc, stage) => {
    acc[stage] = [];
    return acc;
  }, {} as Record<Stage, TicketWithVersion[]>);

  tickets.forEach((ticket) => {
    if (ticket.stage in grouped) {
      grouped[ticket.stage as Stage].push({
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        stage: ticket.stage as Stage,
        version: ticket.version,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
      });
    }
  });

  return grouped;
}

/**
 * Create a new ticket in the INBOX stage
 * Uses default project for MVP - creates it if it doesn't exist
 */
export async function createTicket(input: CreateTicketInput) {
  // For MVP, use the default project
  // In the future, projectId will be passed as part of the input
  const githubOwner = process.env.GITHUB_OWNER || 'default-owner';
  const githubRepo = process.env.GITHUB_REPO || 'default-repo';

  // Ensure default project exists (for test environments where DB is cleaned)
  const project = await prisma.project.upsert({
    where: {
      githubOwner_githubRepo: {
        githubOwner,
        githubRepo,
      },
    },
    update: {},
    create: {
      name: 'ai-board',
      description: 'AI-powered project management board',
      githubOwner,
      githubRepo,
    },
  });

  return await prisma.ticket.create({
    data: {
      title: input.title,
      description: input.description,
      stage: 'INBOX',
      projectId: project.id,
    },
  });
}