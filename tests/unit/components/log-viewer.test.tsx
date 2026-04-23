import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { LogViewer } from '@/components/logs/log-viewer';

vi.mock('@/app/lib/hooks/queries/use-job-logs', () => ({
  useJobLogs: vi.fn().mockReturnValue({
    data: {
      jobId: 1,
      agentType: 'CLAUDE',
      entries: [
        { timestamp: '2026-04-23T10:15:30.000Z', eventType: 'message', content: 'Starting implementation...' },
        { timestamp: '2026-04-23T10:15:35.000Z', eventType: 'tool_invocation', content: 'Read file: src/index.ts' },
        { timestamp: '2026-04-23T10:16:00.000Z', eventType: 'error', content: 'TypeScript error: cannot find module' },
      ],
      entryCount: 3,
      rawSize: 500,
      truncated: false,
      createdAt: '2026-04-23T10:20:00.000Z',
    },
    isLoading: false,
    error: null,
  }),
}));

describe('LogViewer', () => {
  it('renders log entries chronologically', () => {
    renderWithProviders(
      <LogViewer
        open={true}
        onOpenChange={() => {}}
        jobId={1}
        jobCommand="specify"
        agentType="CLAUDE"
        timestamp="2026-04-23T10:15:30.000Z"
      />
    );

    expect(screen.getByText(/Starting implementation/)).toBeDefined();
    expect(screen.getByText(/Read file: src\/index.ts/)).toBeDefined();
    expect(screen.getByText(/TypeScript error/)).toBeDefined();
  });

  it('shows truncation indicator when truncated', async () => {
    const { useJobLogs } = await import('@/app/lib/hooks/queries/use-job-logs');
    vi.mocked(useJobLogs).mockReturnValue({
      data: {
        jobId: 1,
        agentType: 'CLAUDE',
        entries: [{ timestamp: '2026-04-23T10:15:30.000Z', eventType: 'message', content: 'Test' }],
        entryCount: 1,
        rawSize: 6000000,
        truncated: true,
        createdAt: '2026-04-23T10:20:00.000Z',
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useJobLogs>);

    renderWithProviders(
      <LogViewer
        open={true}
        onOpenChange={() => {}}
        jobId={1}
        jobCommand="specify"
        agentType="CLAUDE"
        timestamp="2026-04-23T10:15:30.000Z"
      />
    );

    expect(screen.getByText(/truncated/i)).toBeDefined();
  });

  it('shows loading skeleton when loading', async () => {
    const { useJobLogs } = await import('@/app/lib/hooks/queries/use-job-logs');
    vi.mocked(useJobLogs).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useJobLogs>);

    renderWithProviders(
      <LogViewer
        open={true}
        onOpenChange={() => {}}
        jobId={1}
        jobCommand="specify"
        agentType="CLAUDE"
        timestamp="2026-04-23T10:15:30.000Z"
      />
    );

    expect(screen.getByText(/Loading/i)).toBeDefined();
  });

  it('handles empty entries', async () => {
    const { useJobLogs } = await import('@/app/lib/hooks/queries/use-job-logs');
    vi.mocked(useJobLogs).mockReturnValue({
      data: {
        jobId: 1,
        agentType: 'CLAUDE',
        entries: [],
        entryCount: 0,
        rawSize: 0,
        truncated: false,
        createdAt: '2026-04-23T10:20:00.000Z',
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useJobLogs>);

    renderWithProviders(
      <LogViewer
        open={true}
        onOpenChange={() => {}}
        jobId={1}
        jobCommand="specify"
        agentType="CLAUDE"
        timestamp="2026-04-23T10:15:30.000Z"
      />
    );

    expect(screen.getByText(/No log entries/i)).toBeDefined();
  });
});
