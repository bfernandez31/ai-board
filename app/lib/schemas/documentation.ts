import { z } from 'zod';

/**
 * Zod schema for editing documentation files
 * Validates POST /api/projects/:projectId/docs request body
 */
export const editDocumentationSchema = z.object({
  ticketId: z.number().int().positive('Ticket ID must be a positive integer'),
  docType: z.enum(['spec', 'plan', 'tasks'], {
    errorMap: () => ({ message: 'Document type must be spec, plan, or tasks' }),
  }),
  content: z
    .string()
    .min(1, 'Document content cannot be empty')
    .max(1048576, 'Document content exceeds 1MB limit'),
  commitMessage: z.string().max(500, 'Commit message must be 500 characters or less').optional(),
});

/**
 * TypeScript type inferred from Zod schema
 */
export type EditDocumentationRequest = z.infer<typeof editDocumentationSchema>;

/**
 * Response schema for successful documentation edit
 */
export const editDocumentationResponseSchema = z.object({
  success: z.literal(true),
  commitSha: z.string(),
  updatedAt: z.string(),
  message: z.string(),
});

export type EditDocumentationResponse = z.infer<typeof editDocumentationResponseSchema>;

/**
 * Error response schema
 */
export const editDocumentationErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.enum([
    'PERMISSION_DENIED',
    'BRANCH_NOT_FOUND',
    'VALIDATION_ERROR',
    'MERGE_CONFLICT',
    'NETWORK_ERROR',
    'TIMEOUT',
  ]).optional(),
  details: z.unknown().optional(),
});

export type EditDocumentationError = z.infer<typeof editDocumentationErrorSchema>;
