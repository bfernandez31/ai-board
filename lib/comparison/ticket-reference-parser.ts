/**
 * Ticket Reference Parser
 *
 * Parses ticket key references from comment text for the comparison feature.
 * Follows the same pattern as app/lib/utils/mention-parser.ts
 */

import type { TicketReference } from '@/lib/types/comparison';

/**
 * Regex pattern for parsing ticket key references: #TICKET-KEY
 * - Matches: #ABC-123, #AIB-456, #PRJ-1
 * - Format: 3-6 uppercase alphanumeric characters, hyphen, 1+ digits
 * - Global flag for multiple matches
 *
 * @example
 * "#AIB-123 and #PRJ-456" matches ["AIB-123", "PRJ-456"]
 */
export const TICKET_REF_REGEX = /#([A-Z0-9]{3,6}-\d+)/g;

/**
 * Parse ticket key references from content
 *
 * @param content - Text content potentially containing ticket references
 * @returns Array of parsed ticket reference objects with position information
 *
 * @example
 * parseTicketReferences("Compare #AIB-123 with #AIB-456")
 * // Returns:
 * // [
 * //   { ticketKey: 'AIB-123', startIndex: 8, endIndex: 16 },
 * //   { ticketKey: 'AIB-456', startIndex: 22, endIndex: 30 }
 * // ]
 */
