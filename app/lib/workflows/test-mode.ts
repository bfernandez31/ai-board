/**
 * Detects whether the application is running in test/development mode
 * where GitHub workflow dispatches should be skipped.
 *
 * Returns true when:
 * - TEST_MODE env is 'true'
 * - NODE_ENV is 'test'
 * - GITHUB_TOKEN is missing or contains 'test'/'placeholder'
 */
export function isWorkflowTestMode(githubToken: string | undefined): boolean {
  return (
    process.env.TEST_MODE === 'true' ||
    process.env.NODE_ENV === 'test' ||
    !githubToken ||
    githubToken.includes('test') ||
    githubToken.includes('placeholder')
  );
}
