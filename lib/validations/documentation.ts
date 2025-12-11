/**
 * Validation Schemas for Documentation Viewing Feature
 *
 * Zod schemas for validating API requests, responses, and component props
 * for the documentation (spec, plan, tasks) viewing feature.
 */

import { z } from 'zod';

/**
 * Supported documentation types
 */
export const DocumentTypeSchema = z.enum(['spec', 'plan', 'tasks', 'summary']);

/**
 * Infer TypeScript type from schema
 */
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

/**
 * Project ID validation schema
 * Must be a string containing digits only (Next.js route params are strings)
 */
export const ProjectIdSchema = z.string().regex(/^\d+$/, 'Invalid project ID');

/**
 * Ticket ID validation schema
 * Must be a string containing digits only (Next.js route params are strings)
 */
export const TicketIdSchema = z.string().regex(/^\d+$/, 'Invalid ticket ID');

/**
 * Error codes for documentation API
 */
export enum DocumentErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  TICKET_NOT_FOUND = 'TICKET_NOT_FOUND',
  WRONG_PROJECT = 'WRONG_PROJECT',
  BRANCH_NOT_ASSIGNED = 'BRANCH_NOT_ASSIGNED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  NOT_AVAILABLE_YET = 'NOT_AVAILABLE_YET',
  NOT_MERGED = 'NOT_MERGED',
  RATE_LIMIT = 'RATE_LIMIT',
  GITHUB_API_ERROR = 'GITHUB_API_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Schema for DocumentContent API response
 */
export const DocumentContentSchema = z.object({
  content: z.string().min(1).max(1048576), // Max 1MB
  metadata: z.object({
    ticketId: z.number().int().positive(),
    branch: z.string().min(1).max(200),
    projectId: z.number().int().positive(),
    docType: DocumentTypeSchema,
    fileName: z.string().regex(/^(spec|plan|tasks|summary)\.md$/),
    filePath: z.string().regex(/^specs\/[^/]+\/(spec|plan|tasks|summary)\.md$/),
    fetchedAt: z.string().datetime(),
  }),
});

/**
 * Schema for DocumentError API response
 */
export const DocumentErrorSchema = z.object({
  error: z.string(),
  code: z.nativeEnum(DocumentErrorCode),
  message: z.string().optional(),
});

/**
 * Infer types from schemas
 */
export type DocumentContent = z.infer<typeof DocumentContentSchema>;
export type DocumentError = z.infer<typeof DocumentErrorSchema>;
