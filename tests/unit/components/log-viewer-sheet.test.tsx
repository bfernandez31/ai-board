import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gzipSync } from 'node:zlib';
import { renderWithProviders, screen, userEvent, waitFor } from '@/tests/utils/component-test-utils';
import { LogViewerSheet } from '@/components/ticket/log-viewer-sheet';
import type { NormalizedEvent } from '@/app/lib/logs/schema';

const HEADER = {
  schemaVersion: 1,
  agent: 'CLAUDE' as const,
  jobId: 42,
  startedAt: '2026-04-22T10:00:00.000Z',
  endedAt: '2026-04-22T10:00:05.000Z',
};

function buildArtifact(events: NormalizedEvent[]): Uint8Array {
  const lines = [JSON.stringify(HEADER), ...events.map((e) => JSON.stringify(e))].join('\n') + '\n';
  return gzipSync(Buffer.from(lines));
}

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

const SAMPLE_EVENTS: NormalizedEvent[] = [
  { ts: HEADER.startedAt, type: 'lifecycle', agent: 'CLAUDE', payload: { kind: 'started' } },
  {
    ts: HEADER.startedAt,
    type: 'message',
    agent: 'CLAUDE',
    payload: { role: 'agent', text: 'Hello world' },
  },
  {
    ts: HEADER.startedAt,
    type: 'tool_invocation',
    agent: 'CLAUDE',
    payload: { toolName: 'Bash', toolCallId: 'tu_1', input: { command: 'ls' } },
  },
  {
    ts: HEADER.startedAt,
    type: 'tool_result',
    agent: 'CLAUDE',
    payload: { toolCallId: 'tu_1', output: 'file1\nfile2', isError: false },
  },
  {
    ts: HEADER.startedAt,
    type: 'error',
    agent: 'CLAUDE',
    payload: { message: 'boom' },
  },
];

describe('LogViewerSheet (AIB-715 US3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all five event types with distinct test IDs when open', async () => {
    const artifact = buildArtifact(SAMPLE_EVENTS);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(streamOf(artifact), {
        status: 200,
        headers: { 'content-type': 'application/gzip' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(
      <LogViewerSheet
        open
        onOpenChange={() => {}}
        projectId={1}
        ticketId={2}
        jobId={42}
        commandLabel="implement"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('log-event-row-message')).toBeInTheDocument();
    });
    expect(screen.getByTestId('log-event-row-tool_invocation')).toBeInTheDocument();
    expect(screen.getByTestId('log-event-row-tool_result')).toBeInTheDocument();
    expect(screen.getByTestId('log-event-row-error')).toBeInTheDocument();
    expect(screen.getAllByTestId('log-event-row-lifecycle').length).toBeGreaterThan(0);
  });

  it('per-row copy button calls navigator.clipboard.writeText', async () => {
    const artifact = buildArtifact(SAMPLE_EVENTS.slice(0, 2));
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(streamOf(artifact), {
        status: 200,
        headers: { 'content-type': 'application/gzip' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderWithProviders(
      <LogViewerSheet
        open
        onOpenChange={() => {}}
        projectId={1}
        ticketId={2}
        jobId={42}
        commandLabel="implement"
      />
    );

    const copyButton = await screen.findByTestId('log-event-copy-message');
    await userEvent.click(copyButton);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
  });

  it('renders Download raw anchor with the correct href + download attributes', async () => {
    const artifact = buildArtifact(SAMPLE_EVENTS.slice(0, 1));
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(streamOf(artifact), {
        status: 200,
        headers: { 'content-type': 'application/gzip' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(
      <LogViewerSheet
        open
        onOpenChange={() => {}}
        projectId={7}
        ticketId={11}
        jobId={99}
        commandLabel="implement"
      />
    );

    // The download element is rendered as a disabled <Button> during loading
    // and swaps to an <a> wrapping an enabled <Button> once data resolves.
    // Wait for the enabled anchor form to appear before asserting the href.
    const anchor = await waitFor(() => {
      const el = screen.getByTestId('log-viewer-download');
      expect(el.tagName).toBe('A');
      return el;
    });
    expect(anchor.getAttribute('href')).toBe(
      '/api/projects/7/tickets/11/jobs/99/logs/raw?format=jsonl'
    );
    expect(anchor.getAttribute('download')).toBe('job-99.jsonl.gz');
  });
});
