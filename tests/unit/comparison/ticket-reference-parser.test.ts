/**
 * Unit Tests: Ticket Reference Parser
 *
 * Tests the ticket reference parsing functionality for the comparison feature.
 */

import { describe, it, expect } from 'vitest';
import {
  parseTicketReferences,
  extractTicketKeys,
  validateTicketKeyFormat,
  formatTicketReference,
  hasTicketReferences,
  countTicketReferences,
  validateTicketReferenceLimit,
  parseAndValidateProjectScope,
  TICKET_REF_REGEX,
} from '@/lib/comparison/ticket-reference-parser';

describe('TICKET_REF_REGEX', () => {
  it('should match valid ticket key format', () => {
    const testCases = ['#AIB-123', '#PRJ-1', '#ABC-456', '#XYZ-9999'];

    testCases.forEach((testCase) => {
      TICKET_REF_REGEX.lastIndex = 0;
      expect(TICKET_REF_REGEX.test(testCase)).toBe(true);
    });
  });

  it('should match 3-6 character project keys', () => {
    const validKeys = ['#ABC-1', '#ABCD-1', '#ABCDE-1', '#ABCDEF-1'];

    validKeys.forEach((key) => {
      TICKET_REF_REGEX.lastIndex = 0;
      expect(TICKET_REF_REGEX.test(key)).toBe(true);
    });
  });

  it('should not match keys shorter than 3 chars', () => {
    TICKET_REF_REGEX.lastIndex = 0;
    expect(TICKET_REF_REGEX.test('#AB-123')).toBe(false);
  });

  it('should not match keys longer than 6 chars', () => {
    TICKET_REF_REGEX.lastIndex = 0;
    expect(TICKET_REF_REGEX.test('#ABCDEFG-123')).toBe(false);
  });

  it('should not match lowercase keys', () => {
    TICKET_REF_REGEX.lastIndex = 0;
    expect(TICKET_REF_REGEX.test('#abc-123')).toBe(false);
  });

  it('should not match keys without hash prefix', () => {
    TICKET_REF_REGEX.lastIndex = 0;
    expect(TICKET_REF_REGEX.test('AIB-123')).toBe(false);
  });
});

describe('parseTicketReferences', () => {
  it('should parse a single ticket reference', () => {
    const refs = parseTicketReferences('Check out #AIB-123 for more info');
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      ticketKey: 'AIB-123',
      startIndex: 10,
      endIndex: 18,
    });
  });

  it('should parse multiple ticket references', () => {
    const refs = parseTicketReferences('Compare #AIB-123 with #PRJ-456');
    expect(refs).toHaveLength(2);
    expect(refs[0]?.ticketKey).toBe('AIB-123');
    expect(refs[1]?.ticketKey).toBe('PRJ-456');
  });

  it('should handle content with no references', () => {
    const refs = parseTicketReferences('No ticket references here');
    expect(refs).toHaveLength(0);
  });

  it('should handle empty string', () => {
    const refs = parseTicketReferences('');
    expect(refs).toHaveLength(0);
  });

  it('should handle duplicate references', () => {
    const refs = parseTicketReferences('#AIB-123 and again #AIB-123');
    expect(refs).toHaveLength(2);
    expect(refs[0]?.ticketKey).toBe('AIB-123');
    expect(refs[1]?.ticketKey).toBe('AIB-123');
  });

  it('should track correct positions', () => {
    const content = '#AIB-123';
    const refs = parseTicketReferences(content);
    expect(refs[0]).toEqual({
      ticketKey: 'AIB-123',
      startIndex: 0,
      endIndex: 8,
    });
  });

  it('should handle alphanumeric project keys', () => {
    const refs = parseTicketReferences('#A1B-123 and #AB2-456');
    expect(refs).toHaveLength(2);
    expect(refs[0]?.ticketKey).toBe('A1B-123');
    expect(refs[1]?.ticketKey).toBe('AB2-456');
  });
});

describe('extractTicketKeys', () => {
  it('should extract unique keys from content', () => {
    const keys = extractTicketKeys('Check #AIB-123 and #AIB-123 plus #PRJ-456');
    expect(keys).toEqual(['AIB-123', 'PRJ-456']);
  });

  it('should return empty array for no references', () => {
    const keys = extractTicketKeys('No references');
    expect(keys).toEqual([]);
  });

  it('should preserve order of first occurrence', () => {
    const keys = extractTicketKeys('#ZZZ-1 then #AAA-2 then #ZZZ-1');
    expect(keys).toEqual(['ZZZ-1', 'AAA-2']);
  });
});

