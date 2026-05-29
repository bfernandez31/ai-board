/**
 * RTL Component Tests: AIModelsCard
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { AIModelsCard } from '@/components/settings/ai-models-card';
import { Agent } from '@prisma/client';

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

const claudeProject = {
  id: 1,
  defaultAgent: Agent.CLAUDE,
  specifyModel: null,
  planModel: null,
  implementModel: null,
  quickImplModel: null,
  verifyModel: null,
};

const geminiProject = {
  id: 2,
  defaultAgent: Agent.GEMINI,
  specifyModel: 'claude-sonnet-4-6',
  planModel: null,
  implementModel: null,
  quickImplModel: null,
  verifyModel: null,
};

describe('AIModelsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a row for every stage when defaultAgent is CLAUDE', () => {
    renderWithProviders(<AIModelsCard project={claudeProject} />);

    expect(screen.getByTestId('model-row-specifyModel')).toBeInTheDocument();
    expect(screen.getByTestId('model-row-planModel')).toBeInTheDocument();
    expect(screen.getByTestId('model-row-implementModel')).toBeInTheDocument();
    expect(screen.getByTestId('model-row-quickImplModel')).toBeInTheDocument();
    expect(screen.getByTestId('model-row-verifyModel')).toBeInTheDocument();
  });

  it('renders the apply-smart-defaults button when CLAUDE', () => {
    renderWithProviders(<AIModelsCard project={claudeProject} />);

    expect(screen.getByTestId('apply-smart-defaults')).toBeInTheDocument();
  });

  it('renders informational message when defaultAgent is not configurable (Gemini)', () => {
    renderWithProviders(<AIModelsCard project={geminiProject} />);

    expect(screen.getByTestId('ai-models-card-inactive')).toBeInTheDocument();
    expect(screen.queryByTestId('model-row-specifyModel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('apply-smart-defaults')).not.toBeInTheDocument();
  });

  it('renders a row for every stage when defaultAgent is CODEX', () => {
    const codexProject = { ...claudeProject, defaultAgent: Agent.CODEX };
    renderWithProviders(<AIModelsCard project={codexProject} />);

    expect(screen.queryByTestId('ai-models-card-inactive')).not.toBeInTheDocument();
    expect(screen.getByTestId('model-row-specifyModel')).toBeInTheDocument();
    expect(screen.getByTestId('model-row-planModel')).toBeInTheDocument();
    expect(screen.getByTestId('model-row-implementModel')).toBeInTheDocument();
    expect(screen.getByTestId('model-row-quickImplModel')).toBeInTheDocument();
    expect(screen.getByTestId('model-row-verifyModel')).toBeInTheDocument();
    expect(screen.getByTestId('apply-smart-defaults')).toBeInTheDocument();
  });

  it('renders stored Codex per-stage value labels when defaultAgent is CODEX', () => {
    const seededProject = {
      ...claudeProject,
      defaultAgent: Agent.CODEX,
      specifyModel: 'gpt-5.5',
      implementModel: 'gpt-5.4-codex',
    };
    renderWithProviders(<AIModelsCard project={seededProject} />);

    expect(screen.getByText('GPT-5.5')).toBeInTheDocument();
    expect(screen.getByText('GPT-5.4 Codex')).toBeInTheDocument();
  });

  it('renders stored per-stage values in the trigger labels', () => {
    const seededProject = {
      ...claudeProject,
      specifyModel: 'claude-opus-4-7',
      implementModel: 'claude-sonnet-4-6',
    };
    renderWithProviders(<AIModelsCard project={seededProject} />);

    expect(screen.getByText('Claude Opus 4.7')).toBeInTheDocument();
    expect(screen.getByText('Claude Sonnet 4.6')).toBeInTheDocument();
  });
});
