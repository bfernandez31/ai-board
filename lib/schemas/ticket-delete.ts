import { z } from 'zod';

/**
 * Zod schema for DELETE /api/projects/:projectId/tickets/:id params
 * Validates path parameters and transforms string params to integers
 */
export const deleteTicketParamsSchema = z.object({
  projectId: z.string().transform(Number).pipe(z.number().int().positive()),
  id: z.string().transform(Number).pipe(z.number().int().positive()),
});

/**
 * TypeScript type for delete params (after validation)
 */
export type DeleteTicketParams = z.infer<typeof deleteTicketParamsSchema>;

/**
 * Success response schema for DELETE endpoint
 */
export const deleteTicketSuccessResponseSchema = z.object({
  success: z.literal(true),
  deleted: z.object({
    ticketId: z.number().int(),
    ticketKey: z.string(),
    branch: z.string().nullable(),
    prsClosed: z.number().int().nonnegative(),
  }),
});

/**
 * TypeScript type for success response
 */
export type DeleteTicketSuccessResponse = z.infer<typeof deleteTicketSuccessResponseSchema>;
