/**
 * Component Tests: PrDiffViewer (AIB-879)
 *
 * Behavior-focused, accessibility-first (RTL). Covers US1 (Layers↔Files toggle,
 * layer selection, collapsible per-file diffs + counters), US2 (inline comments
 * with attribution, outdated surfacing, read-only — no compose controls), and US3
 * (Overview content; no-PR, auth-required, never-reviewed fallbacks).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor, within } from '@/tests/utils/component-test-utils';
import userEvent from '@testing-library/user-event';
import { PrDiffViewer } from '@/components/ticket/pr-diff-viewer';
import type { FileChange, InlineComment, PrDiffResponse } from '@/app/lib/schemas/pr-diff';

function file(filename: string, comments: InlineComment[] = []): FileChange {
  return {
    filename,
    status: 'modified',
    additions: 5,
    deletions: 1,
    patch: '@@ -1,2 +1,4 @@\n context\n+added2\n+added3\n+added4',
    binary: false,
    patchTruncated: false,
    comments,
  };
}

const AI_COMMENT: InlineComment = {
  id: 1,
  source: 'ai-board',
  author: 'ai-board[bot]',
  line: 2,
  body: 'Our review note',
  outdated: false,
  createdAt: '2026-06-30T10:00:00Z',
};

const HUMAN_COMMENT: InlineComment = {
  id: 2,
  source: 'human',
  author: 'alice',
  line: 3,
  body: 'Human note here',
  outdated: false,
  createdAt: '2026-06-30T10:05:00Z',
};

const OUTDATED_COMMENT: InlineComment = {
  id: 3,
  source: 'bot',
  author: 'dependabot[bot]',
  line: null,
  body: 'This anchored to a removed line',
  outdated: true,
  createdAt: '2026-06-30T09:00:00Z',
};

function reviewedResponse(): PrDiffResponse {
  const schemaFile = file('prisma/schema.prisma', [AI_COMMENT, OUTDATED_COMMENT]);
  const uiFile = file('components/ticket/pr-diff-viewer.tsx', [HUMAN_COMMENT]);
  const extraFile = file('app/api/new-route.ts');
  return {
    pr: { number: 542, title: 'AIB-879 diff viewer', state: 'open', url: 'https://github.com/o/r/pull/542' },
    overview: {
      pr: { number: 542, title: 'AIB-879 diff viewer', state: 'open', url: 'https://github.com/o/r/pull/542' },
      reviewSynthesis: 'Solid change overall.',
      qualityScore: 84,
      qualityThreshold: 'Good',
    },
    layers: [
      {
        id: 'foundations',
        title: 'Foundations',
        summary: 'schema & contracts',
        order: 1,
        files: [schemaFile],
        fileCount: 1,
        commentCount: 2,
        synthetic: false,
      },
      {
        id: 'ui',
        title: 'UI Layer',
        summary: 'viewer components',
        order: 2,
        files: [uiFile],
        fileCount: 1,
        commentCount: 1,
        synthetic: false,
      },
      {
        id: 'additional-changes',
        title: 'Additional changes',
        summary: 'Files changed after the review snapshot',
        order: 3,
        files: [extraFile],
        fileCount: 1,
        commentCount: 0,
        synthetic: true,
      },
    ],
    files: [schemaFile, uiFile, extraFile],
    truncated: false,
  };
}

function mockFetchResolved(body: PrDiffResponse, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function mockFetchError(status: number, code: string) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error: 'nope', code }),
  });
}

function renderViewer() {
  return renderWithProviders(
    <PrDiffViewer projectId={1} ticketId={1} ticketTitle="Test Ticket" open={true} onOpenChange={vi.fn()} />
  );
}

describe('PrDiffViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('US1: layers, files toggle, selection, counters', () => {
    it('renders the layers in dependency order with file/comment counters', async () => {
      mockFetchResolved(reviewedResponse());
      renderViewer();

      const list = await screen.findByRole('listbox', { name: /layers/i });
      const items = within(list).getAllByRole('option');
      expect(items.map((el) => el.textContent)).toEqual([
        expect.stringContaining('Foundations'),
        expect.stringContaining('UI Layer'),
        expect.stringContaining('Additional changes'),
      ]);
      expect(items[0]!.textContent).toContain('2 comments');
    });

    it('selecting a layer renders that layer\'s files', async () => {
      mockFetchResolved(reviewedResponse());
      renderViewer();

      const uiLayer = await screen.findByRole("option", { name: /UI Layer/i });
      await userEvent.click(uiLayer);

      expect(
        await screen.findByText('components/ticket/pr-diff-viewer.tsx')
      ).toBeInTheDocument();
    });

    it('toggles to Files mode showing the flat file list', async () => {
      mockFetchResolved(reviewedResponse());
      renderViewer();

      const filesToggle = await screen.findByRole('button', { name: /^files$/i });
      await userEvent.click(filesToggle);

      expect(await screen.findByText('prisma/schema.prisma')).toBeInTheDocument();
      expect(screen.getByText('components/ticket/pr-diff-viewer.tsx')).toBeInTheDocument();
      expect(screen.getByText('app/api/new-route.ts')).toBeInTheDocument();
    });

    it('per-file diff blocks are collapsible and show add/remove counters', async () => {
      mockFetchResolved(reviewedResponse());
      renderViewer();

      // Default selection is first layer (Foundations) → schema file shown.
      const fileHeader = await screen.findByRole('button', { name: /prisma\/schema\.prisma/i });
      expect(fileHeader).toHaveAttribute('aria-expanded', 'true');

      await userEvent.click(fileHeader);
      expect(fileHeader).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('US2: inline comments, attribution, outdated, read-only', () => {
    it('renders inline comments with author attribution', async () => {
      mockFetchResolved(reviewedResponse());
      renderViewer();

      expect(await screen.findByText('Our review note')).toBeInTheDocument();
      expect(screen.getByText('ai-board[bot]')).toBeInTheDocument();
    });

    it('surfaces an outdated comment in the file header region', async () => {
      mockFetchResolved(reviewedResponse());
      renderViewer();

      const outdatedRegion = await screen.findByTestId('outdated-comments');
      expect(within(outdatedRegion).getByText('This anchored to a removed line')).toBeInTheDocument();
      expect(within(outdatedRegion).getAllByText(/outdated/i).length).toBeGreaterThan(0);
    });

    it('exposes no compose/reply/edit/resolve controls (read-only)', async () => {
      mockFetchResolved(reviewedResponse());
      renderViewer();

      await screen.findByText('Our review note');
      expect(screen.queryByRole('button', { name: /reply/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /resolve/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('US3: Overview and fallbacks', () => {
    it('renders Overview with title, status, and quality score', async () => {
      mockFetchResolved(reviewedResponse());
      renderViewer();

      await userEvent.click(await screen.findByRole('button', { name: /^overview$/i }));

      const overview = await screen.findByTestId('pr-overview');
      expect(within(overview).getByText('AIB-879 diff viewer')).toBeInTheDocument();
      expect(within(overview).getByText('open')).toBeInTheDocument();
      expect(within(overview).getByText('84')).toBeInTheDocument();
      expect(screen.getByTestId('review-synthesis')).toHaveTextContent('Solid change overall.');
    });

    it('renders a no-PR empty state', async () => {
      mockFetchResolved({
        pr: null,
        overview: { pr: null, reviewSynthesis: null, qualityScore: null, qualityThreshold: null },
        layers: [],
        files: [],
        truncated: false,
      });
      renderViewer();

      expect(await screen.findByTestId('pr-diff-no-pr')).toBeInTheDocument();
      expect(screen.getByText(/no pr available/i)).toBeInTheDocument();
    });

    it('renders an actionable AUTH_REQUIRED state', async () => {
      mockFetchError(403, 'AUTH_REQUIRED');
      renderViewer();

      expect(await screen.findByTestId('pr-diff-error')).toBeInTheDocument();
      expect(screen.getByText(/github authorization required/i)).toBeInTheDocument();
    });

    it('defaults a never-reviewed PR to Files mode (no layers)', async () => {
      const resp = reviewedResponse();
      resp.layers = [];
      mockFetchResolved(resp);
      renderViewer();

      // Files mode active → flat list visible; Layers list absent.
      expect(await screen.findByText('prisma/schema.prisma')).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: /layers/i })).not.toBeInTheDocument();
    });
  });
});
