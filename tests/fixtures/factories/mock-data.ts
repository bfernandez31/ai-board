/**
 * Type-safe mock data factories for testing
 *
 * Usage:
 * import { MockDataFactory, mockTicket, mockProject } from '@/tests/fixtures/factories/mock-data';
 *
 * const ticket = mockTicket({ title: 'Custom Title' });
 * const tickets = MockDataFactory.tickets(5);
 * const byStage = MockDataFactory.ticketsByStage({ INBOX: 3, BUILD: 2 });
 */

import type { TicketWithVersion } from '@/lib/types';
import { Prisma } from '@prisma/client';

/**
 * Comprehensive mock data factory with type-safe creation
 *
 * All methods:
 * - Return complete, valid objects
 * - Support partial overrides via Partial<T>
 * - Use realistic defaults
 * - Are fully type-checked in TypeScript strict mode
 */
export class MockDataFactory {
  /**
   * Create a mock ticket with realistic defaults
   *
   * @param overrides - Partial ticket properties to override
   * @returns Complete TicketWithVersion object
   *
   * @example
   * MockDataFactory.ticket()
   * MockDataFactory.ticket({ title: 'Custom Title', stage: 'BUILD' })
   * MockDataFactory.ticket({ projectId: 2, jobs: [] })
   */
  static ticket(overrides?: Partial<TicketWithVersion>): TicketWithVersion {
    const id = overrides?.id ?? Math.floor(Math.random() * 10000) + 1;
    const projectId = overrides?.projectId ?? 1;

    return {
      id,
      projectId,
      ticketKey: overrides?.ticketKey ?? `ABC-${id}`,
      title: overrides?.title ?? `Test Ticket ${id}`,
      description: overrides?.description ?? `Test ticket description for ticket ${id}`,
      stage: overrides?.stage ?? 'INBOX',
      branch:
        overrides?.branch ??
        `${id}-test-ticket-${(overrides?.title || '').replace(/\s+/g, '-').toLowerCase()}`,
      workflowType: overrides?.workflowType ?? 'FULL',
      previewUrl: overrides?.previewUrl ?? null,
      createdAt: overrides?.createdAt ?? new Date(Date.now() - 86400000),
      updatedAt: overrides?.updatedAt ?? new Date(),
      version: overrides?.version ?? 1,
      jobs: overrides?.jobs ?? [],
      ...overrides,
    };
  }

  /**
   * Create multiple tickets efficiently
   *
   * @param count - Number of tickets to create
   * @param overrides - Properties applied to all tickets
   * @returns Array of TicketWithVersion objects with unique IDs
   *
   * @example
   * MockDataFactory.tickets(5)
   * MockDataFactory.tickets(3, { projectId: 2 })
   * MockDataFactory.tickets(10, { stage: 'BUILD' })
   */
  static tickets(
    count: number,
    overrides?: Partial<TicketWithVersion>,
  ): TicketWithVersion[] {
    return Array.from({ length: count }, (_, i) =>
      this.ticket({
        id: i + 1,
        ...overrides,
      }),
    );
  }

  /**
   * Create tickets grouped by stage (simulating database query result)
   *
   * Useful for testing components that render tickets by column/stage
   *
   * @param counts - Object with stage names as keys and ticket counts as values
   * @returns Record<string, TicketWithVersion[]> organized by stage
   *
   * @example
   * MockDataFactory.ticketsByStage({ INBOX: 3, SPECIFY: 2, BUILD: 1 })
   * MockDataFactory.ticketsByStage()
   *   // { INBOX: [3 tickets], SPECIFY: [2 tickets], PLAN: [1 ticket], BUILD: [0 tickets], ... }
   */
  static ticketsByStage(
    counts?: Record<string, number>,
  ): Record<string, TicketWithVersion[]> {
    const stageCounts = counts ?? {
      INBOX: 3,
      SPECIFY: 2,
      PLAN: 1,
      BUILD: 2,
      VERIFY: 1,
      SHIP: 0,
    };

    const result: Record<string, TicketWithVersion[]> = {};
    let id = 1;

    for (const [stage, count] of Object.entries(stageCounts)) {
      result[stage] = Array.from({ length: count }, () =>
        this.ticket({
          id: id++,
          stage,
        }),
      );
    }

    return result;
  }

