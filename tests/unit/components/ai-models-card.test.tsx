/**
 * RTL Component Tests: AIModelsCard
 *
 * Verifies Claude/non-Claude rendering branches for the project Settings
 * card that configures per-stage Claude model defaults.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { AIModelsCard } from '@/components/settings/ai-models-card';
import { Agent } from '@prisma/client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe('AIModelsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders five stage rows when default agent is Claude', () => {
    renderWithProviders(
      <AIModelsCard
        project={{
          id: 42,
          defaultAgent: Agent.CLAUDE,
          claudeModels: { specify: 'claude-opus-4-7' },
        }}
      />
    );

    expect(screen.getByTestId('ai-models-card')).toBeInTheDocument();
    expect(screen.getByTestId('ai-models-row-specify')).toBeInTheDocument();
    expect(screen.getByTestId('ai-models-row-plan')).toBeInTheDocument();
    expect(screen.getByTestId('ai-models-row-implement')).toBeInTheDocument();
    expect(screen.getByTestId('ai-models-row-quickImpl')).toBeInTheDocument();
    expect(screen.getByTestId('ai-models-row-verify')).toBeInTheDocument();
    expect(
      screen.queryByTestId('ai-models-non-claude-message')
    ).not.toBeInTheDocument();
  });

  it('renders non-Claude informational message for Codex', () => {
    renderWithProviders(
      <AIModelsCard
        project={{
          id: 43,
          defaultAgent: Agent.CODEX,
          claudeModels: null,
        }}
      />
    );

    const message = screen.getByTestId('ai-models-non-claude-message');
    expect(message).toBeInTheDocument();
    expect(message.textContent).toContain('Codex');
    expect(message.textContent).toContain('Per-stage selection is only available for Claude');
    expect(screen.queryByTestId('ai-models-row-specify')).not.toBeInTheDocument();
  });

  it('renders non-Claude informational message for Mistral', () => {
    renderWithProviders(
      <AIModelsCard
        project={{
          id: 44,
          defaultAgent: Agent.MISTRAL,
          claudeModels: null,
        }}
      />
    );

    expect(screen.getByTestId('ai-models-non-claude-message').textContent).toContain(
      'Mistral'
    );
  });
});
