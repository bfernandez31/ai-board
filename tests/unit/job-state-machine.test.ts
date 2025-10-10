import { test, expect } from '@playwright/test';
import {
  canTransition,
  isTerminalStatus,
  InvalidTransitionError,
  type JobStatus,
} from '../../app/lib/job-state-machine';

/**
 * Unit Tests: Job State Machine
 * Tests state transition validation logic in isolation
 */

test.describe('Job State Machine - Valid Transitions', () => {
  test('should allow PENDING → RUNNING transition', () => {
    expect(canTransition('PENDING', 'RUNNING')).toBe(true);
  });

  test('should allow RUNNING → COMPLETED transition', () => {
    expect(canTransition('RUNNING', 'COMPLETED')).toBe(true);
  });

  test('should allow RUNNING → FAILED transition', () => {
    expect(canTransition('RUNNING', 'FAILED')).toBe(true);
  });

  test('should allow RUNNING → CANCELLED transition', () => {
    expect(canTransition('RUNNING', 'CANCELLED')).toBe(true);
  });
});

test.describe('Job State Machine - Invalid Transitions', () => {
  test('should reject COMPLETED → FAILED transition', () => {
    expect(canTransition('COMPLETED', 'FAILED')).toBe(false);
  });

  test('should reject COMPLETED → RUNNING transition', () => {
    expect(canTransition('COMPLETED', 'RUNNING')).toBe(false);
  });

  test('should reject COMPLETED → CANCELLED transition', () => {
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
  });

  test('should reject FAILED → COMPLETED transition', () => {
    expect(canTransition('FAILED', 'COMPLETED')).toBe(false);
  });

  test('should reject FAILED → RUNNING transition', () => {
    expect(canTransition('FAILED', 'RUNNING')).toBe(false);
  });

  test('should reject FAILED → CANCELLED transition', () => {
    expect(canTransition('FAILED', 'CANCELLED')).toBe(false);
  });

  test('should reject CANCELLED → COMPLETED transition', () => {
    expect(canTransition('CANCELLED', 'COMPLETED')).toBe(false);
  });

  test('should reject CANCELLED → FAILED transition', () => {
    expect(canTransition('CANCELLED', 'FAILED')).toBe(false);
  });

  test('should reject CANCELLED → RUNNING transition', () => {
    expect(canTransition('CANCELLED', 'RUNNING')).toBe(false);
  });

  test('should reject PENDING → COMPLETED transition (must go through RUNNING)', () => {
    expect(canTransition('PENDING', 'COMPLETED')).toBe(false);
  });

  test('should reject PENDING → FAILED transition (must go through RUNNING)', () => {
    expect(canTransition('PENDING', 'FAILED')).toBe(false);
  });

  test('should reject PENDING → CANCELLED transition (must go through RUNNING)', () => {
    expect(canTransition('PENDING', 'CANCELLED')).toBe(false);
  });
});

test.describe('Job State Machine - Terminal State Detection', () => {
  test('should identify COMPLETED as terminal state', () => {
    expect(isTerminalStatus('COMPLETED')).toBe(true);
  });

  test('should identify FAILED as terminal state', () => {
    expect(isTerminalStatus('FAILED')).toBe(true);
  });

  test('should identify CANCELLED as terminal state', () => {
    expect(isTerminalStatus('CANCELLED')).toBe(true);
  });

  test('should identify PENDING as non-terminal state', () => {
    expect(isTerminalStatus('PENDING')).toBe(false);
  });

  test('should identify RUNNING as non-terminal state', () => {
    expect(isTerminalStatus('RUNNING')).toBe(false);
  });
});

test.describe('Job State Machine - Idempotent Transitions', () => {
  test('should allow COMPLETED → COMPLETED (idempotent)', () => {
    expect(canTransition('COMPLETED', 'COMPLETED')).toBe(true);
  });

  test('should allow FAILED → FAILED (idempotent)', () => {
    expect(canTransition('FAILED', 'FAILED')).toBe(true);
  });

  test('should allow CANCELLED → CANCELLED (idempotent)', () => {
    expect(canTransition('CANCELLED', 'CANCELLED')).toBe(true);
  });

  test('should allow PENDING → PENDING (idempotent)', () => {
    expect(canTransition('PENDING', 'PENDING')).toBe(true);
  });

  test('should allow RUNNING → RUNNING (idempotent)', () => {
    expect(canTransition('RUNNING', 'RUNNING')).toBe(true);
  });
});

test.describe('Job State Machine - InvalidTransitionError', () => {
  test('should have correct error message format', () => {
    const error = new InvalidTransitionError('COMPLETED', 'FAILED');
    expect(error.message).toBe('Invalid transition from COMPLETED to FAILED');
  });

  test('should have correct error name', () => {
    const error = new InvalidTransitionError('COMPLETED', 'FAILED');
    expect(error.name).toBe('InvalidTransitionError');
  });

  test('should be an instance of Error', () => {
    const error = new InvalidTransitionError('COMPLETED', 'FAILED');
    expect(error instanceof Error).toBe(true);
  });
});
