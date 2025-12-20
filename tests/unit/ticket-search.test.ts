import { describe, it, expect } from 'vitest';
import {
  searchTickets,
  calculateRelevance,
  type TicketSearchResult,
} from '@/lib/utils/ticket-search';
import type { TicketWithVersion } from '@/lib/types';

// Create test tickets
function createTicket(
  id: number,
  ticketKey: string,
  title: string,
  description: string | null = null
): TicketWithVersion {
  return {
    id,
    ticketNumber: id,
    ticketKey,
    title,
    description,
    stage: 'INBOX',
    version: 1,
    projectId: 1,
    branch: null,
    previewUrl: null,
    autoMode: false,
    clarificationPolicy: null,
    workflowType: 'FULL',
    attachments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('ticket-search', () => {
  describe('searchTickets', () => {
    // T003: Unit test for searchTickets empty query handling
    describe('empty query handling', () => {
      it('returns empty array for empty string query', () => {
        const tickets = [createTicket(1, 'AIB-1', 'First ticket')];
        expect(searchTickets(tickets, '')).toEqual([]);
      });

      it('returns empty array for whitespace-only query', () => {
        const tickets = [createTicket(1, 'AIB-1', 'First ticket')];
        expect(searchTickets(tickets, '   ')).toEqual([]);
      });

      it('returns empty array when tickets array is empty', () => {
        expect(searchTickets([], 'test')).toEqual([]);
      });

      it('returns empty array when tickets is not an array', () => {
        // @ts-expect-error - testing runtime behavior with invalid input
        expect(searchTickets(undefined, 'test')).toEqual([]);
        // @ts-expect-error - testing runtime behavior with invalid input
        expect(searchTickets(null, 'test')).toEqual([]);
      });
    });

    // T005: Unit test for searchTickets maxResults limit (10 items)
    describe('maxResults limit', () => {
      it('limits results to 10 items by default', () => {
        const tickets = Array.from({ length: 15 }, (_, i) =>
          createTicket(i + 1, `AIB-${i + 1}`, `Ticket ${i + 1}`)
        );

        const results = searchTickets(tickets, 'AIB');
        expect(results.length).toBe(10);
      });

      it('respects custom maxResults parameter', () => {
        const tickets = Array.from({ length: 10 }, (_, i) =>
          createTicket(i + 1, `AIB-${i + 1}`, `Ticket ${i + 1}`)
        );

        const results = searchTickets(tickets, 'AIB', 5);
        expect(results.length).toBe(5);
      });

      it('returns fewer than maxResults when not enough matches', () => {
        const tickets = [
          createTicket(1, 'AIB-1', 'First ticket'),
          createTicket(2, 'AIB-2', 'Second ticket'),
        ];

        const results = searchTickets(tickets, 'AIB', 10);
        expect(results.length).toBe(2);
      });
    });
  });

  // T004: Unit test for calculateRelevance scoring function
  describe('calculateRelevance', () => {
    describe('scoring values', () => {
      it('returns 4 for exact key match', () => {
        const ticket = createTicket(1, 'AIB-42', 'Some title');
        expect(calculateRelevance(ticket, 'aib-42')).toBe(4);
      });

      it('returns 3 for key contains query', () => {
        const ticket = createTicket(1, 'AIB-42', 'Some title');
        expect(calculateRelevance(ticket, 'aib-4')).toBe(3);
      });

      it('returns 2 for title starts with query', () => {
        const ticket = createTicket(1, 'AIB-42', 'Fix login button');
        expect(calculateRelevance(ticket, 'fix')).toBe(2);
      });

      it('returns 1 for title contains query', () => {
        const ticket = createTicket(1, 'AIB-42', 'Fix login button');
        expect(calculateRelevance(ticket, 'login')).toBe(1);
      });

      it('returns 0.5 for description contains query', () => {
        const ticket = createTicket(
          1,
          'AIB-42',
          'Some title',
          'This is a detailed description'
        );
        expect(calculateRelevance(ticket, 'detailed')).toBe(0.5);
      });

      it('returns 0 for no match', () => {
        const ticket = createTicket(1, 'AIB-42', 'Some title', 'Description');
        expect(calculateRelevance(ticket, 'xyz')).toBe(0);
      });
    });

    describe('case insensitivity', () => {
      it('handles uppercase ticket key with lowercase query', () => {
        const ticket = createTicket(1, 'AIB-42', 'Some title');
        // calculateRelevance expects pre-lowercased query (per docstring)
        expect(calculateRelevance(ticket, 'aib-42')).toBe(4);
      });

      it('handles mixed case title with lowercase query', () => {
        const ticket = createTicket(1, 'AIB-42', 'Fix Login Button');
        // calculateRelevance expects pre-lowercased query (per docstring)
        expect(calculateRelevance(ticket, 'login')).toBe(1);
      });
    });

    describe('priority order', () => {
      it('prioritizes key match over title match', () => {
        const ticket = createTicket(1, 'FIX-1', 'Fix something');
        // Query "fix" matches both key and title, but key-contains (3) > title-starts (2)
        expect(calculateRelevance(ticket, 'fix')).toBe(3);
      });

      it('prioritizes title match over description match', () => {
        const ticket = createTicket(1, 'AIB-1', 'Test title', 'Test description');
        // Query "test" matches both title and description, title-starts (2) > desc (0.5)
        expect(calculateRelevance(ticket, 'test')).toBe(2);
      });
    });
  });

  // T009: Unit test for key matching (exact key match "AIB-42")
  describe('key matching', () => {
    it('finds exact key match "AIB-42"', () => {
      const tickets = [
        createTicket(1, 'AIB-1', 'First ticket'),
        createTicket(42, 'AIB-42', 'The answer ticket'),
        createTicket(100, 'AIB-100', 'Hundredth ticket'),
      ];

      const results = searchTickets(tickets, 'AIB-42');
      expect(results.length).toBe(1);
      expect(results[0].ticketKey).toBe('AIB-42');
    });

    it('exact key match has highest relevance score', () => {
      const tickets = [
        createTicket(42, 'AIB-42', 'The answer ticket'),
        createTicket(421, 'AIB-421', 'Another ticket'),
      ];

      const results = searchTickets(tickets, 'AIB-42');
      expect(results[0].ticketKey).toBe('AIB-42');
      expect(results[0].relevanceScore).toBe(4);
    });
  });

  // T010: Unit test for partial key matching ("AIB-4" matches AIB-4, AIB-40, AIB-42)
  describe('partial key matching', () => {
    it('partial key "AIB-4" matches multiple tickets', () => {
      const tickets = [
        createTicket(1, 'AIB-1', 'First ticket'),
        createTicket(4, 'AIB-4', 'Fourth ticket'),
        createTicket(40, 'AIB-40', 'Fortieth ticket'),
        createTicket(42, 'AIB-42', 'Answer ticket'),
        createTicket(100, 'AIB-100', 'Hundredth ticket'),
      ];

      const results = searchTickets(tickets, 'AIB-4');
      expect(results.length).toBe(3);
      expect(results.map((r) => r.ticketKey)).toEqual(
        expect.arrayContaining(['AIB-4', 'AIB-40', 'AIB-42'])
      );
    });

    it('exact match "AIB-4" is ranked higher than partial matches', () => {
      const tickets = [
        createTicket(40, 'AIB-40', 'Fortieth ticket'),
        createTicket(4, 'AIB-4', 'Fourth ticket'),
        createTicket(42, 'AIB-42', 'Answer ticket'),
      ];

      const results = searchTickets(tickets, 'AIB-4');
      expect(results[0].ticketKey).toBe('AIB-4');
      expect(results[0].relevanceScore).toBe(4); // exact match
    });
  });

  // T017: Unit test for title substring matching
  describe('title substring matching', () => {
    it('finds tickets by title substring', () => {
      const tickets = [
        createTicket(1, 'AIB-1', 'Fix login button'),
        createTicket(2, 'AIB-2', 'Add dark mode'),
        createTicket(3, 'AIB-3', 'Update login page'),
      ];

      const results = searchTickets(tickets, 'login');
      expect(results.length).toBe(2);
      expect(results.map((r) => r.ticketKey)).toEqual(
        expect.arrayContaining(['AIB-1', 'AIB-3'])
      );
    });
  });

  // T018: Unit test for case-insensitive title search
  describe('case-insensitive search', () => {
    it('finds tickets regardless of query case', () => {
      const tickets = [
        createTicket(1, 'AIB-1', 'Fix Login Button'),
        createTicket(2, 'AIB-2', 'Add DARK MODE'),
      ];

      const resultsLower = searchTickets(tickets, 'login');
      const resultsUpper = searchTickets(tickets, 'LOGIN');
      const resultsMixed = searchTickets(tickets, 'LoGiN');

      expect(resultsLower.length).toBe(1);
      expect(resultsUpper.length).toBe(1);
      expect(resultsMixed.length).toBe(1);
      expect(resultsLower[0].ticketKey).toBe('AIB-1');
    });

    it('finds tickets regardless of title case', () => {
      const tickets = [createTicket(1, 'AIB-1', 'UPPERCASE TITLE')];

      const results = searchTickets(tickets, 'uppercase');
      expect(results.length).toBe(1);
    });
  });

  // T023: Unit test for description-only match (text in description but not title/key)
  describe('description matching', () => {
    it('finds tickets by description when not in title or key', () => {
      const tickets = [
        createTicket(1, 'AIB-1', 'Simple title', 'This has unique content'),
        createTicket(2, 'AIB-2', 'Another title', 'Different text here'),
      ];

      const results = searchTickets(tickets, 'unique');
      expect(results.length).toBe(1);
      expect(results[0].ticketKey).toBe('AIB-1');
    });

    it('handles null description gracefully', () => {
      const tickets = [createTicket(1, 'AIB-1', 'Simple title', null)];

      const results = searchTickets(tickets, 'anything');
      expect(results.length).toBe(0);
    });
  });

  // T024: Unit test for description relevance ranking (lower priority than title)
  describe('relevance ranking', () => {
    it('ranks title matches higher than description matches', () => {
      const tickets = [
        createTicket(1, 'AIB-1', 'Search feature', 'No mention'),
        createTicket(2, 'AIB-2', 'Other feature', 'Has search in description'),
      ];

      const results = searchTickets(tickets, 'search');
      expect(results[0].ticketKey).toBe('AIB-1'); // title match first
      expect(results[0].relevanceScore).toBeGreaterThan(results[1].relevanceScore);
    });

    it('ranks key matches higher than title matches', () => {
      const tickets = [
        createTicket(1, 'FIX-1', 'Some title'),
        createTicket(2, 'AIB-2', 'Fix something'),
      ];

      const results = searchTickets(tickets, 'fix');
      expect(results[0].ticketKey).toBe('FIX-1'); // key match first
    });
  });

  // T026: Integration test validating description matches appear after key/title matches
  describe('result ordering', () => {
    it('orders results: exact key > key-contains > title-starts > title-contains > description', () => {
      const tickets = [
        createTicket(5, 'AIB-5', 'Other', 'test in description'),
        createTicket(3, 'AIB-3', 'Test starts title'),
        createTicket(2, 'TEST-2', 'Some title'),
        createTicket(4, 'AIB-4', 'Has test in middle'),
        createTicket(1, 'TEST-1', 'Exact match title'),
      ];

      const results = searchTickets(tickets, 'test-1');
      expect(results[0].ticketKey).toBe('TEST-1'); // exact key match (4)

      const resultsPartial = searchTickets(tickets, 'test');
      // First should be key contains (TEST-1 or TEST-2)
      expect(resultsPartial[0].relevanceScore).toBe(3); // key-contains
    });
  });
});