  /**
   * Create a mock job for testing job-related features
   *
   * @param overrides - Partial job properties
   * @returns Complete job object
   *
   * @example
   * MockDataFactory.job()
   * MockDataFactory.job({ status: 'RUNNING', command: 'specify' })
   * MockDataFactory.job({ ticketId: 123 })
   */
  static job(
    overrides?: Partial<Prisma.JobCreateInput>,
  ): Prisma.JobCreateInput {
    const statuses = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
    const commands = ['specify', 'plan', 'implement', 'verify', 'quick-impl'] as const;

    return {
      ticketId: overrides?.ticketId ?? Math.floor(Math.random() * 10000) + 1,
      command: overrides?.command ?? commands[0],
      status: overrides?.status ?? statuses[0],
      jobUrl: overrides?.jobUrl ?? `https://github.com/owner/repo/actions/runs/${Math.floor(Math.random() * 1000000)}`,
      createdAt: overrides?.createdAt ?? new Date(),
      updatedAt: overrides?.updatedAt ?? new Date(),
      ...overrides,
    };
  }

  /**
   * Create a ticket with associated jobs
   *
   * Useful for testing job polling, status indicators, etc.
   *
   * @param jobCount - Number of jobs to create
   * @param overrides - Ticket property overrides
   * @returns Ticket with jobs array
   *
   * @example
   * MockDataFactory.ticketWithJobs(1)
   * MockDataFactory.ticketWithJobs(3, { stage: 'VERIFY' })
   */
  static ticketWithJobs(
    jobCount: number = 1,
    overrides?: Partial<TicketWithVersion>,
  ): TicketWithVersion {
    const ticket = this.ticket(overrides);
    return {
      ...ticket,
      jobs: Array.from({ length: jobCount }, (_, i) =>
        this.job({
          ticketId: ticket.id,
          status: i === jobCount - 1 ? ('RUNNING' as any) : ('COMPLETED' as any),
        }),
      ),
    };
  }

  /**
   * Create a project mock
   *
   * @param overrides - Partial project properties
   * @returns Complete project object
   *
   * @example
   * MockDataFactory.project()
   * MockDataFactory.project({ name: 'Custom Project' })
   */
  static project(
    overrides?: Partial<{
      id: number;
      name: string;
      key: string;
      description: string | null;
      githubOwner: string | null;
      githubRepo: string | null;
      clarificationPolicy: string;
      userId: string;
      createdAt: Date;
      updatedAt: Date;
    }>,
  ) {
    return {
      id: overrides?.id ?? 1,
      name: overrides?.name ?? 'Test Project',
      key: overrides?.key ?? 'TST',
      description: overrides?.description ?? 'Test project description',
      githubOwner: overrides?.githubOwner ?? 'test-owner',
      githubRepo: overrides?.githubRepo ?? 'test-repo',
      clarificationPolicy: overrides?.clarificationPolicy ?? 'INTERACTIVE',
      userId: overrides?.userId ?? 'user-1',
      createdAt: overrides?.createdAt ?? new Date(),
      updatedAt: overrides?.updatedAt ?? new Date(),
      ...overrides,
    };
  }

  /**
   * Create a user mock
   *
   * @param overrides - Partial user properties
   * @returns Complete user object
   *
   * @example
   * MockDataFactory.user()
   * MockDataFactory.user({ email: 'custom@example.com' })
   */
  static user(
    overrides?: Partial<{
      id: string;
      email: string;
      name: string | null;
      emailVerified: Date | null;
      updatedAt: Date;
    }>,
  ) {
    return {
      id: overrides?.id ?? `user-${Math.floor(Math.random() * 10000)}`,
      email: overrides?.email ?? `test${Math.floor(Math.random() * 10000)}@example.com`,
      name: overrides?.name ?? 'Test User',
      emailVerified: overrides?.emailVerified ?? new Date(),
      updatedAt: overrides?.updatedAt ?? new Date(),
      ...overrides,
    };
  }
}

/**
 * Convenience function aliases for common single-object creation
 *
 * Usage: import { mockTicket, mockProject } from '@/tests/fixtures/factories/mock-data';
 */
export const mockTicket = (overrides?: Partial<TicketWithVersion>) =>
  MockDataFactory.ticket(overrides);

export const mockTickets = (count: number, overrides?: Partial<TicketWithVersion>) =>
  MockDataFactory.tickets(count, overrides);

export const mockTicketsByStage = (counts?: Record<string, number>) =>
  MockDataFactory.ticketsByStage(counts);

export const mockTicketWithJobs = (jobCount?: number, overrides?: Partial<TicketWithVersion>) =>
  MockDataFactory.ticketWithJobs(jobCount, overrides);

export const mockProject = (
  overrides?: Partial<ReturnType<typeof MockDataFactory.project>>,
) => MockDataFactory.project(overrides);

export const mockUser = (
  overrides?: Partial<ReturnType<typeof MockDataFactory.user>>,
) => MockDataFactory.user(overrides);

export const mockJob = (overrides?: Partial<Prisma.JobCreateInput>) =>
  MockDataFactory.job(overrides);
