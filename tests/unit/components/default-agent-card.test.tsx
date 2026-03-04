import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { DefaultAgentCard } from '@/components/settings/default-agent-card';
import { Agent } from '@prisma/client';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
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
    global.fetch = vi.fn();
  });

  describe('Rendering', () => {
    it('should display card title and description', () => {
      renderWithProviders(<DefaultAgentCard {...defaultProps} />);

      expect(screen.getByText('Default Agent')).toBeInTheDocument();
      expect(screen.getByText(/applied to all new tickets/i)).toBeInTheDocument();
    });

    it('should render select trigger', () => {
      renderWithProviders(<DefaultAgentCard {...defaultProps} />);

      expect(screen.getByTestId('agent-select-trigger')).toBeInTheDocument();
    });
  });
});
