/**
 * Log Retrieval API Contract
 * 
 * Defines the interface for retrieving agent execution logs
 * Called by frontend components to display logs to users
 */

import { z } from 'zod';
import type { Agent } from '@prisma/client';

/**
 * Log Retrieval Request Schema
 * 
 * Validates incoming log retrieval requests
 */
export const logRetrievalRequestSchema = z.object({
  // Query parameters
  jobId: z.number().int().positive(),
  // Optional filtering
  messageType: z.union([
    z.literal('INFO'),
    z.literal('ERROR'),
    z.literal('WARNING'),
    z.literal('TOOL'),
    z.literal('ALL'),
  ]).default('ALL'),
  // Pagination (for large logs)
  page: z.number().int().nonnegative().default(1),
  pageSize: z.number().int().positive().max(1000).default(100),
});

/**
 * Log Retrieval Response Schema
 * 
 * Standardized response format for log retrieval operations
 */
export const logRetrievalResponseSchema = z.object({
  jobId: z.number().int().positive(),
  agentType: z.nativeEnum(Agent),
  status: z.string(),
  timestamp: z.string().datetime(),
  preview: z.string().max(2000),
  fullLogUrl: z.string().url(), // Presigned S3 URL (expires in 15 minutes)
  logEntries: z.array(z.object({
    sequenceNumber: z.number().int().nonnegative(),
    timestamp: z.string().datetime(),
    messageType: z.string(),
    content: z.string(),
    toolName: z.string().optional(),
  })),
  summary: z.object({
    totalEntries: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative(),
    toolCount: z.number().int().nonnegative(),
    contentSize: z.number().int().positive(),
  }),
  contentSize: z.number().int().positive(),
  expirationDate: z.string().datetime(),
  createdAt: z.string().datetime(),
  // Pagination info
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().positive(),
  hasMore: z.boolean(),
});

/**
 * Log Retrieval Error Responses
 * 
 * Standardized error formats for API consumers
 */
export const logRetrievalErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

/**
 * Type Inferences
 * 
 * TypeScript types derived from Zod schemas
 */
export type LogRetrievalRequest = z.infer<typeof logRetrievalRequestSchema>;
export type LogRetrievalResponse = z.infer<typeof logRetrievalResponseSchema>;
export type LogRetrievalError = z.infer<typeof logRetrievalErrorSchema>;

/**
 * API Endpoint Contract
 * 
 * GET /api/jobs/{jobId}/logs
 * 
 * Request:
 * GET /api/jobs/123/logs?messageType=ERROR&page=1&pageSize=50
 * 
 * Success Response (200):
 * {
 *   "jobId": 123,
 *   "agentType": "CLAUDE",
 *   "status": "COMPLETED",
 *   "timestamp": "2024-04-23T14:30:22.000Z",
 *   "preview": "[first 2000 chars]",
 *   "fullLogUrl": "https://s3.amazonaws.com/...?AWSAccessKeyId=...",
 *   "logEntries": [
 *     {
 *       "sequenceNumber": 0,
 *       "timestamp": "2024-04-23T14:30:22.000Z",
 *       "messageType": "INFO",
 *       "content": "Starting execution...",
 *       "toolName": null
 *     }
 *   ],
 *   "summary": {
 *     "totalEntries": 42,
 *     "errorCount": 2,
 *     "warningCount": 1,
 *     "toolCount": 5,
 *     "contentSize": 12345
 *   },
 *   "contentSize": 12345,
 *   "expirationDate": "2024-05-23T14:30:22.000Z",
 *   "createdAt": "2024-04-23T14:30:22.000Z",
 *   "page": 1,
 *   "pageSize": 50,
 *   "totalPages": 1,
 *   "hasMore": false
 * }
 * 
 * Error Responses:
 * - 400: Invalid request parameters
 * - 401: Unauthorized (user access denied)
 * - 403: Forbidden (no permission to view job)
 * - 404: Job or log not found
 * - 500: Internal server error
 */

export const LOG_RETRIEVAL_API_CONTRACT = {
  endpoint: 'GET /api/jobs/{jobId}/logs',
  requestSchema: logRetrievalRequestSchema,
  responseSchema: logRetrievalResponseSchema,
  errorSchema: logRetrievalErrorSchema,
  cacheControl: 'max-age=300, stale-while-revalidate=60', // 5 minute cache
  rateLimit: '30 requests per minute per user',
  timeout: '10 seconds',
} as const;

/**
 * Log Preview Response Schema
 * 
 * Lightweight response for inline preview display
 */
export const logPreviewResponseSchema = z.object({
  jobId: z.number().int().positive(),
  preview: z.string().max(2000),
  hasFullLog: z.boolean(),
  errorCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
});

/**
 * API Endpoint Contract for Preview
 * 
 * GET /api/jobs/{jobId}/logs/preview
 * 
 * Lightweight endpoint for job timeline inline preview
 */

export const LOG_PREVIEW_API_CONTRACT = {
  endpoint: 'GET /api/jobs/{jobId}/logs/preview',
  responseSchema: logPreviewResponseSchema,
  cacheControl: 'max-age=60, stale-while-revalidate=30', // 1 minute cache
  rateLimit: '60 requests per minute per user',
  timeout: '5 seconds',
} as const;
