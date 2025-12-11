import { describe, it, expect } from 'vitest';
import { createDuplicateTitle } from '@/lib/utils/ticket-title';

describe('createDuplicateTitle', () => {
  describe('short titles', () => {
    it('prefixes short title with "Copy of "', () => {
      expect(createDuplicateTitle('Fix bug')).toBe('Copy of Fix bug');
    });

    it('handles empty title', () => {
      expect(createDuplicateTitle('')).toBe('Copy of ');
    });

    it('handles single character title', () => {
      expect(createDuplicateTitle('X')).toBe('Copy of X');
    });
  });

  describe('boundary cases', () => {
    it('handles exactly 92 char titles without truncation', () => {
      const title = 'A'.repeat(92);
      const result = createDuplicateTitle(title);
      expect(result.length).toBe(100);
      expect(result).toBe(`Copy of ${'A'.repeat(92)}`);
    });

    it('allows exactly 92 characters (no truncation needed)', () => {
      const title = 'A'.repeat(92); // Exactly at boundary
      const result = createDuplicateTitle(title);
      expect(result).toBe('Copy of ' + 'A'.repeat(92));
      expect(result.length).toBe(100);
    });
  });

  describe('long titles (truncation)', () => {
    it('truncates 93 char title to fit within 100 chars', () => {
      const title = 'A'.repeat(93);
      const result = createDuplicateTitle(title);
      expect(result.length).toBe(100);
      expect(result.startsWith('Copy of ')).toBe(true);
      expect(result).toBe('Copy of ' + 'A'.repeat(92));
    });

    it('truncates 95 char title to fit within 100 chars', () => {
      const longTitle = 'A'.repeat(95);
      const result = createDuplicateTitle(longTitle);
      expect(result.length).toBe(100);
      expect(result.startsWith('Copy of ')).toBe(true);
    });

    it('truncates 100 char title to fit within 100 chars', () => {
      const longTitle = 'A'.repeat(100);
      const result = createDuplicateTitle(longTitle);
      expect(result.length).toBe(100);
      expect(result.startsWith('Copy of ')).toBe(true);
      expect(result).toBe('Copy of ' + 'A'.repeat(92));
    });

    it('truncates very long title (200+ chars)', () => {
      const veryLongTitle = 'B'.repeat(200);
      const result = createDuplicateTitle(veryLongTitle);
      expect(result.length).toBe(100);
      expect(result).toBe('Copy of ' + 'B'.repeat(92));
    });
  });

  describe('real-world titles', () => {
    it('handles typical ticket title', () => {
      const title = 'Add user authentication to the dashboard';
      const result = createDuplicateTitle(title);
      expect(result).toBe('Copy of Add user authentication to the dashboard');
    });

    it('handles title with special characters', () => {
      const title = 'Fix bug #123: "TypeError" in user-settings.tsx';
      const result = createDuplicateTitle(title);
      expect(result).toBe('Copy of Fix bug #123: "TypeError" in user-settings.tsx');
    });

    it('handles title with unicode characters', () => {
      const title = 'Add emoji support 🎉 to notifications';
      const result = createDuplicateTitle(title);
      expect(result).toBe('Copy of Add emoji support 🎉 to notifications');
    });
  });
});
