import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isWorkflowTokenTestContext,
  getAcceptedWorkflowTokens,
  isAcceptedWorkflowToken,
  getWorkflowToken,
} from '@/lib/auth/workflow-token';

describe('workflow-token', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isWorkflowTokenTestContext', () => {
    it('returns true when TEST_MODE=true', () => {
      vi.stubEnv('TEST_MODE', 'true');
      vi.stubEnv('NODE_ENV', 'production');
      expect(isWorkflowTokenTestContext()).toBe(true);
    });

    it('returns true when NODE_ENV=test', () => {
      vi.stubEnv('NODE_ENV', 'test');
      expect(isWorkflowTokenTestContext()).toBe(true);
    });

    it('returns true when VITEST_INTEGRATION=1', () => {
      vi.stubEnv('VITEST_INTEGRATION', '1');
      expect(isWorkflowTokenTestContext()).toBe(true);
    });

    it('returns false in production context', () => {
      vi.stubEnv('TEST_MODE', '');
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('VITEST_INTEGRATION', '');
      expect(isWorkflowTokenTestContext()).toBe(false);
    });
  });

  describe('getAcceptedWorkflowTokens', () => {
    it('includes WORKFLOW_API_TOKEN when set', () => {
      vi.stubEnv('WORKFLOW_API_TOKEN', 'prod-token');
      vi.stubEnv('TEST_MODE', '');
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('VITEST_INTEGRATION', '');
      const tokens = getAcceptedWorkflowTokens();
      expect(tokens).toContain('prod-token');
    });

    it('includes TEST_WORKFLOW_TOKEN env var in test context', () => {
      vi.stubEnv('TEST_WORKFLOW_TOKEN', 'my-test-token');
      vi.stubEnv('TEST_MODE', 'true');
      vi.stubEnv('WORKFLOW_API_TOKEN', '');
      const tokens = getAcceptedWorkflowTokens();
      expect(tokens).toContain('my-test-token');
    });

    it('does NOT include test token when TEST_WORKFLOW_TOKEN env var is unset even in test context', () => {
      vi.stubEnv('TEST_WORKFLOW_TOKEN', '');
      vi.stubEnv('TEST_MODE', 'true');
      vi.stubEnv('WORKFLOW_API_TOKEN', '');
      const tokens = getAcceptedWorkflowTokens();
      expect(tokens).toHaveLength(0);
    });

    it('does NOT include test token in production context even if TEST_WORKFLOW_TOKEN is set', () => {
      vi.stubEnv('TEST_WORKFLOW_TOKEN', 'my-test-token');
      vi.stubEnv('TEST_MODE', '');
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('VITEST_INTEGRATION', '');
      vi.stubEnv('WORKFLOW_API_TOKEN', '');
      const tokens = getAcceptedWorkflowTokens();
      expect(tokens).not.toContain('my-test-token');
    });
  });

  describe('isAcceptedWorkflowToken', () => {
    it('accepts a valid token', () => {
      vi.stubEnv('WORKFLOW_API_TOKEN', 'valid-token');
      expect(isAcceptedWorkflowToken('valid-token')).toBe(true);
    });

    it('rejects an invalid token', () => {
      vi.stubEnv('WORKFLOW_API_TOKEN', 'valid-token');
      expect(isAcceptedWorkflowToken('wrong-token!')).toBe(false);
    });
  });

  describe('getWorkflowToken', () => {
    it('returns WORKFLOW_API_TOKEN when set', () => {
      vi.stubEnv('WORKFLOW_API_TOKEN', 'prod-token');
      expect(getWorkflowToken()).toBe('prod-token');
    });

    it('returns TEST_WORKFLOW_TOKEN env var in test context when WORKFLOW_API_TOKEN is unset', () => {
      vi.stubEnv('WORKFLOW_API_TOKEN', '');
      vi.stubEnv('TEST_MODE', 'true');
      vi.stubEnv('TEST_WORKFLOW_TOKEN', 'my-test-token');
      expect(getWorkflowToken()).toBe('my-test-token');
    });

    it('throws when no tokens available', () => {
      vi.stubEnv('WORKFLOW_API_TOKEN', '');
      vi.stubEnv('TEST_MODE', '');
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('VITEST_INTEGRATION', '');
      vi.stubEnv('TEST_WORKFLOW_TOKEN', '');
      expect(() => getWorkflowToken()).toThrow('WORKFLOW_API_TOKEN is not set and not in test context');
    });
  });
});
