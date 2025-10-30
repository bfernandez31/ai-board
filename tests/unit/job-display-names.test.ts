/**
 * Job Display Names Unit Tests
 * Feature: 075-933-timeline-bad
 *
 * Tests for getJobDisplayName utility function that maps
 * internal job commands to user-friendly display names.
 */

import { describe, it, expect } from 'vitest';
import { getJobDisplayName } from '@/app/lib/utils/job-display-names';

describe('getJobDisplayName', () => {
  describe('Normal workflow commands', () => {
    it('should return "Specification generation" for specify command', () => {
      expect(getJobDisplayName('specify')).toBe('Specification generation');
    });

    it('should return "Planning" for plan command', () => {
      expect(getJobDisplayName('plan')).toBe('Planning');
    });

    it('should return "Implementation" for implement command', () => {
      expect(getJobDisplayName('implement')).toBe('Implementation');
    });

    it('should return "Verification" for verify command', () => {
      expect(getJobDisplayName('verify')).toBe('Verification');
    });

    it('should return "Deployment" for ship command', () => {
      expect(getJobDisplayName('ship')).toBe('Deployment');
    });
  });

  describe('Quick-impl workflow command', () => {
    it('should return "Quick implementation" for quick-impl command', () => {
      expect(getJobDisplayName('quick-impl')).toBe('Quick implementation');
    });
  });

  describe('AI-BOARD assistance commands', () => {
    it('should return "Specification assistance" for comment-specify', () => {
      expect(getJobDisplayName('comment-specify')).toBe('Specification assistance');
    });

    it('should return "Planning assistance" for comment-plan', () => {
      expect(getJobDisplayName('comment-plan')).toBe('Planning assistance');
    });

    it('should return "Implementation assistance" for comment-build', () => {
      expect(getJobDisplayName('comment-build')).toBe('Implementation assistance');
    });

    it('should return "Verification assistance" for comment-verify', () => {
      expect(getJobDisplayName('comment-verify')).toBe('Verification assistance');
    });

    it('should return "Deployment assistance" for comment-ship', () => {
      expect(getJobDisplayName('comment-ship')).toBe('Deployment assistance');
    });
  });

  describe('Fallback patterns', () => {
    it('should generate fallback for unmapped comment-* commands', () => {
      expect(getJobDisplayName('comment-test')).toBe('Test assistance');
    });

    it('should capitalize first letter in fallback pattern', () => {
      expect(getJobDisplayName('comment-review')).toBe('Review assistance');
    });

    it('should handle empty suffix in comment-* pattern', () => {
      expect(getJobDisplayName('comment-')).toBe('Unknown command (comment-)');
    });

    it('should return descriptive fallback for unknown commands', () => {
      expect(getJobDisplayName('unknown-cmd')).toBe('Unknown command (unknown-cmd)');
    });

    it('should handle empty command string', () => {
      expect(getJobDisplayName('')).toBe('Unknown job type');
    });

    it('should handle whitespace-only command string', () => {
      expect(getJobDisplayName('   ')).toBe('Unknown job type');
    });
  });

  describe('Legacy commands', () => {
    it('should return "Clarification (legacy)" for clarify command', () => {
      expect(getJobDisplayName('clarify')).toBe('Clarification (legacy)');
    });

    it('should return "Task generation (legacy)" for tasks command', () => {
      expect(getJobDisplayName('tasks')).toBe('Task generation (legacy)');
    });
  });
});