export function parseTicketReferences(content: string): TicketReference[] {
  const refs: TicketReference[] = [];

  // Reset regex lastIndex to ensure consistent parsing (critical for global regex)
  TICKET_REF_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;

  while ((match = TICKET_REF_REGEX.exec(content)) !== null) {
    // TypeScript strict mode: ensure capture group exists
    const ticketKey = match[1];

    if (!ticketKey) continue;

    refs.push({
      ticketKey,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return refs;
}

/**
 * Extract unique ticket keys from content
 *
 * @param content - Text content potentially containing ticket references
 * @returns Array of unique ticket keys (deduplicated)
 *
 * @example
 * extractTicketKeys("Check #AIB-123 and #AIB-123 plus #AIB-456")
 * // Returns: ['AIB-123', 'AIB-456']
 */
export function extractTicketKeys(content: string): string[] {
  const refs = parseTicketReferences(content);
  const uniqueKeys = Array.from(new Set(refs.map((r) => r.ticketKey)));
  return uniqueKeys;
}

/**
 * Validate ticket key format
 *
 * @param ticketKey - Single ticket key to validate
 * @returns true if the ticket key matches expected format
 *
 * @example
 * validateTicketKeyFormat("AIB-123") // true
 * validateTicketKeyFormat("abc-123") // false (lowercase)
 * validateTicketKeyFormat("TOOLONG-123") // false (>6 chars)
 * validateTicketKeyFormat("AB-123") // false (<3 chars)
 */
export function validateTicketKeyFormat(ticketKey: string): boolean {
  const SINGLE_TICKET_KEY_REGEX = /^[A-Z0-9]{3,6}-\d+$/;
  return SINGLE_TICKET_KEY_REGEX.test(ticketKey);
}

/**
 * Format a ticket key as a reference
 *
 * @param ticketKey - Ticket key to format
 * @returns Formatted ticket reference string with # prefix
 *
 * @example
 * formatTicketReference("AIB-123")
 * // Returns: '#AIB-123'
 */
export function formatTicketReference(ticketKey: string): string {
  return `#${ticketKey}`;
}

/**
 * Check if content contains any ticket references
 *
 * @param content - Text content to check
 * @returns true if at least one ticket reference is found
 */
export function hasTicketReferences(content: string): boolean {
  TICKET_REF_REGEX.lastIndex = 0;
  return TICKET_REF_REGEX.test(content);
}

/**
 * Count ticket references in content
 *
 * @param content - Text content to count references in
 * @returns Number of unique ticket references
 */
export function countTicketReferences(content: string): number {
  return extractTicketKeys(content).length;
}

/**
 * Validation result for ticket reference limits
 */
export interface TicketLimitValidation {
  /** Whether the count is valid (1-5) */
  valid: boolean;
  /** Number of unique references found */
  count: number;
  /** Error message if invalid */
  error?: string;
}

/**
 * Validate ticket reference count is within limits (1-5)
 *
 * @param content - Text content to validate
 * @param excludeKey - Optional ticket key to exclude (source ticket)
 * @returns Validation result with count and error message
 *
 * @example
 * validateTicketReferenceLimit("Compare #AIB-123 #AIB-456", "AIB-123")
 * // Returns: { valid: true, count: 1 } (AIB-123 excluded)
 */
export function validateTicketReferenceLimit(
  content: string,
  excludeKey?: string
): TicketLimitValidation {
  let keys = extractTicketKeys(content);

  // Exclude source ticket if provided
  if (excludeKey) {
    keys = keys.filter((k) => k !== excludeKey);
  }

  const count = keys.length;

  if (count < 1) {
    return {
      valid: false,
      count,
      error: 'Must reference at least 1 ticket to compare',
    };
  }

  if (count > 5) {
    return {
      valid: false,
      count,
      error: `Cannot compare more than 5 tickets (found ${count})`,
    };
  }

  return { valid: true, count };
}

/**
 * Parse ticket references and validate against project constraint
 *
 * @param content - Text content with ticket references
 * @param sourceProjectKey - Project key of the source ticket (e.g., "AIB")
 * @returns Object with valid refs and any cross-project refs
 */
export function parseAndValidateProjectScope(
  content: string,
  sourceProjectKey: string
): {
  validRefs: TicketReference[];
  crossProjectRefs: TicketReference[];
} {
  const allRefs = parseTicketReferences(content);

  const validRefs: TicketReference[] = [];
  const crossProjectRefs: TicketReference[] = [];

  for (const ref of allRefs) {
    // Extract project key from ticket key (e.g., "AIB" from "AIB-123")
    const projectKey = ref.ticketKey.split('-')[0];

    if (projectKey === sourceProjectKey) {
      validRefs.push(ref);
    } else {
      crossProjectRefs.push(ref);
    }
  }

  return { validRefs, crossProjectRefs };
}

/**
 * Error result for cross-project ticket reference validation
 */
export interface CrossProjectValidationResult {
  /** Whether all references are from the same project */
  valid: boolean;
  /** Project key that all tickets should belong to */
  expectedProject: string;
  /** Valid ticket keys from the same project */
  validTicketKeys: string[];
  /** Invalid cross-project references */
  crossProjectKeys: string[];
  /** User-friendly error message if invalid */
  error?: string;
}

/**
 * Validate that all ticket references belong to the same project
 *
 * @param content - Text content with ticket references
 * @param sourceProjectKey - Project key that all tickets must belong to
 * @returns Validation result with error handling for cross-project references
 *
 * @example
 * validateCrossProjectReferences("Compare #AIB-123 #AIB-456", "AIB")
 * // Returns: { valid: true, validTicketKeys: ['AIB-123', 'AIB-456'], ... }
 *
 * validateCrossProjectReferences("Compare #AIB-123 #OTHER-456", "AIB")
 * // Returns: { valid: false, error: "Cross-project comparison not supported...", ... }
 */
export function validateCrossProjectReferences(
  content: string,
  sourceProjectKey: string
): CrossProjectValidationResult {
  const { validRefs, crossProjectRefs } = parseAndValidateProjectScope(
    content,
    sourceProjectKey
  );

  const validTicketKeys = validRefs.map((r) => r.ticketKey);
  const crossProjectKeys = crossProjectRefs.map((r) => r.ticketKey);

  if (crossProjectRefs.length > 0) {
    // Get unique cross-project keys for error message
    const uniqueCrossProjects = [
      ...new Set(crossProjectKeys.map((k) => k.split('-')[0])),
    ];

    return {
      valid: false,
      expectedProject: sourceProjectKey,
      validTicketKeys,
      crossProjectKeys,
      error: `Cross-project comparison not supported. Ticket${crossProjectKeys.length > 1 ? 's' : ''} ${crossProjectKeys.join(', ')} belong${crossProjectKeys.length === 1 ? 's' : ''} to project${uniqueCrossProjects.length > 1 ? 's' : ''} ${uniqueCrossProjects.join(', ')}, but comparison is for project ${sourceProjectKey}.`,
    };
  }

  return {
    valid: true,
    expectedProject: sourceProjectKey,
    validTicketKeys,
    crossProjectKeys: [],
  };
}

/**
 * Extract project key from a ticket key
 *
 * @param ticketKey - Ticket key (e.g., "AIB-123")
 * @returns Project key portion (e.g., "AIB")
 */
export function extractProjectKey(ticketKey: string): string {
  return ticketKey.split('-')[0] ?? '';
}

/**
 * Validate all tickets are from the same project (no source project required)
 *
 * @param ticketKeys - Array of ticket keys to validate
 * @returns Validation result
 */
export function validateSameProjectTickets(ticketKeys: string[]): {
  valid: boolean;
  projectKey?: string;
  error?: string;
} {
  if (ticketKeys.length === 0) {
    return { valid: false, error: 'No ticket keys provided' };
  }

  const projectKeys = ticketKeys.map(extractProjectKey);
  const uniqueProjects = [...new Set(projectKeys)];

  if (uniqueProjects.length > 1) {
    return {
      valid: false,
      error: `Cross-project comparison not supported. Found tickets from multiple projects: ${uniqueProjects.join(', ')}`,
    };
  }

  const projectKey = uniqueProjects[0];
  if (!projectKey) {
    return { valid: false, error: 'Could not determine project key' };
  }

  return {
    valid: true,
    projectKey,
  };
}
