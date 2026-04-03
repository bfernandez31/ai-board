import { describe, it, expect } from 'vitest';
import { canTransition, isTerminalStatus } from '@/app/lib/job-state-machine';

describe('Job State Machine', () => {
  describe('PENDING transitions', () => {
    it('should allow PENDING → RUNNING', () => {
      expect(canTransition('PENDING', 'RUNNING')).toBe(true);
    });

    it('should allow PENDING → CANCELLED', () => {
      expect(canTransition('PENDING', 'CANCELLED')).toBe(true);
    });

    it('should allow PENDING → PENDING (idempotent)', () => {
      expect(canTransition('PENDING', 'PENDING')).toBe(true);
    });

    it('should reject PENDING → COMPLETED', () => {
      expect(canTransition('PENDING', 'COMPLETED')).toBe(false);
    });

    it('should reject PENDING → FAILED', () => {
      expect(canTransition('PENDING', 'FAILED')).toBe(false);
    });
  });

  describe('RUNNING transitions', () => {
    it('should allow RUNNING → COMPLETED', () => {
      expect(canTransition('RUNNING', 'COMPLETED')).toBe(true);
    });

    it('should allow RUNNING → FAILED', () => {
      expect(canTransition('RUNNING', 'FAILED')).toBe(true);
    });

    it('should allow RUNNING → CANCELLED', () => {
      expect(canTransition('RUNNING', 'CANCELLED')).toBe(true);
    });

    it('should reject RUNNING → PENDING', () => {
      expect(canTransition('RUNNING', 'PENDING')).toBe(false);
    });
  });

  describe('Terminal states', () => {
    it('COMPLETED is terminal', () => {
      expect(isTerminalStatus('COMPLETED')).toBe(true);
      expect(canTransition('COMPLETED', 'COMPLETED')).toBe(true);
      expect(canTransition('COMPLETED', 'FAILED')).toBe(false);
    });

    it('FAILED is terminal', () => {
      expect(isTerminalStatus('FAILED')).toBe(true);
    });

    it('CANCELLED is terminal', () => {
      expect(isTerminalStatus('CANCELLED')).toBe(true);
    });

    it('PENDING is not terminal', () => {
      expect(isTerminalStatus('PENDING')).toBe(false);
    });

    it('RUNNING is not terminal', () => {
      expect(isTerminalStatus('RUNNING')).toBe(false);
    });
  });
});
