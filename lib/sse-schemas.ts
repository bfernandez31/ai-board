import { z } from 'zod'

/**
 * SSE Message Schemas
 *
 * Server-Sent Events only flow server → client, so we only need
 * to validate incoming messages on the client side.
 */

/**
 * Job Status Update Message Schema
 *
 * This is the only message type sent via SSE.
 * Simpler than WebSocket which required multiple message types.
 */
export const JobStatusUpdateSchema = z.object({
  projectId: z.number().int().positive(),
  ticketId: z.number().int().positive(),
  jobId: z.number().int().positive(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  command: z.string().max(50),
  timestamp: z.string().datetime(),
})

/**
 * TypeScript Type Inferred from Zod Schema
 */
export type JobStatusUpdate = z.infer<typeof JobStatusUpdateSchema>

/**
 * Validate Job Status Update Message
 *
 * Helper function to safely parse SSE messages.
 * Returns parsed data or null if invalid.
 */
export function parseJobStatusUpdate(data: unknown): JobStatusUpdate | null {
  const result = JobStatusUpdateSchema.safeParse(data)

  if (!result.success) {
    console.error('[SSE] Invalid job status update:', result.error)
    return null
  }

  return result.data
}
