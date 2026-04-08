/**
 * RTL Component Tests: ConfigCard
 *
 * Tests the config display card in project settings.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/tests/utils/component-test-utils';
import { ConfigCard } from '@/components/settings/config-card';
import { OnboardingArtifactsCard } from '@/components/settings/onboarding-artifacts-card';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ConfigCard', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  const configProject = {
    id: 1,
    config: {
      version: 1,
      project: { name: 'my-app', language: 'typescript', framework: 'nextjs' },
      runtime: { manager: 'bun', manager_version: '1.3.0' },
      services: [
        { type: 'postgres', version: '14' },
        { type: 'redis', version: '7' },
      ],
      agent: { cli: 'claude-code', model: 'claude-sonnet-4-6' },
    },
    configSyncedAt: '2026-04-02T12:00:00.000Z',
  };

  const emptyProject = {
    id: 1,
    config: null,
    configSyncedAt: null,
  };

  describe('with config', () => {
    it('renders runtime badges', () => {
      renderWithProviders(<ConfigCard project={configProject} />);
      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(screen.getByText('nextjs')).toBeInTheDocument();
      expect(screen.getByText('bun v1.3.0')).toBeInTheDocument();
    });

    it('renders service badges', () => {
      renderWithProviders(<ConfigCard project={configProject} />);
      expect(screen.getByText('postgres 14')).toBeInTheDocument();
      expect(screen.getByText('redis 7')).toBeInTheDocument();
    });

    it('renders agent info', () => {
      renderWithProviders(<ConfigCard project={configProject} />);
      expect(screen.getByText('claude-code')).toBeInTheDocument();
      expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument();
    });

    it('renders last synced timestamp', () => {
      renderWithProviders(<ConfigCard project={configProject} />);
      expect(screen.getByText(/Last synced:/)).toBeInTheDocument();
    });
  });

  describe('without config', () => {
    it('renders empty state message', () => {
      renderWithProviders(<ConfigCard project={emptyProject} />);
      expect(screen.getByText('No configuration synced yet.')).toBeInTheDocument();
    });

    it('renders sync button', () => {
      renderWithProviders(<ConfigCard project={emptyProject} />);
      expect(screen.getByTestId('sync-config-button')).toBeInTheDocument();
    });
  });

  describe('sync button interaction', () => {
    it('calls sync API on click and updates display', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          config: configProject.config,
          syncedAt: '2026-04-02T13:00:00.000Z',
          warnings: [],
        }),
      });

      const user = userEvent.setup();
      renderWithProviders(<ConfigCard project={emptyProject} />);

      await user.click(screen.getByTestId('sync-config-button'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/projects/1/config/sync', {
          method: 'POST',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('typescript')).toBeInTheDocument();
      });
    });

    it('shows error message on sync failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'No .ai-board/config.yml found in repository' }),
      });

      const user = userEvent.setup();
      renderWithProviders(<ConfigCard project={emptyProject} />);

      await user.click(screen.getByTestId('sync-config-button'));

      await waitFor(() => {
        expect(screen.getByText('No .ai-board/config.yml found in repository')).toBeInTheDocument();
      });
    });
  });

  describe('onboarding artifacts review (T033)', () => {
    it('renders editable onboarding artifacts and saves updates', async () => {
      mockFetch.mockImplementation((input, init) => {
        const url = typeof input === 'string' ? input : (input as Request).url;

        if (url.includes('/settings/onboarding-artifacts') && (!init?.method || init.method === 'GET')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              artifacts: [
                {
                  path: '.ai-board/config.yml',
                  kind: 'config',
                  status: 'generated',
                  content: 'version: 1\n',
                  editable: true,
                  sha: 'abc123',
                },
              ],
            }),
          });
        }

        if (url.includes('/settings/onboarding-artifacts') && init?.method === 'PATCH') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ commitSha: 'def456', updatedPaths: ['.ai-board/config.yml'] }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const user = userEvent.setup();
      renderWithProviders(<OnboardingArtifactsCard projectId={1} />);

      expect(await screen.findByText('.ai-board/config.yml')).toBeInTheDocument();

      const editor = screen.getByRole('textbox');
      await user.clear(editor);
      await user.type(editor, 'version: 2');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/projects/1/settings/onboarding-artifacts',
          expect.objectContaining({
            method: 'PATCH',
          })
        );
      });
    });
  });
});
