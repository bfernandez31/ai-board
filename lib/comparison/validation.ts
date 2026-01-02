/**
 * Comparison Validation
 *
 * Zod schemas for validating comparison inputs including
 * ticket limits (1-5), ticket key formats, and comparison requests.
 */

import { z } from 'zod';

/**
 * Valid ticket key format: PROJECT-NUMBER (e.g., AIB-123, PROJ-1)
 */
export const ticketKeySchema = z
  .string()
  .regex(
    /^[A-Z0-9]{2,10}-\d+$/,
    'Ticket key must be in format PROJECT-NUMBER (e.g., AIB-123)'
  );

/**
 * Ticket reference with optional hash prefix
 */
export const ticketReferenceSchema = z
  .string()
  .regex(
    /^#?[A-Z0-9]{2,10}-\d+$/,
    'Ticket reference must be in format #PROJECT-NUMBER or PROJECT-NUMBER'
  )
  .transform((val) => val.replace(/^#/, ''));

/**
 * Array of ticket keys with limit enforcement (1-5 tickets)
 */
export const ticketKeysSchema = z
  .array(ticketKeySchema)
  .min(1, 'At least one ticket key is required')
  .max(5, 'Maximum of 5 tickets can be compared at once');

/**
 * Comparison request validation
 */
export const comparisonRequestSchema = z.object({
  sourceTicketKey: ticketKeySchema,
  targetTicketKeys: z
    .array(ticketKeySchema)
    .min(1, 'At least one target ticket is required')
    .max(4, 'Maximum of 4 target tickets (5 total including source)'),
});

/**
 * Comparison query parameters
 */
export const comparisonQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

/**
 * Single comparison check request
 */
export const comparisonCheckSchema = z.object({
  ticketKeys: ticketKeysSchema,
});

/**
 * Report filename validation
 * Format: YYYYMMDD-HHMMSS-vs-KEY1-KEY2.md
 */
export const reportFilenameSchema = z
  .string()
  .regex(
    /^\d{8}-\d{6}-vs-[A-Z0-9-]+\.md$/,
    'Invalid report filename format'
  );

/**
 * Type exports for schema inference
 */
export type TicketKey = z.infer<typeof ticketKeySchema>;
export type TicketReference = z.infer<typeof ticketReferenceSchema>;
export type TicketKeys = z.infer<typeof ticketKeysSchema>;
export type ComparisonRequest = z.infer<typeof comparisonRequestSchema>;
export type ComparisonQuery = z.infer<typeof comparisonQuerySchema>;
export type ComparisonCheck = z.infer<typeof comparisonCheckSchema>;
export type ReportFilename = z.infer<typeof reportFilenameSchema>;

/**
 * Validate ticket keys from command input
 *
 * @param input - Raw input string containing ticket references
 * @returns Validation result with parsed ticket keys or error
 */
export function validateTicketInput(input: string): {
  success: boolean;
  ticketKeys?: string[];
  error?: string;
} {
  // Extract ticket references from input
  const ticketPattern = /#?([A-Z0-9]{2,10}-\d+)/g;
  const matches = [...input.matchAll(ticketPattern)];

  if (matches.length === 0) {
    return {
      success: false,
      error: 'No valid ticket references found in input',
    };
  }

  const ticketKeys = matches.map((m) => m[1]!);
  const uniqueKeys = [...new Set(ticketKeys)];

  // Validate count
  if (uniqueKeys.length > 5) {
    return {
      success: false,
      error: `Too many tickets: ${uniqueKeys.length}. Maximum is 5.`,
    };
  }

  return {
    success: true,
    ticketKeys: uniqueKeys,
  };
}

/**
 * Validate comparison request with detailed errors
 *
 * @param source - Source ticket key
 * @param targets - Target ticket keys
 * @returns Validation result
 */
export function validateComparisonRequest(
  source: string,
  targets: string[]
): {
  success: boolean;
  data?: ComparisonRequest;
  errors?: string[];
} {
  const result = comparisonRequestSchema.safeParse({
    sourceTicketKey: source,
    targetTicketKeys: targets,
  });

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((e: { message: string }) => e.message),
    };
  }

  // Check for duplicates
  const allKeys = [source, ...targets];
  const uniqueKeys = new Set(allKeys);
  if (uniqueKeys.size !== allKeys.length) {
    return {
      success: false,
      errors: ['Duplicate ticket keys are not allowed'],
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Check if ticket keys are from same project
 *
 * @param ticketKeys - Array of ticket keys
 * @returns Object with isValid and projectKey
 */
export function validateSameProject(ticketKeys: string[]): {
  isValid: boolean;
  projectKey?: string;
  error?: string;
} {
  if (ticketKeys.length === 0) {
    return { isValid: false, error: 'No ticket keys provided' };
  }

  const projectKeys = ticketKeys.map((key) => key.split('-')[0]);
  const uniqueProjects = new Set(projectKeys);

  if (uniqueProjects.size > 1) {
    return {
      isValid: false,
      error: `Cross-project comparison not supported. Found projects: ${[...uniqueProjects].join(', ')}`,
    };
  }

  const projectKey = projectKeys[0];
  if (!projectKey) {
    return { isValid: false, error: 'Could not determine project key' };
  }

  return {
    isValid: true,
    projectKey,
  };
}
