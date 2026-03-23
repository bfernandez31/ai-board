import type { TicketReference } from '@/lib/types/comparison';

/** Matches #ABC-123 style ticket references (3-6 uppercase chars + hyphen + digits) */
export const TICKET_REF_REGEX = /#([A-Z0-9]{3,6}-\d+)/g;

export function parseTicketReferences(content: string): TicketReference[] {
  const refs: TicketReference[] = [];
  TICKET_REF_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;

  while ((match = TICKET_REF_REGEX.exec(content)) !== null) {
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

export function extractTicketKeys(content: string): string[] {
  const refs = parseTicketReferences(content);
  return Array.from(new Set(refs.map((r) => r.ticketKey)));
}

export function validateTicketKeyFormat(ticketKey: string): boolean {
  const SINGLE_TICKET_KEY_REGEX = /^[A-Z0-9]{3,6}-\d+$/;
  return SINGLE_TICKET_KEY_REGEX.test(ticketKey);
}

export function formatTicketReference(ticketKey: string): string {
  return `#${ticketKey}`;
}

export function hasTicketReferences(content: string): boolean {
  TICKET_REF_REGEX.lastIndex = 0;
  return TICKET_REF_REGEX.test(content);
}

export function countTicketReferences(content: string): number {
  return extractTicketKeys(content).length;
}

export interface TicketLimitValidation {
  valid: boolean;
  count: number;
  error?: string;
}

/** Validate ticket reference count is within limits (1-5) */
export function validateTicketReferenceLimit(
  content: string,
  excludeKey?: string
): TicketLimitValidation {
  let keys = extractTicketKeys(content);

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

/** Parse refs and split by project scope */
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
    const projectKey = ref.ticketKey.split('-')[0];

    if (projectKey === sourceProjectKey) {
      validRefs.push(ref);
    } else {
      crossProjectRefs.push(ref);
    }
  }

  return { validRefs, crossProjectRefs };
}

export function extractProjectKey(ticketKey: string): string {
  return ticketKey.split('-')[0] ?? '';
}

