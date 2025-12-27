/**
 * Smoke Tests for Test Helper Infrastructure
 *
 * Validates that the test wrapper and render helpers work correctly
 * before implementing component tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery, useMutation } from '@tanstack/react-query';
import { renderWithProviders } from './render-helpers';
import { createTestQueryClient, TestWrapper } from './test-wrapper';
import {
  createMockTicket,
  createMockProject,
  createMockJob,
  createMockComment,
  createMockUser,
} from './factories';
import {
  createMockRouter,
  createMockSearchParams,
  setMockPathname,
  getMockPathname,
  resetMockPathname,
} from './next-mocks';

// =============================================================================
// Test Wrapper Tests
// =============================================================================

describe('TestWrapper', () => {
  it('provides QueryClient context to children', () => {
    function TestComponent() {
      const { data } = useQuery({
        queryKey: ['test'],
        queryFn: () => Promise.resolve('success'),
        enabled: false,
      });
      return <div>{data ?? 'no-data'}</div>;
    }

    renderWithProviders(<TestComponent />);

    // Component renders without error (context is available)
    expect(screen.getByText('no-data')).toBeInTheDocument();
  });

  it('creates isolated QueryClient per test', () => {
    const client1 = createTestQueryClient();
    const client2 = createTestQueryClient();

    expect(client1).not.toBe(client2);
  });

  it('configures QueryClient with no retries', () => {
    const client = createTestQueryClient();
    const defaultOptions = client.getDefaultOptions();

    expect(defaultOptions.queries?.retry).toBe(false);
    expect(defaultOptions.mutations?.retry).toBe(false);
  });
});

// =============================================================================
// Render Helpers Tests
// =============================================================================

describe('renderWithProviders', () => {
  it('returns queryClient for inspection', () => {
    function TestComponent() {
      return <div>Test</div>;
    }

    const { queryClient } = renderWithProviders(<TestComponent />);

    expect(queryClient).toBeDefined();
    expect(typeof queryClient.getQueryCache).toBe('function');
  });

  it('allows custom queryClient', () => {
    const customClient = createTestQueryClient();
    function TestComponent() {
      return <div>Test</div>;
    }

    const { queryClient } = renderWithProviders(<TestComponent />, {
      queryClient: customClient,
    });

    expect(queryClient).toBe(customClient);
  });

  it('supports user events', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    function TestComponent() {
      return <button onClick={onClick}>Click me</button>;
    }

    renderWithProviders(<TestComponent />);
    await user.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// Factory Tests
// =============================================================================

describe('Mock Factories', () => {
  describe('createMockTicket', () => {
    it('returns valid Ticket with defaults', () => {
      const ticket = createMockTicket();

      expect(ticket.id).toBe(1);
      expect(ticket.ticketKey).toBe('ABC-1');
      expect(ticket.title).toBe('Test Ticket');
      expect(ticket.stage).toBe('INBOX');
      expect(ticket.workflowType).toBe('FULL');
    });

    it('allows overrides', () => {
      const ticket = createMockTicket({
        ticketKey: 'XYZ-42',
        title: 'Custom Title',
        stage: 'VERIFY',
        workflowType: 'QUICK',
      });

      expect(ticket.ticketKey).toBe('XYZ-42');
      expect(ticket.title).toBe('Custom Title');
      expect(ticket.stage).toBe('VERIFY');
      expect(ticket.workflowType).toBe('QUICK');
    });

    it('supports jobs array', () => {
      const job = createMockJob({ status: 'RUNNING' });
      const ticket = createMockTicket({ jobs: [job] });

      expect(ticket.jobs).toHaveLength(1);
      expect(ticket.jobs![0].status).toBe('RUNNING');
    });
  });

  describe('createMockProject', () => {
    it('returns valid Project with defaults', () => {
      const project = createMockProject();

      expect(project.id).toBe(1);
      expect(project.key).toBe('ABC');
      expect(project.name).toBe('Test Project');
      expect(project.clarificationPolicy).toBe('AUTO');
    });

    it('supports ticketCount extension', () => {
      const project = createMockProject({ ticketCount: 5 });

      expect(project.ticketCount).toBe(5);
    });

    it('supports lastShippedTicket extension', () => {
      const project = createMockProject({
        lastShippedTicket: { title: 'Last Shipped' },
      });

      expect(project.lastShippedTicket?.title).toBe('Last Shipped');
    });
  });

  describe('createMockJob', () => {
    it('returns valid Job with defaults', () => {
      const job = createMockJob();

      expect(job.id).toBe(1);
      expect(job.command).toBe('specify');
      expect(job.status).toBe('COMPLETED');
    });

    it('allows status overrides', () => {
      const job = createMockJob({ status: 'RUNNING', command: 'plan' });

      expect(job.status).toBe('RUNNING');
      expect(job.command).toBe('plan');
    });
  });

  describe('createMockComment', () => {
    it('returns valid Comment with defaults', () => {
      const comment = createMockComment();

      expect(comment.id).toBe(1);
      expect(comment.content).toBe('Test comment content');
      expect(comment.authorId).toBe('user-1');
    });

    it('supports author extension', () => {
      const comment = createMockComment({
        author: { name: 'John Doe' },
      });

      expect(comment.author?.name).toBe('John Doe');
    });
  });

  describe('createMockUser', () => {
    it('returns valid User with defaults', () => {
      const user = createMockUser();

      expect(user.id).toBe('user-1');
      expect(user.name).toBe('Test User');
      expect(user.email).toBe('test@example.com');
    });
  });
});

// =============================================================================
// Next.js Mocks Tests
// =============================================================================

describe('Next.js Mocks', () => {
  beforeEach(() => {
    resetMockPathname();
  });

  describe('createMockRouter', () => {
    it('creates router with mock functions', () => {
      const router = createMockRouter();

      expect(typeof router.push).toBe('function');
      expect(typeof router.replace).toBe('function');
      expect(typeof router.back).toBe('function');
    });

    it('push returns resolved promise', async () => {
      const router = createMockRouter();

      const result = await router.push('/test');

      expect(result).toBe(true);
    });
  });

  describe('mockSearchParams', () => {
    it('creates URLSearchParams from object', () => {
      const params = createMockSearchParams({ page: '1', filter: 'active' });

      expect(params.get('page')).toBe('1');
      expect(params.get('filter')).toBe('active');
    });
  });

  describe('mockPathname', () => {
    it('defaults to root', () => {
      expect(getMockPathname()).toBe('/');
    });

    it('can be set and retrieved', () => {
      setMockPathname('/projects/1/board');

      expect(getMockPathname()).toBe('/projects/1/board');
    });

    it('resets to root', () => {
      setMockPathname('/some/path');
      resetMockPathname();

      expect(getMockPathname()).toBe('/');
    });
  });
});
