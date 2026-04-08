import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent } from '@prisma/client';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { ProjectSetupPage } from '@/components/projects/project-setup-page';
import type { ProjectSetupResponse } from '@/lib/project-setup/types';

function createSetupResponse(
  overrides: Partial<ProjectSetupResponse> = {}
): ProjectSetupResponse {
  return {
    projectId: 1,
    setupRequired: true,
    viewerCanManage: true,
    selectedAgentOptions: [Agent.CLAUDE, Agent.CODEX],
    credentialReadiness: {
      CLAUDE: {
        provider: 'ANTHROPIC',
        ready: true,
        readinessStatus: 'READY',
        message: 'Anthropic credential is ready.',
      },
      CODEX: {
        provider: 'OPENAI',
        ready: false,
        readinessStatus: 'MISSING',
        message: 'No OpenAI credential configured.',
      },
    },
    latestAttempt: null,
    ...overrides,
  };
}

describe('ProjectSetupPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the start form for an owner when setup is ready to begin', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(createSetupResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    renderWithProviders(
      <ProjectSetupPage projectId={1} projectName="[e2e] Setup Project" />
    );

    await waitFor(() => {
      expect(screen.getByText('Project Setup')).toBeInTheDocument();
      expect(screen.getByText('Start Project Setup')).toBeInTheDocument();
      expect(screen.getByTestId('project-setup-start-button')).toBeInTheDocument();
    });
  });

  it('renders read-only guidance for members', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify(
          createSetupResponse({
            viewerCanManage: false,
          })
        ),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    renderWithProviders(
      <ProjectSetupPage projectId={1} projectName="[e2e] Setup Project" />
    );

    await waitFor(() => {
      expect(screen.getByText('Read-only status')).toBeInTheDocument();
      expect(
        screen.getByText(/only the project owner can start or retry setup/i)
      ).toBeInTheDocument();
    });
  });

  it('renders running status details from persisted setup state', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify(
          createSetupResponse({
            latestAttempt: {
              id: 10,
              selectedAgent: Agent.CLAUDE,
              status: 'RUNNING',
              createdAt: '2026-04-08T12:00:00.000Z',
              startedAt: '2026-04-08T12:00:05.000Z',
              completedAt: null,
              elapsedSeconds: 42,
              resultMessage: 'Creating onboarding files',
              failureCode: null,
              failureMessage: null,
              artifactSummary: null,
            },
          })
        ),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    renderWithProviders(
      <ProjectSetupPage projectId={1} projectName="[e2e] Setup Project" />
    );

    await waitFor(() => {
      expect(screen.getByText('Project setup is running')).toBeInTheDocument();
      expect(screen.getByText('Creating onboarding files')).toBeInTheDocument();
      expect(screen.getByText('Elapsed time: 42s')).toBeInTheDocument();
    });
  });

  it('renders completion summary and board CTA', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify(
          createSetupResponse({
            setupRequired: false,
            latestAttempt: {
              id: 11,
              selectedAgent: Agent.CODEX,
              status: 'COMPLETED',
              createdAt: '2026-04-08T12:00:00.000Z',
              startedAt: '2026-04-08T12:00:05.000Z',
              completedAt: '2026-04-08T12:01:05.000Z',
              elapsedSeconds: 60,
              resultMessage: 'Created AI Board setup files',
              failureCode: null,
              failureMessage: null,
              artifactSummary: {
                created: ['.ai-board/config.yml'],
              },
            },
          })
        ),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    renderWithProviders(
      <ProjectSetupPage projectId={1} projectName="[e2e] Setup Project" />
    );

    await waitFor(() => {
      expect(screen.getByText('Project setup completed')).toBeInTheDocument();
      expect(screen.getByText('Artifact summary')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /open board/i })).toBeInTheDocument();
    });
  });
});
