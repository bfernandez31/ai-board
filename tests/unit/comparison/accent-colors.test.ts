import { describe, expect, it } from 'vitest';
import { getAccentColorByRank } from '@/lib/comparison/accent-colors';
import type { AccentColorSet } from '@/lib/comparison/accent-colors';

describe('getAccentColorByRank', () => {
  it('returns green color set for rank 1', () => {
    const colors = getAccentColorByRank(1);
    expect(colors.text).toBe('text-ctp-green');
    expect(colors.bgSubtle).toBe('bg-ctp-green/10');
    expect(colors.bgMedium).toBe('bg-ctp-green/20');
    expect(colors.border).toBe('border-ctp-green/20');
    expect(colors.ring).toBe('ring-ctp-green/30');
    expect(colors.hsl).toBe('hsl(var(--ctp-green))');
    expect(colors.label).toBe('Green');
  });

  it('returns blue color set for rank 2', () => {
    const colors = getAccentColorByRank(2);
    expect(colors.text).toBe('text-ctp-blue');
    expect(colors.label).toBe('Blue');
  });

  it('returns mauve color set for rank 3', () => {
    const colors = getAccentColorByRank(3);
    expect(colors.text).toBe('text-ctp-mauve');
    expect(colors.label).toBe('Mauve');
  });

  it('returns peach color set for rank 4', () => {
    const colors = getAccentColorByRank(4);
    expect(colors.text).toBe('text-ctp-peach');
    expect(colors.label).toBe('Peach');
  });

  it('returns pink color set for rank 5', () => {
    const colors = getAccentColorByRank(5);
    expect(colors.text).toBe('text-ctp-pink');
    expect(colors.label).toBe('Pink');
  });

  it('returns yellow color set for rank 6', () => {
    const colors = getAccentColorByRank(6);
    expect(colors.text).toBe('text-ctp-yellow');
    expect(colors.label).toBe('Yellow');
  });

  it('falls back to rank 6 for out-of-range rank (0)', () => {
    const colors = getAccentColorByRank(0);
    expect(colors.text).toBe('text-ctp-yellow');
    expect(colors.label).toBe('Yellow');
  });

  it('falls back to rank 6 for out-of-range rank (7)', () => {
    const colors = getAccentColorByRank(7);
    expect(colors.text).toBe('text-ctp-yellow');
    expect(colors.label).toBe('Yellow');
  });

  it('returns all required fields in AccentColorSet', () => {
    const colors = getAccentColorByRank(1);
    const keys: (keyof AccentColorSet)[] = ['text', 'bgSubtle', 'bgMedium', 'border', 'ring', 'shadow', 'hsl', 'label'];
    for (const key of keys) {
      expect(colors[key]).toBeDefined();
      expect(typeof colors[key]).toBe('string');
    }
  });

  it('includes shadow class with box-shadow syntax', () => {
    const colors = getAccentColorByRank(1);
    expect(colors.shadow).toContain('shadow-[');
    expect(colors.shadow).toContain('hsl(var(--ctp-green))');
  });
});
