/**
 * ProjectCard Component Tests
 *
 * Tests for the ProjectCard component which displays project information.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../helpers/render-helpers';
import { createMockProject } from '../helpers/factories';
import { ProjectCard } from '@/components/projects/project-card';
import type { ProjectWithCount } from '@/app/lib/types/project';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock the copy to clipboard hook
const mockCopy = vi.fn();
let mockIsCopied = false;
vi.mock('@/app/lib/hooks/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({
    copy: (text: string) => {
      mockCopy(text);
      mockIsCopied = true;
    },
    isCopied: mockIsCopied,
  }),
}));

// Mock ProjectMenu to avoid additional dependencies
vi.mock('@/components/project/ProjectMenu', () => ({
  ProjectMenu: () => <div data-testid="project-menu">Menu</div>,
}));

describe('ProjectCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCopied = false;
  });

  const createProjectWithCount = (
    overrides: Partial<ProjectWithCount> = {}
  ): ProjectWithCount => {
    const project = createMockProject({
      id: 1,
      name: 'Test Project',
      key: 'ABC',
      githubOwner: 'test-owner',
      githubRepo: 'test-repo',
      ...overrides,
    });

    return {
      ...project,
      ticketCount: overrides.ticketCount ?? project.ticketCount ?? 5,
      lastShippedTicket: overrides.lastShippedTicket ?? null,
    } as ProjectWithCount;
  };

  describe('rendering', () => {
    it('displays project name', () => {
      const project = createProjectWithCount({ name: 'My Awesome Project' });

      renderWithProviders(<ProjectCard project={project} />);

      expect(screen.getByTestId('project-name')).toHaveTextContent('My Awesome Project');
    });

    it('displays GitHub repository link', () => {
      const project = createProjectWithCount({
        githubOwner: 'my-org',
        githubRepo: 'my-repo',
      });

      renderWithProviders(<ProjectCard project={project} />);

      expect(screen.getByTestId('github-link')).toHaveTextContent('my-org/my-repo');
    });

    it('displays ticket count when shipped ticket exists', () => {
      const project = createProjectWithCount({
        ticketCount: 10,
        lastShippedTicket: {
          id: 1,
          ticketKey: 'ABC-1',
          title: 'Shipped ticket',
          updatedAt: new Date().toISOString(),
        },
      } as Partial<ProjectWithCount>);

      renderWithProviders(<ProjectCard project={project} />);

      expect(screen.getByTestId('ticket-count')).toHaveTextContent('10 total');
    });

    it('shows empty state when no shipped tickets', () => {
      const project = createProjectWithCount({
        lastShippedTicket: null,
        ticketCount: 5,
      });

      renderWithProviders(<ProjectCard project={project} />);

      expect(screen.getByTestId('no-shipped-tickets')).toHaveTextContent(
        'No tickets shipped yet · 5 total'
      );
    });

    it('shows different message when no tickets at all', () => {
      const project = createProjectWithCount({
        lastShippedTicket: null,
        ticketCount: 0,
      });

      renderWithProviders(<ProjectCard project={project} />);

      expect(screen.getByTestId('no-shipped-tickets')).toHaveTextContent(
        'No tickets yet'
      );
    });

    it('displays last shipped ticket information', () => {
      const project = createProjectWithCount({
        lastShippedTicket: {
          id: 1,
          ticketKey: 'ABC-42',
          title: 'Implement feature X',
          updatedAt: new Date().toISOString(),
        },
      } as Partial<ProjectWithCount>);

      renderWithProviders(<ProjectCard project={project} />);

      expect(screen.getByTestId('shipped-ticket-key')).toHaveTextContent('ABC-42');
      expect(screen.getByTestId('shipped-ticket-title')).toHaveTextContent(
        'Implement feature X'
      );
    });

    it('displays deployment URL section when available', () => {
      const project = createProjectWithCount({
        deploymentUrl: 'https://my-app.vercel.app',
      });

      renderWithProviders(<ProjectCard project={project} />);

      expect(screen.getByTestId('deployment-section')).toBeInTheDocument();
      expect(screen.getByTestId('deployment-url')).toHaveTextContent('my-app.vercel.app');
    });

    it('does not show deployment section when no URL', () => {
      const project = createProjectWithCount({ deploymentUrl: null });

      renderWithProviders(<ProjectCard project={project} />);

      expect(screen.queryByTestId('deployment-section')).not.toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('navigates to project board when card is clicked', async () => {
      const user = userEvent.setup();
      const project = createProjectWithCount({ id: 42 });

      renderWithProviders(<ProjectCard project={project} />);

      await user.click(screen.getByTestId('project-card'));

      expect(mockPush).toHaveBeenCalledWith('/projects/42/board');
    });

    it('copies deployment URL when copy button is clicked', async () => {
      const user = userEvent.setup();
      const project = createProjectWithCount({
        deploymentUrl: 'https://my-app.vercel.app',
      });

      renderWithProviders(<ProjectCard project={project} />);

      await user.click(screen.getByTestId('copy-deployment-url'));

      expect(mockCopy).toHaveBeenCalledWith('https://my-app.vercel.app');
    });

    it('does not navigate when copy button is clicked', async () => {
      const user = userEvent.setup();
      const project = createProjectWithCount({
        id: 42,
        deploymentUrl: 'https://my-app.vercel.app',
      });

      renderWithProviders(<ProjectCard project={project} />);

      await user.click(screen.getByTestId('copy-deployment-url'));

      // Copy should be called but navigation should not
      expect(mockCopy).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('data-testid', () => {
    it('has correct data-testid for card', () => {
      const project = createProjectWithCount();

      renderWithProviders(<ProjectCard project={project} />);

      expect(screen.getByTestId('project-card')).toBeInTheDocument();
    });

    it('includes project id as data attribute', () => {
      const project = createProjectWithCount({ id: 123 });

      renderWithProviders(<ProjectCard project={project} />);

      const card = screen.getByTestId('project-card');
      expect(card).toHaveAttribute('data-project-id', '123');
    });
  });
});
