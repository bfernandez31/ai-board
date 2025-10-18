/**
 * Mock helpers for GitHub API (@octokit/rest) in tests
 *
 * This module provides utilities to mock GitHub API responses without making real API calls.
 * Use these helpers in tests to avoid:
 * - Real API costs
 * - GitHub rate limits
 * - Network dependencies
 * - Authentication requirements
 */

/**
 * Mock GitHub file content response
 */
export const mockGitHubFileContent = (content: string, sha: string = 'mock-file-sha-123') => ({
  sha,
  name: 'spec.md',
  path: 'specs/036-mode-to-update/spec.md',
  content: Buffer.from(content).toString('base64'),
  encoding: 'base64' as const,
});

/**
 * Mock GitHub commit response
 */
export const mockGitHubCommit = (sha: string = 'mock-commit-sha-456') => ({
  commit: {
    sha,
    message: 'docs: update spec.md',
    author: {
      name: 'Test User',
      email: 'test@example.com',
      date: new Date().toISOString(),
    },
  },
  content: {
    sha: 'mock-file-sha-789',
  },
});

/**
 * Mock Octokit instance for server-side tests
 *
 * Usage in API route tests:
 * ```typescript
 * // Mock the Octokit module before importing the route
 * jest.mock('@octokit/rest', () => ({
 *   Octokit: jest.fn(() => mockOctokitInstance()),
 * }));
 * ```
 */
export const mockOctokitInstance = (options?: {
  getContentShouldFail?: boolean;
  createOrUpdateShouldFail?: boolean;
  existingFileSha?: string;
  commitSha?: string;
}) => ({
  repos: {
    getContent: jest.fn(async () => {
      if (options?.getContentShouldFail) {
        const error: any = new Error('Not Found');
        error.status = 404;
        throw error;
      }
      return {
        data: mockGitHubFileContent(
          '# Existing Spec\n\nContent',
          options?.existingFileSha || 'existing-sha-123'
        ),
      };
    }),
    createOrUpdateFileContents: jest.fn(async () => {
      if (options?.createOrUpdateShouldFail) {
        const error: any = new Error('Conflict');
        error.message = 'does not match';
        throw error;
      }
      return {
        data: mockGitHubCommit(options?.commitSha || 'new-commit-sha-456'),
      };
    }),
  },
});

/**
 * Playwright route handler for mocking GitHub API in E2E tests
 *
 * Usage in E2E tests:
 * ```typescript
 * await page.route('**/api/projects/*\/docs', mockGitHubDocsRoute({
 *   success: true,
 *   commitSha: 'test-sha-123',
 * }));
 * ```
 */
export const mockGitHubDocsRoute = (response?: {
  success?: boolean;
  commitSha?: string;
  error?: string;
  code?: string;
  status?: number;
}) => {
  return (route: any) => {
    const defaultSuccess = {
      success: true,
      commitSha: response?.commitSha || 'mock-commit-sha-e2e',
      updatedAt: new Date().toISOString(),
      message: 'spec.md updated successfully',
    };

    const defaultError = {
      success: false,
      error: response?.error || 'Mock error',
      code: response?.code || 'MOCK_ERROR',
    };

    route.fulfill({
      status: response?.status || (response?.success !== false ? 200 : 400),
      contentType: 'application/json',
      body: JSON.stringify(response?.success !== false ? defaultSuccess : defaultError),
    });
  };
};
