import { describe, expect, it } from 'vitest';
import { truncateOutput } from '@/lib/logs/log-truncator';

describe('truncateOutput', () => {
  describe('under-limit input', () => {
    it('returns content unchanged when under maxBytes', () => {
      const input = 'Hello, world!';
      const result = truncateOutput(input, 1000);
      expect(result.content).toBe(input);
      expect(result.truncated).toBe(false);
    });

    it('returns content unchanged when exactly at maxBytes', () => {
      const input = 'a'.repeat(100);
      const result = truncateOutput(input, 100);
      expect(result.content).toBe(input);
      expect(result.truncated).toBe(false);
    });
  });

  describe('over-limit input', () => {
    it('truncates and preserves first 25% and last 25%', () => {
      const input = 'a'.repeat(200);
      const maxBytes = 100;
      const result = truncateOutput(input, maxBytes);

      expect(result.truncated).toBe(true);
      expect(result.content.length).toBeLessThanOrEqual(maxBytes + 200);
      expect(result.content).toContain('--- [TRUNCATED:');
    });

    it('preserves the beginning of the content', () => {
      const beginning = 'START_MARKER_';
      const middle = 'x'.repeat(500);
      const end = '_END_MARKER';
      const input = beginning + middle + end;
      const result = truncateOutput(input, 100);

      expect(result.truncated).toBe(true);
      expect(result.content).toContain('START_MARKER');
      expect(result.content).toContain('END_MARKER');
    });

    it('includes original size in truncation marker', () => {
      const input = 'a'.repeat(1000);
      const result = truncateOutput(input, 100);

      expect(result.content).toContain('1000 bytes');
    });
  });

  describe('boundary preservation', () => {
    it('preserves first 25% and last 25% of maxBytes', () => {
      const maxBytes = 200;
      const first25 = 'A'.repeat(50);
      const middle = 'B'.repeat(400);
      const last25 = 'C'.repeat(50);
      const input = first25 + middle + last25;

      const result = truncateOutput(input, maxBytes);
      expect(result.truncated).toBe(true);
      expect(result.content.startsWith('A')).toBe(true);
      expect(result.content.endsWith('C')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      const result = truncateOutput('', 100);
      expect(result.content).toBe('');
      expect(result.truncated).toBe(false);
    });

    it('handles very small maxBytes', () => {
      const input = 'Hello, this is a test string';
      const result = truncateOutput(input, 10);
      expect(result.truncated).toBe(true);
      expect(result.content).toContain('TRUNCATED');
    });
  });
});
