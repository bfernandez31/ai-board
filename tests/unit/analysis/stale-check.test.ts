import { describe, it, expect } from 'vitest';
import { isStale } from '@/lib/analysis/stale-check';

describe('isStale', () => {
  it('returns false for identical text', () => {
    expect(
      isStale(
        { title: 'A', description: 'D' },
        { titleSnapshot: 'A', descriptionSnapshot: 'D' }
      )
    ).toBe(false);
  });

  it('returns false for whitespace-only diff', () => {
    expect(
      isStale(
        { title: ' A   B ', description: 'one  two' },
        { titleSnapshot: 'A B', descriptionSnapshot: 'one two' }
      )
    ).toBe(false);
  });

  it('returns true for word-level diff in title', () => {
    expect(
      isStale(
        { title: 'A B C', description: 'D' },
        { titleSnapshot: 'A B', descriptionSnapshot: 'D' }
      )
    ).toBe(true);
  });

  it('returns true for word-level diff in description', () => {
    expect(
      isStale(
        { title: 'A', description: 'one two three' },
        { titleSnapshot: 'A', descriptionSnapshot: 'one two' }
      )
    ).toBe(true);
  });

  it('returns false after revert to snapshot', () => {
    const snap = { titleSnapshot: 'A', descriptionSnapshot: 'orig' };
    const edited = { title: 'B', description: 'edited' };
    const reverted = { title: 'A', description: 'orig' };
    expect(isStale(edited, snap)).toBe(true);
    expect(isStale(reverted, snap)).toBe(false);
  });
});
