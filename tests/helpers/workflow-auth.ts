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
  return process.env.WORKFLOW_API_TOKEN || 'test-workflow-token-for-e2e-tests-only';
}

/**
 * Get workflow authentication headers
 */
export function getWorkflowHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${getWorkflowToken()}`,
  };
}
