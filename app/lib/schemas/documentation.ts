import { z } from 'zod';

/**
 * Zod schema for editing documentation files
 * Validates POST /api/projects/:projectId/docs request body
 */
export const editDocumentationSchema = z.object({
  ticketId: z.number().int().positive('Ticket ID must be a positive integer'),
  docType: z.enum(['spec', 'plan', 'tasks']),
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

/**
 * Query parameters schema for GET /api/projects/:projectId/docs/history
 */
export const getDocumentationHistorySchema = z.object({
  ticketId: z.coerce.number().int().positive('Ticket ID must be a positive integer'),
  docType: z.enum(['spec', 'plan', 'tasks']),
});

export type GetDocumentationHistoryRequest = z.infer<typeof getDocumentationHistorySchema>;

/**
 * Response schema for GET /api/projects/:projectId/docs/history
 */
export const documentationHistoryResponseSchema = z.object({
  commits: z.array(
    z.object({
      sha: z.string().length(40),
      author: z.object({
        name: z.string(),
        email: z.string().email(),
        date: z.string().datetime(),
      }),
      message: z.string(),
      url: z.string().url(),
    })
  ),
});

export type DocumentationHistoryResponse = z.infer<typeof documentationHistoryResponseSchema>;

/**
 * Query parameters schema for GET /api/projects/:projectId/docs/diff
 */
export const getDocumentationDiffSchema = z.object({
  ticketId: z.coerce.number().int().positive('Ticket ID must be a positive integer'),
  docType: z.enum(['spec', 'plan', 'tasks']),
  sha: z.string().regex(/^[a-f0-9]{40}$/, 'SHA must be 40 character hexadecimal string'),
});

export type GetDocumentationDiffRequest = z.infer<typeof getDocumentationDiffSchema>;

/**
 * Response schema for GET /api/projects/:projectId/docs/diff
 */
export const documentationDiffResponseSchema = z.object({
  sha: z.string().length(40),
  files: z.array(
    z.object({
      filename: z.string(),
      status: z.enum(['added', 'modified', 'removed']),
      additions: z.number().int().nonnegative(),
      deletions: z.number().int().nonnegative(),
      patch: z.string().optional(),
    })
  ),
});

export type DocumentationDiffResponse = z.infer<typeof documentationDiffResponseSchema>;
