import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { formatTimestamp } from '@/lib/utils/format-timestamp';

describe('formatTimestamp', () => {
  let now: Date;

  beforeEach(() => {
    // Set a fixed "now" for consistent testing
    now = new Date('2025-10-24T15:42:00.000Z');
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('null and invalid inputs', () => {
    it('should return "Unknown time" for null input', () => {
      expect(formatTimestamp(null)).toBe('Unknown time');
    });

    it('should return "Unknown time" for invalid string', () => {
      expect(formatTimestamp('invalid-date')).toBe('Unknown time');
    });

    it('should return "Unknown time" for empty string', () => {
      expect(formatTimestamp('')).toBe('Unknown time');
    });
  });

  describe('relative time formatting (< 1 hour)', () => {
    it('should return "just now" for current time', () => {
      expect(formatTimestamp(now)).toBe('just now');
    });

    it('should return "just now" for time less than 1 minute ago', () => {
      const timestamp = new Date('2025-10-24T15:41:30.000Z'); // 30 seconds ago
      expect(formatTimestamp(timestamp)).toBe('just now');
    });

    it('should return "2 minutes ago" for time 2 minutes ago', () => {
      const timestamp = new Date('2025-10-24T15:40:00.000Z'); // 2 minutes ago
      expect(formatTimestamp(timestamp)).toBe('2 minutes ago');
    });

    it('should return "30 minutes ago" for time 30 minutes ago', () => {
      const timestamp = new Date('2025-10-24T15:12:00.000Z'); // 30 minutes ago
      expect(formatTimestamp(timestamp)).toBe('30 minutes ago');
    });

    it('should handle ISO string input for relative time', () => {
      const timestamp = '2025-10-24T15:37:00.000Z'; // 5 minutes ago
      expect(formatTimestamp(timestamp)).toBe('5 minutes ago');
    });
  });

  describe('same day absolute time formatting (< 24 hours)', () => {
    it('should return time only for timestamp earlier today', () => {
      const timestamp = new Date('2025-10-24T10:00:00.000Z'); // Same day, >1 hour ago
      const result = formatTimestamp(timestamp);

      // Should match time format (e.g., "10:00 AM" or "10:00" depending on locale)
      expect(result).toMatch(/^\d{1,2}:\d{2}/);
      expect(result).not.toContain('Oct');
    });

    it('should handle ISO string input for same day', () => {
      const timestamp = '2025-10-24T08:30:00.000Z'; // Same day
      const result = formatTimestamp(timestamp);

      expect(result).toMatch(/^\d{1,2}:\d{2}/);
      expect(result).not.toContain('Oct');
    });
  });

  describe('past date absolute time formatting (> 24 hours)', () => {
    it('should return date and time for timestamp from yesterday', () => {
      const timestamp = new Date('2025-10-23T15:42:00.000Z'); // Yesterday
      const result = formatTimestamp(timestamp);

      // Should contain month abbreviation and time
      expect(result).toMatch(/Oct.*\d{1,2}:\d{2}/);
    });

    it('should return date and time for old timestamp', () => {
      const timestamp = new Date('2025-09-15T10:30:00.000Z'); // Weeks ago
      const result = formatTimestamp(timestamp);

      // Should contain month and time
      expect(result).toMatch(/Sep.*\d{1,2}:\d{2}/);
    });

    it('should handle ISO string input for old dates', () => {
      const timestamp = '2025-10-01T12:00:00.000Z';
      const result = formatTimestamp(timestamp);

      expect(result).toMatch(/Oct.*\d{1,2}:\d{2}/);
    });
  });

  describe('edge cases', () => {
    it('should handle Date object input', () => {
      const timestamp = new Date('2025-10-24T15:40:00.000Z');
      expect(formatTimestamp(timestamp)).toBe('2 minutes ago');
    });

    it('should handle boundary at 1 hour (59 minutes)', () => {
      const timestamp = new Date('2025-10-24T14:43:00.000Z'); // 59 minutes ago
      expect(formatTimestamp(timestamp)).toBe('59 minutes ago');
    });

    it('should handle boundary at 24 hours', () => {
      const timestamp = new Date('2025-10-23T15:43:00.000Z'); // ~24 hours ago
      const result = formatTimestamp(timestamp);

      // Should be absolute format (with date)
      expect(result).toMatch(/Oct.*\d{1,2}:\d{2}/);
    });
  });
});
