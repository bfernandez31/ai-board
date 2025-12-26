/**
 * Component Test Mock Fixtures
 *
 * Provides reusable mock data for component integration tests.
 * All mock data uses [e2e] prefix for consistency with E2E test patterns.
 *
 * @see specs/AIB-117-testing-trophy-component/data-model.md
 */

import type { ProjectMember } from '@/app/lib/types/mention';
import type { SearchResult } from '@/app/lib/types/search';

/**
 * Mock project members for MentionInput testing
 */
export const mockProjectMembers: ProjectMember[] = [
  {
    id: '1',
    email: 'owner@test.com',
    name: 'Project Owner',
  },
  {
    id: '2',
    email: 'john@test.com',
    name: 'John Doe',
  },
  {
    id: '3',
    email: 'jane@test.com',
    name: 'Jane Smith',
  },
  {
    id: '4',
    email: 'ai-board@system.local',
    name: 'AI-BOARD',
  },
];

/**
 * Mock tickets for TicketSearch testing
 */
export const mockTickets: SearchResult[] = [
  {
    id: 1,
    ticketKey: 'TEST-1',
    title: '[e2e] First test ticket',
    stage: 'INBOX',
  },
  {
    id: 2,
    ticketKey: 'TEST-2',
    title: '[e2e] Second test ticket',
    stage: 'BUILD',
  },
  {
    id: 3,
    ticketKey: 'TEST-3',
    title: '[e2e] Third test ticket with search term',
    stage: 'VERIFY',
  },
];

/**
 * Mock form input for NewTicketModal testing
 */
export const mockValidTicketInput = {
  title: '[e2e] Valid Test Ticket',
  description: 'A valid test ticket description for testing purposes.',
};

export const mockInvalidTicketInputs = {
  emptyTitle: {
    title: '',
    description: 'Description with empty title',
  },
  shortTitle: {
    title: 'ab',
    description: 'Description with short title',
  },
  longTitle: {
    title: 'a'.repeat(101),
    description: 'Description with long title',
  },
  longDescription: {
    title: '[e2e] Valid Title',
    description: 'a'.repeat(2501),
  },
};

/**
 * Mock API response factories
 */
export const mockResponses = {
  /**
   * Create a successful ticket creation response
   */
  ticketCreated: (ticketKey = 'TEST-1') => ({
    id: 1,
    ticketKey,
    title: mockValidTicketInput.title,
    description: mockValidTicketInput.description,
    stage: 'INBOX',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),

  /**
   * Create a validation error response
   */
  validationError: (field: string, message: string) => ({
    error: 'Validation failed',
    details: {
      fieldErrors: {
        [field]: [message],
      },
    },
  }),

  /**
   * Create a successful search response
   */
  searchResults: (results: SearchResult[] = mockTickets) => ({
    results,
    totalCount: results.length,
  }),

  /**
   * Create a successful members response
   */
  projectMembers: (members: ProjectMember[] = mockProjectMembers) => ({
    members,
  }),

  /**
   * Create a successful comment response
   */
  commentCreated: (content: string) => ({
    id: 1,
    ticketId: 1,
    userId: '1',
    content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
};

/**
 * Mock fetch helper for component tests
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   global.fetch = createMockFetch({
 *     '/api/projects/1/tickets': mockResponses.searchResults(),
 *   });
 * });
 * ```
 */
export function createMockFetch(
  responses: Record<string, unknown>
): typeof fetch {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    // Find matching response
    for (const [pattern, response] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => response,
          text: async () => JSON.stringify(response),
        } as Response);
      }
    }

    // Default: 404
    return Promise.resolve({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
      text: async () => 'Not found',
    } as Response);
  }) as typeof fetch;
}

/**
 * Mock fetch that returns an error
 */
export function createErrorFetch(
  status: number,
  error: unknown
): typeof fetch {
  return vi.fn(() =>
    Promise.resolve({
      ok: false,
      status,
      json: async () => error,
      text: async () => JSON.stringify(error),
    } as Response)
  ) as typeof fetch;
}

/**
 * Mock fetch that throws a network error
 */
export function createNetworkErrorFetch(): typeof fetch {
  return vi.fn(() =>
    Promise.reject(new Error('Network error'))
  ) as typeof fetch;
}
