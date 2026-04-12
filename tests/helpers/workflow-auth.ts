import { getWorkflowToken as getSharedWorkflowToken } from '@/lib/auth/workflow-token';

/**
 * Workflow Authentication Helpers
 *
 * Helper functions for testing workflow-authenticated endpoints.
 * These endpoints require Bearer token authentication used by GitHub Actions workflows.
 */

/**
 * Get workflow authentication token for testing
 */
export function getWorkflowToken(): string {
  return getSharedWorkflowToken();
}

/**
 * Get workflow authentication headers
 */
export function getWorkflowHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${getWorkflowToken()}`,
  };
}
