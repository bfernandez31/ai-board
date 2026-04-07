import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProjectCard } from '@/components/projects/project-card';
import {
  renderWithProviders,
  screen,
  userEvent,
} from '@/tests/utils/component-test-utils';
import type { ProjectWithCount } from '@/app/lib/types/project';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/lib/hooks/use-has-mounted', () => ({
  useHasMounted: () => true,
}));

vi.mock('@/components/project/ProjectMenu', () => ({
  ProjectMenu: ({ projectId }: { projectId: number }) => (
    <button type="button" data-testid={`project-menu-${projectId}`}>
      Menu
    </button>
  ),
}));

function createProject(
  overrides: Partial<ProjectWithCount> = {},
): ProjectWithCount {
  return {
    id: 42,
    key: 'AIB',
    name: 'AI Board',
    description: 'Project dashboard',
    githubOwner: 'openai',
    githubRepo: 'ai-board',
    deploymentUrl: 'https://ai-board.example.com',
    updatedAt: '2026-04-07T12:30:00.000Z',
    ticketCount: 18,
    lastShippedTicket: {
      id: 98,
      ticketKey: 'AIB-540',
      title: 'Ship review quality dashboard',
      updatedAt: '2026-04-06T17:00:00.000Z',
    },
    healthSummary: {
      globalScore: 81,
      label: 'Good',
      color: {
        text: 'text-ctp-blue',
        bg: 'bg-ctp-blue/10',
        fill: 'bg-ctp-blue',
      },
      subScores: {
        security: 88,
        compliance: 91,
        tests: 74,
        specSync: 70,
        qualityGate: 79,
        reviewQuality: 82,
      },
    },
    ...overrides,
  };
}

describe('ProjectCard', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('renders a scored health indicator with an accessible overall label', () => {
    renderWithProviders(<ProjectCard project={createProject()} />);

    expect(
      screen.getByRole('button', { name: 'Project health score: 81, Good' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('project-health-indicator')).toHaveTextContent(
      '81',
    );
  });

  it('renders the no-data heart state with a muted dash label', () => {
    renderWithProviders(
      <ProjectCard
        project={createProject({
          healthSummary: {
            globalScore: null,
            label: 'No data yet',
            color: {
              text: 'text-muted-foreground',
              bg: 'bg-muted',
              fill: 'bg-muted',
            },
            subScores: {
              security: null,
              compliance: null,
              tests: null,
              specSync: null,
              qualityGate: null,
              reviewQuality: null,
            },
          },
        })}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'Project health score: no data yet',
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('project-health-indicator')).toHaveTextContent(
      '—',
    );
  });

  it('shows six sub-score rows and renders missing values as dashes', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ProjectCard
        project={createProject({
          healthSummary: {
            globalScore: 72,
            label: 'Good',
            color: {
              text: 'text-ctp-blue',
              bg: 'bg-ctp-blue/10',
              fill: 'bg-ctp-blue',
            },
            subScores: {
              security: 88,
              compliance: null,
              tests: 74,
              specSync: null,
              qualityGate: 79,
              reviewQuality: 82,
            },
          },
        })}
      />,
    );

    await user.click(screen.getByTestId('project-health-indicator'));

    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.getByText('Tests')).toBeInTheDocument();
    expect(screen.getByText('Spec Sync')).toBeInTheDocument();
    expect(screen.getByText('Quality Gate')).toBeInTheDocument();
    expect(screen.getByText('Review Quality')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('keeps indicator clicks isolated while normal card clicks still navigate', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ProjectCard project={createProject()} />);

    await user.click(screen.getByTestId('project-health-indicator'));

    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByText('Project health')).toBeInTheDocument();

    await user.click(screen.getByTestId('project-card'));

    expect(mockPush).toHaveBeenCalledWith('/projects/42/board');
  });
});
