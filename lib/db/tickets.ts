import { prisma } from './client';
import type { TicketsByStage } from '../types';
import type { CreateTicketInput } from '../validations/ticket';

/**
 * Fetch all tickets grouped by stage
 * Sorted by most recently updated first
 */
export async function getTicketsByStage(): Promise<TicketsByStage> {
  const tickets = await prisma.ticket.findMany({
    orderBy: { updatedAt: 'desc' },
  });

  // Group tickets by stage
  const grouped: TicketsByStage = {
    IDLE: [],
    PLAN: [],
    BUILD: [],
    REVIEW: [],
    SHIPPED: [],
    ERRORED: [],
  };

  tickets.forEach((ticket) => {
    grouped[ticket.stage].push(ticket);
  });

  return grouped;
}

/**
 * Create a new ticket in the IDLE stage
 */
export async function createTicket(input: CreateTicketInput) {
  return await prisma.ticket.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      stage: 'IDLE',
    },
  });
}