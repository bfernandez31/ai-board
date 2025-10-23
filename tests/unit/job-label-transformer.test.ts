import { describe, it, expect } from 'vitest';
import { getContextualLabel } from '@/lib/utils/job-label-transformer';
import type { JobStatus } from '@prisma/client';

describe('getContextualLabel', () => {
  describe('RUNNING status transformations', () => {
    it('transforms "specify" command to WRITING', () => {
      const result = getContextualLabel('specify', 'RUNNING');
      expect(result).toBe('WRITING');
    });

    it('transforms "plan" command to WRITING', () => {
      const result = getContextualLabel('plan', 'RUNNING');
      expect(result).toBe('WRITING');
    });

    it('transforms "implement" command to CODING', () => {
      const result = getContextualLabel('implement', 'RUNNING');
      expect(result).toBe('CODING');
    });

    it('transforms "quick-impl" command to CODING', () => {
      const result = getContextualLabel('quick-impl', 'RUNNING');
      expect(result).toBe('CODING');
    });

    it('transforms "comment-specify" to ASSISTING', () => {
      const result = getContextualLabel('comment-specify', 'RUNNING');
      expect(result).toBe('ASSISTING');
    });

    it('transforms "comment-plan" to ASSISTING', () => {
      const result = getContextualLabel('comment-plan', 'RUNNING');
      expect(result).toBe('ASSISTING');
    });

    it('returns RUNNING for unknown command', () => {
      const result = getContextualLabel('unknown-command', 'RUNNING');
      expect(result).toBe('RUNNING');
    });
  });

  describe('Non-RUNNING status pass-through', () => {
    const statuses: JobStatus[] = ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'];

    statuses.forEach((status) => {
      it(`returns ${status} unchanged for "specify" command`, () => {
        const result = getContextualLabel('specify', status);
        expect(result).toBe(status);
      });

      it(`returns ${status} unchanged for "plan" command`, () => {
        const result = getContextualLabel('plan', status);
        expect(result).toBe(status);
      });

      it(`returns ${status} unchanged for "implement" command`, () => {
        const result = getContextualLabel('implement', status);
        expect(result).toBe(status);
      });

      it(`returns ${status} unchanged for "quick-impl" command`, () => {
        const result = getContextualLabel('quick-impl', status);
        expect(result).toBe(status);
      });

      it(`returns ${status} unchanged for "comment-specify" command`, () => {
        const result = getContextualLabel('comment-specify', status);
        expect(result).toBe(status);
      });
    });
  });

  describe('Edge cases', () => {
    it('handles empty command string with RUNNING status', () => {
      const result = getContextualLabel('', 'RUNNING');
      expect(result).toBe('RUNNING');
    });

    it('handles command with leading/trailing spaces', () => {
      const result = getContextualLabel(' specify ', 'RUNNING');
      expect(result).toBe('RUNNING'); // Should not match due to spaces
    });

    it('handles uppercase command', () => {
      const result = getContextualLabel('SPECIFY', 'RUNNING');
      expect(result).toBe('RUNNING'); // Should be case-sensitive
    });

    it('handles partial comment command match', () => {
      const result = getContextualLabel('comment', 'RUNNING');
      expect(result).toBe('RUNNING'); // Should not match without suffix
    });
  });
});
