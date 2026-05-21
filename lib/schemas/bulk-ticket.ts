import { z } from 'zod';

/**
 * Shared reference to a ticket with its optimistic-concurrency version,
 * used by every bulk ticket operation request payload.
 */
export const ticketRefSchema = z.object({
  id: z.number().int().positive(),
  version: z.number().int().positive(),
});

export type TicketRef = z.infer<typeof ticketRefSchema>;

/**
 * 1..50 ticket refs per bulk request (FR-004 cap, mirrored client-side).
 */
export const ticketsArraySchema = z.array(ticketRefSchema).min(1).max(50);

export const bulkDeleteSchema = z.object({
  tickets: ticketsArraySchema,
});

export type BulkDeleteRequest = z.infer<typeof bulkDeleteSchema>;
