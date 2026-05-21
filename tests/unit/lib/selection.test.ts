import { describe, it, expect } from 'vitest';
import {
  computeRangeSelection,
  mergeAttachments,
  buildFusionDescription,
} from '@/lib/board/selection';
import type { TicketWithVersion } from '@/lib/types';

function ticket(id: number, overrides: Partial<TicketWithVersion> = {}): TicketWithVersion {
  return {
    id,
    ticketNumber: id,
    ticketKey: `AIB-${id}`,
    title: `Ticket ${id}`,
    description: `Body ${id}`,
    stage: 'INBOX',
    version: 1,
    projectId: 1,
    branch: null,
    autoMode: false,
    clarificationPolicy: null,
    agent: null,
    specifyModel: null,
    planModel: null,
    implementModel: null,
    quickImplModel: null,
    verifyModel: null,
    workflowType: 'FULL',
    attachments: [],
    qualityScore: null,
    createdAt: '2026-05-21T00:00:00Z',
    updatedAt: '2026-05-21T00:00:00Z',
    ...overrides,
  } as TicketWithVersion;
}

const ATTACH_PNG = (url: string) => ({
  type: 'uploaded' as const,
  url,
  filename: url.split('/').pop() ?? url,
  mimeType: 'image/png',
  sizeBytes: 100,
  uploadedAt: '2026-05-21T00:00:00Z',
});

describe('computeRangeSelection', () => {
  const tickets = [ticket(1), ticket(2), ticket(3), ticket(4), ticket(5)];

  it('toggles only the clicked id when there is no anchor', () => {
    const next = computeRangeSelection(tickets, null, 3, new Set(), false);
    expect(Array.from(next)).toEqual([3]);
  });

  it('removes the clicked id when already selected (no shift)', () => {
    const next = computeRangeSelection(tickets, null, 3, new Set([3]), false);
    expect(next.size).toBe(0);
  });

  it('does not start a range when shift is true but anchor is null', () => {
    const next = computeRangeSelection(tickets, null, 3, new Set([1]), true);
    expect(Array.from(next).sort()).toEqual([1, 3]);
  });

  it('selects forward range with shift-click without clearing prior selection', () => {
    const next = computeRangeSelection(tickets, 2, 4, new Set([1]), true);
    expect(Array.from(next).sort()).toEqual([1, 2, 3, 4]);
  });

  it('selects backward range with shift-click', () => {
    const next = computeRangeSelection(tickets, 4, 2, new Set(), true);
    expect(Array.from(next).sort()).toEqual([2, 3, 4]);
  });

  it('toggles when shift-click on the anchor itself', () => {
    const next = computeRangeSelection(tickets, 2, 2, new Set([2]), true);
    expect(next.has(2)).toBe(false);
  });
});

describe('mergeAttachments', () => {
  it('orders anchor first, then absorbed by ascending id', () => {
    const tickets = [
      ticket(2, { attachments: [ATTACH_PNG('https://x/img2.png')] }),
      ticket(1, { attachments: [ATTACH_PNG('https://x/img1.png')] }),
      ticket(3, { attachments: [ATTACH_PNG('https://x/img3.png')] }),
    ];
    const { merged, clippedCount } = mergeAttachments(tickets, 2, 5);
    expect(merged.map((m) => m.url)).toEqual([
      'https://x/img2.png',
      'https://x/img1.png',
      'https://x/img3.png',
    ]);
    expect(clippedCount).toBe(0);
  });

  it('deduplicates attachments by URL across tickets', () => {
    const dup = ATTACH_PNG('https://x/shared.png');
    const tickets = [
      ticket(1, { attachments: [dup] }),
      ticket(2, { attachments: [dup, ATTACH_PNG('https://x/a.png')] }),
    ];
    const { merged, clippedCount } = mergeAttachments(tickets, 1, 5);
    expect(merged.map((m) => m.url)).toEqual(['https://x/shared.png', 'https://x/a.png']);
    expect(clippedCount).toBe(0);
  });

  it('clips to the cap and reports clippedCount', () => {
    const tickets = [
      ticket(1, {
        attachments: [
          ATTACH_PNG('https://x/a.png'),
          ATTACH_PNG('https://x/b.png'),
          ATTACH_PNG('https://x/c.png'),
        ],
      }),
      ticket(2, {
        attachments: [
          ATTACH_PNG('https://x/d.png'),
          ATTACH_PNG('https://x/e.png'),
          ATTACH_PNG('https://x/f.png'),
        ],
      }),
    ];
    const { merged, clippedCount } = mergeAttachments(tickets, 1, 5);
    expect(merged).toHaveLength(5);
    expect(clippedCount).toBe(1);
  });
});

describe('buildFusionDescription', () => {
  it('emits the FR-009 separator and heading for each absorbed ticket in ascending id', () => {
    const tickets = [
      ticket(1, { description: 'Anchor body', ticketKey: 'AIB-1', title: 'Alpha' }),
      ticket(3, { description: 'Third body', ticketKey: 'AIB-3', title: 'Gamma' }),
      ticket(2, { description: 'Second body', ticketKey: 'AIB-2', title: 'Beta' }),
    ];
    const result = buildFusionDescription(tickets, 1);
    expect(result).toBe(
      'Anchor body' +
        '\n\n---\n\n## [AIB-2] Beta\n\nSecond body' +
        '\n\n---\n\n## [AIB-3] Gamma\n\nThird body',
    );
  });

  it('handles null/empty descriptions as empty strings', () => {
    const tickets = [
      ticket(1, { description: null, ticketKey: 'AIB-1', title: 'Alpha' }),
      ticket(2, { description: '', ticketKey: 'AIB-2', title: 'Beta' }),
    ];
    const result = buildFusionDescription(tickets, 1);
    expect(result).toBe('\n\n---\n\n## [AIB-2] Beta\n\n');
  });
});
