/**
 * Log Capture API Contract
 * 
 * Defines the interface for capturing agent execution logs
 * Called by GitHub Actions workflows upon job completion
 */

import { z } from 'zod';
import type { Agent } from '@prisma/client';

/**
 * Log Capture Request Schema
 * 
 * Validates incoming log capture requests from workflows
 */
export const logCaptureRequestSchema = z.object({
  jobId: z.number().int().positive(),
  agentType: z.nativeEnum(Agent),
  logContent: z.string().min(1).max(10 * 1024 * 1024), // Max 10MB
  logFormat: z.union([
    z.literal('text'),
    z.literal('json'),
  ]),
  // Optional metadata
  workflowRunId: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

/**
 * Log Capture Response Schema
 * 
 * Standardized response format for log capture operations
 */
export const logCaptureResponseSchema = z.object({
  success: z.boolean(),
  jobLogId: z.number().int().positive(),
  storageLocation: z.string(),
  previewContent: z.string().max(2000),
  contentSize: z.number().int().positive(),
  expirationDate: z.string().datetime(),
  createdAt: z.string().datetime(),
});

/**
 * Log Entry Schema
 * 
 * Individual log entry structure for normalized logs
 */
export const logEntrySchema = z.object({
  sequenceNumber: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
  messageType: z.union([
    z.literal('INFO'),
    z.literal('ERROR'),
    z.literal('WARNING'),
    z.literal('TOOL'),
  ]),
  content: z.string().min(1),
  toolName: z.string().max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Normalized Log Schema
 * 
 * Standard format for stored logs (JSON structure in S3)
 */
export const normalizedLogSchema = z.object({
  jobId: z.number().int().positive(),
  agentType: z.nativeEnum(Agent),
  status: z.union([
    z.literal('COMPLETED'),
    z.literal('FAILED'),
    z.literal('CANCELLED'),
  ]),
  timestamp: z.string().datetime(),
  entries: z.array(logEntrySchema),
  summary: z.object({
    totalEntries: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative(),
    toolCount: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative().optional(),
  }),
});

/**
 * Log Capture Error Responses
 * 
 * Standardized error formats for API consumers
 */
export const logCaptureErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

/**
 * Type Inferences
 * 
 * TypeScript types derived from Zod schemas
 */
export type LogCaptureRequest = z.infer<typeof logCaptureRequestSchema>;
export type LogCaptureResponse = z.infer<typeof logCaptureResponseSchema>;
export type LogEntry = z.infer<typeof logEntrySchema>;
export type NormalizedLog = z.infer<typeof normalizedLogSchema>;
export type LogCaptureError = z.infer<typeof logCaptureErrorSchema>;

/**
 * API Endpoint Contract
 * 
 * POST /api/jobs/{jobId}/logs
 * 
 * Request:
 * {
 *   "jobId": 123,
 *   "agentType": "CLAUDE",
 *   "logContent": "[raw log content]",
 *   "logFormat": "text" | "json"
 * }
 * 
 * Success Response (201):
 * {
 *   "success": true,
 *   "jobLogId": 456,
 *   "storageLocation": "s3://bucket/logs/123/20240423143022.json",
 *   "previewContent": "[first 2000 chars]",
 *   "contentSize": 12345,
 *   "expirationDate": "2024-05-23T14:30:22.000Z",
 *   "createdAt": "2024-04-23T14:30:22.000Z"
 * }
 * 
 * Error Responses:
 * - 400: Invalid request (validation error)
 * - 401: Unauthorized (invalid workflow auth)
 * - 404: Job not found
 * - 409: Log already exists
 * - 500: Internal server error
 */

export const LOG_CAPTURE_API_CONTRACT = {
  endpoint: 'POST /api/jobs/{jobId}/logs',
  requestSchema: logCaptureRequestSchema,
  responseSchema: logCaptureResponseSchema,
  errorSchema: logCaptureErrorSchema,
  rateLimit: '10 requests per minute per job',
  timeout: '30 seconds',
} as const;
