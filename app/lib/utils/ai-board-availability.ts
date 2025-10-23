import { prisma } from '@/lib/db/client';
import { Stage } from '@prisma/client';

/**
 * Valid stages for AI-BOARD mentions
 * AI-BOARD can only be mentioned in these stages
 */
const VALID_AI_BOARD_STAGES: Stage[] = ['SPECIFY', 'PLAN', 'BUILD', 'VERIFY'];

/**
 * Availability check result
 */
export interface AIBoardAvailability {
  /** Whether AI-BOARD can be mentioned */
  available: boolean;
  /** Reason for unavailability (if available is false) */
  reason?: string;
}

/**
 * Check if AI-BOARD is available for the given ticket
 *
 * AI-BOARD is available if:
 * 1. Ticket stage is in SPECIFY, PLAN, BUILD, or VERIFY
 * 2. No job with status PENDING or RUNNING exists for the ticket
 *
 * @param ticketId Ticket ID to check
 * @returns Availability status with optional reason
 *
 * @example
 * const { available, reason } = await checkAIBoardAvailability(123);
 * if (!available) {
 *   console.log('AI-BOARD unavailable:', reason);
 * }
 */
export async function checkAIBoardAvailability(
  ticketId: number
): Promise<AIBoardAvailability> {
  // Fetch ticket with current stage
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { stage: true },
  });

  if (!ticket) {
    return {
      available: false,
      reason: 'Ticket not found',
    };
  }

  // Check if stage is valid for AI-BOARD mentions
  if (!VALID_AI_BOARD_STAGES.includes(ticket.stage)) {
    return {
      available: false,
      reason: `AI-BOARD not available in ${ticket.stage} stage`,
    };
  }

  // Check for running jobs
  const runningJob = await prisma.job.findFirst({
    where: {
      ticketId,
      status: { in: ['PENDING', 'RUNNING'] },
    },
    select: { id: true, status: true },
  });

  if (runningJob) {
    return {
      available: false,
      reason: `AI-BOARD is already processing this ticket (Job ${runningJob.id}: ${runningJob.status})`,
    };
  }

  // AI-BOARD is available
  return {
    available: true,
  };
}
