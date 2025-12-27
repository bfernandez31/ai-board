/**
 * Example: Using Type-Safe Mock Data Factories
 *
 * This example demonstrates:
 * - Creating test data with factories
 * - Type safety with Partial<T>
 * - Composing complex test scenarios
 * - Avoiding hard-coded test data
 *
 * Benefits:
 * - Readable test code: mockTicket({ title: 'Custom' })
 * - Type-safe: TypeScript catches property typos
 * - Maintainable: Change factory, all tests update
 * - Realistic: Uses sensible defaults (random IDs, timestamps)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/fixtures/vitest/render-utils';
import {
  MockDataFactory,
  mockTicket,
  mockTickets,
  mockTicketsByStage,
  mockTicketWithJobs,
  mockProject,
  mockUser,
} from '@/tests/fixtures/factories/mock-data';

describe('Using Mock Data Factories (Example)', () => {
  describe('Simple factory usage', () => {
    it('creates ticket with defaults', () => {
      const ticket = mockTicket();

      // All required fields populated
      expect(ticket.id).toBeDefined();
      expect(ticket.ticketKey).toBeDefined();
      expect(ticket.title).toBeDefined();
      expect(ticket.stage).toBe('INBOX');
      expect(ticket.jobs).toEqual([]);
    });

    it('creates ticket with custom properties', () => {
      const ticket = mockTicket({
        title: 'Implement dark mode',
        stage: 'BUILD',
        projectId: 2,
      });

      expect(ticket.title).toBe('Implement dark mode');
      expect(ticket.stage).toBe('BUILD');
      expect(ticket.projectId).toBe(2);
      // Other properties still have defaults
      expect(ticket.id).toBeDefined();
    });

    it('creates multiple tickets with sequential IDs', () => {
      const tickets = mockTickets(3);

      expect(tickets).toHaveLength(3);
      expect(tickets[0].id).toBe(1);
      expect(tickets[1].id).toBe(2);
      expect(tickets[2].id).toBe(3);
      // All have defaults
      expect(tickets.every(t => t.stage === 'INBOX')).toBe(true);
    });

    it('creates multiple tickets with common overrides', () => {
      const tickets = mockTickets(3, { stage: 'BUILD', projectId: 2 });

      expect(tickets).toHaveLength(3);
      expect(tickets.every(t => t.stage === 'BUILD')).toBe(true);
      expect(tickets.every(t => t.projectId === 2)).toBe(true);
    });
  });

  describe('Complex factory scenarios', () => {
    it('creates tickets organized by stage', () => {
      const ticketsByStage = mockTicketsByStage({
        INBOX: 3,
        SPECIFY: 2,
        BUILD: 1,
      });

      expect(Object.keys(ticketsByStage)).toHaveLength(3);
      expect(ticketsByStage.INBOX).toHaveLength(3);
      expect(ticketsByStage.SPECIFY).toHaveLength(2);
      expect(ticketsByStage.BUILD).toHaveLength(1);
      // Verify grouping
      expect(ticketsByStage.INBOX.every(t => t.stage === 'INBOX')).toBe(true);
    });

    it('creates ticket with jobs', () => {
      const ticket = mockTicketWithJobs(3);

      expect(ticket.jobs).toHaveLength(3);
      expect(ticket.jobs[0]).toBeDefined();
      expect(ticket.jobs[0].ticketId).toBe(ticket.id);
    });

    it('creates ticket with RUNNING job', () => {
      const ticket = mockTicketWithJobs(1, { stage: 'BUILD' });

      expect(ticket.stage).toBe('BUILD');
      expect(ticket.jobs).toHaveLength(1);
      // Last job should be RUNNING, others COMPLETED
      expect(ticket.jobs[0].status).toBe('RUNNING');
    });
  });

  describe('Using MockDataFactory class', () => {
    it('provides consistent interface', () => {
      // All creation methods available
      const ticket = MockDataFactory.ticket();
      const project = MockDataFactory.project();
      const user = MockDataFactory.user();

      expect(ticket.id).toBeDefined();
      expect(project.id).toBeDefined();
      expect(user.id).toBeDefined();
    });

    it('composes nested objects', () => {
      // Create project with related data
      const project = MockDataFactory.project({ name: 'AI Board' });
      const user = MockDataFactory.user({ email: 'owner@example.com' });
      const tickets = MockDataFactory.tickets(5, { projectId: project.id });

      expect(project.name).toBe('AI Board');
      expect(user.email).toBe('owner@example.com');
      expect(tickets.every(t => t.projectId === project.id)).toBe(true);
    });

    it('creates realistic test scenarios', () => {
      // Scenario: Project with tickets in various stages and some with jobs
      const project = MockDataFactory.project({ name: 'Sprint 1' });

      const ticketsByStage = {
        INBOX: MockDataFactory.tickets(2, { projectId: project.id }),
        SPECIFY: MockDataFactory.tickets(1, { projectId: project.id, stage: 'SPECIFY' }),
        BUILD: [
          MockDataFactory.ticketWithJobs(1, {
            projectId: project.id,
            stage: 'BUILD',
          }),
        ],
        VERIFY: MockDataFactory.tickets(1, { projectId: project.id, stage: 'VERIFY' }),
      };

      // Ready for component testing
      const allTickets = Object.values(ticketsByStage).flat();
      expect(allTickets).toHaveLength(5);
      expect(allTickets.every(t => t.projectId === project.id)).toBe(true);
    });
  });

  describe('Factory patterns for component testing', () => {
    it('builds test data for ticket card display', () => {
      const ticket = mockTicket({
        title: 'Build API endpoint',
        stage: 'BUILD',
      });

      const job = MockDataFactory.job({
        ticketId: ticket.id,
        command: 'implement',
        status: 'RUNNING',
      });

      // renderWithProviders(<TicketCard ticket={ticket} job={job} />);
      // expect(screen.getByText('Build API endpoint')).toBeInTheDocument();
    });

    it('builds test data for board with multiple stages', () => {
      const project = mockProject();
      const ticketsByStage = mockTicketsByStage({
        INBOX: 5,
        SPECIFY: 3,
        PLAN: 2,
        BUILD: 4,
        VERIFY: 1,
        SHIP: 0,
      });

      // renderWithProviders(
      //   <Board ticketsByStage={ticketsByStage} projectId={project.id} />
      // );
      // expect(screen.getByText('15 total tickets')).toBeInTheDocument();
    });

    it('builds test data for user interactions', () => {
      const user = mockUser();
      const project = mockProject({ userId: user.id });
      const ticket = mockTicket({ projectId: project.id });

      // User data ready for auth mocking, project data for UI, ticket for details
      expect(user.id).toBeDefined();
      expect(project.userId).toBe(user.id);
      expect(ticket.projectId).toBe(project.id);
    });
  });

  describe('Factory error cases', () => {
    it('handles missing required fields with defaults', () => {
      const ticket = mockTicket({}); // Empty overrides

      // All fields still populated
      expect(ticket.id).toBeDefined();
      expect(ticket.title).toBeDefined();
      expect(ticket.stage).toBeDefined();
    });

    it('preserves explicit null values', () => {
      const ticket = mockTicket({
        description: undefined, // Clear description
        previewUrl: null, // Explicit null
      });

      // undefined gets overridden by default
      expect(ticket.description).toBeDefined();
      // null is preserved
      expect(ticket.previewUrl).toBeNull();
    });

    it('handles type-safe overrides', () => {
      // TypeScript prevents typos in factory calls
      const ticket = mockTicket({
        title: 'Valid title', // ✓ correct property
        // typoProperty: 'invalid' // ✗ TS error: not in Partial<TicketWithVersion>
      });

      expect(ticket.title).toBe('Valid title');
    });
  });
});

/**
 * Key takeaways:
 *
 * 1. Use factories instead of hard-coded data
 *    - More readable: mockTicket({ stage: 'BUILD' })
 *    - More maintainable: change factory once
 *    - More realistic: sensible defaults
 *
 * 2. Type safety prevents bugs
 *    - TypeScript ensures property names are correct
 *    - Catch typos at compile-time, not test-time
 *    - Refactor confidently when types change
 *
 * 3. Factories scale with complexity
 *    - Simple: mockTicket() for single object
 *    - Complex: MockDataFactory.ticketsByStage() for related objects
 *    - Composable: combine factories for scenarios
 *
 * 4. Factories document expected data shapes
 *    - Default values show typical properties
 *    - Overrides show what can be customized
 *    - Better than comments in hard-coded test data
 *
 * 5. Use factories in beforeEach for test setup
 *    - Cleaner than global test fixtures
 *    - Each test gets fresh data
 *    - Easier to understand test prerequisites
 */