describe('validateTicketKeyFormat', () => {
  it('should validate correct format', () => {
    expect(validateTicketKeyFormat('AIB-123')).toBe(true);
    expect(validateTicketKeyFormat('PRJ-1')).toBe(true);
    expect(validateTicketKeyFormat('ABCDEF-9999')).toBe(true);
  });

  it('should reject lowercase', () => {
    expect(validateTicketKeyFormat('aib-123')).toBe(false);
  });

  it('should reject too short project key', () => {
    expect(validateTicketKeyFormat('AB-123')).toBe(false);
  });

  it('should reject too long project key', () => {
    expect(validateTicketKeyFormat('ABCDEFG-123')).toBe(false);
  });

  it('should reject missing hyphen', () => {
    expect(validateTicketKeyFormat('AIB123')).toBe(false);
  });

  it('should reject missing number', () => {
    expect(validateTicketKeyFormat('AIB-')).toBe(false);
  });

  it('should reject with hash prefix', () => {
    expect(validateTicketKeyFormat('#AIB-123')).toBe(false);
  });
});

describe('formatTicketReference', () => {
  it('should format with hash prefix', () => {
    expect(formatTicketReference('AIB-123')).toBe('#AIB-123');
  });

  it('should handle various keys', () => {
    expect(formatTicketReference('PRJ-1')).toBe('#PRJ-1');
    expect(formatTicketReference('ABCDEF-9999')).toBe('#ABCDEF-9999');
  });
});

describe('hasTicketReferences', () => {
  it('should return true when references exist', () => {
    expect(hasTicketReferences('Check #AIB-123')).toBe(true);
  });

  it('should return false when no references', () => {
    expect(hasTicketReferences('No references')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(hasTicketReferences('')).toBe(false);
  });
});

describe('countTicketReferences', () => {
  it('should count unique references', () => {
    expect(countTicketReferences('#AIB-123 and #PRJ-456')).toBe(2);
  });

  it('should not count duplicates', () => {
    expect(countTicketReferences('#AIB-123 and #AIB-123')).toBe(1);
  });

  it('should return 0 for no references', () => {
    expect(countTicketReferences('No refs')).toBe(0);
  });
});

describe('validateTicketReferenceLimit', () => {
  it('should validate 1-5 references as valid', () => {
    expect(validateTicketReferenceLimit('#AIB-123').valid).toBe(true);
    expect(
      validateTicketReferenceLimit('#AIB-1 #AIB-2 #AIB-3 #AIB-4 #AIB-5').valid
    ).toBe(true);
  });

  it('should reject 0 references', () => {
    const result = validateTicketReferenceLimit('No refs');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Must reference at least 1 ticket to compare');
  });

  it('should reject more than 5 references', () => {
    const result = validateTicketReferenceLimit(
      '#AIB-1 #AIB-2 #AIB-3 #AIB-4 #AIB-5 #AIB-6'
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cannot compare more than 5 tickets');
  });

  it('should exclude specified key', () => {
    // 3 refs, but AIB-123 excluded = 2 remaining
    const result = validateTicketReferenceLimit(
      '#AIB-123 #AIB-456 #AIB-789',
      'AIB-123'
    );
    expect(result.valid).toBe(true);
    expect(result.count).toBe(2);
  });

  it('should reject if all refs are excluded', () => {
    const result = validateTicketReferenceLimit('#AIB-123', 'AIB-123');
    expect(result.valid).toBe(false);
    expect(result.count).toBe(0);
  });

  it('should report correct count', () => {
    const result = validateTicketReferenceLimit('#A-1 #B-2 #C-3');
    // Note: A-1, B-2, C-3 are only 1 char project keys which don't match regex
    expect(result.count).toBe(0);

    const validResult = validateTicketReferenceLimit('#AIB-1 #AIB-2 #AIB-3');
    expect(validResult.count).toBe(3);
  });
});

describe('parseAndValidateProjectScope', () => {
  it('should separate same-project and cross-project refs', () => {
    const result = parseAndValidateProjectScope(
      '#AIB-123 #AIB-456 #PRJ-789',
      'AIB'
    );

    expect(result.validRefs).toHaveLength(2);
    expect(result.validRefs.map((r) => r.ticketKey)).toEqual([
      'AIB-123',
      'AIB-456',
    ]);

    expect(result.crossProjectRefs).toHaveLength(1);
    expect(result.crossProjectRefs[0]?.ticketKey).toBe('PRJ-789');
  });

  it('should return all as valid for same project', () => {
    const result = parseAndValidateProjectScope('#AIB-1 #AIB-2 #AIB-3', 'AIB');
    expect(result.validRefs).toHaveLength(3);
    expect(result.crossProjectRefs).toHaveLength(0);
  });

  it('should return all as cross-project for different project', () => {
    const result = parseAndValidateProjectScope('#PRJ-1 #PRJ-2', 'AIB');
    expect(result.validRefs).toHaveLength(0);
    expect(result.crossProjectRefs).toHaveLength(2);
  });

  it('should handle empty content', () => {
    const result = parseAndValidateProjectScope('', 'AIB');
    expect(result.validRefs).toHaveLength(0);
    expect(result.crossProjectRefs).toHaveLength(0);
  });
});
