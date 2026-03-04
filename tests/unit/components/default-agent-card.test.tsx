/**
 * RTL Component Tests: DefaultAgentCard
 *
 * Tests for the default agent settings card component.
 * Verifies rendering and structure (Select interaction tested via integration).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { DefaultAgentCard } from '@/components/settings/default-agent-card';
import { Agent } from '@prisma/client';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe('DefaultAgentCard', () => {
  const defaultProps = {
    project: {
      id: 1,
      defaultAgent: Agent.CLAUDE,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should display card title and description', () => {
      renderWithProviders(<DefaultAgentCard {...defaultProps} />);

      expect(screen.getByText('Default AI Agent')).toBeInTheDocument();
      expect(screen.getByText(/applied to all new tickets/i)).toBeInTheDocument();
    });

    it('should render the select trigger element', () => {
      renderWithProviders(<DefaultAgentCard {...defaultProps} />);

      const trigger = screen.getByTestId('agent-select-trigger');
      expect(trigger).toBeInTheDocument();
    });

    it('should render with CODEX as default agent', () => {
      renderWithProviders(
        <DefaultAgentCard project={{ id: 2, defaultAgent: Agent.CODEX }} />
      );

      expect(screen.getByText('Default AI Agent')).toBeInTheDocument();
      const trigger = screen.getByTestId('agent-select-trigger');
      expect(trigger).toBeInTheDocument();
    });

    it('should have a combobox role for the select', () => {
      renderWithProviders(<DefaultAgentCard {...defaultProps} />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });
});
