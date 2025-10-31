/**
 * Ticket number sequence generation using PostgreSQL function
 * Thread-safe ticket numbering per project
 */

import { prisma } from '@/lib/db/client';

/**
 * Get the next ticket number for a project using PostgreSQL sequence
 *
 * This function calls the database function get_next_ticket_number which:
 * 1. Creates a project-specific sequence if it doesn't exist
 * 2. Returns the next sequential number for that project
 *
 * Thread-safe: PostgreSQL sequences use atomic operations
 *
 * @param projectId - The project ID to generate a ticket number for
 * @returns The next sequential ticket number for the project
 * @throws Error if sequence generation fails
 */
export async function getNextTicketNumber(projectId: number): Promise<number> {
  try {
    const result = await prisma.$queryRaw<{ get_next_ticket_number: number }[]>`
      SELECT get_next_ticket_number(${projectId}) as get_next_ticket_number
    `;

    if (!result || result.length === 0) {
      throw new Error('Failed to generate ticket number: empty result');
    }

    return result[0].get_next_ticket_number;
  } catch (error) {
    console.error('Error generating ticket number:', error);
    throw new Error('Failed to generate ticket number');
  }
}
