import { test, expect } from '@playwright/test';
import { cleanupTestData } from './helpers/db-setup';
import { execSync } from 'child_process';

/**
 * Seed Environment Validation Test
 *
 * Verifies that the seed script properly validates required environment variables.
 * The seed should fail with a clear error message if GITHUB_OWNER or GITHUB_REPO is missing.
 *
 * Test Flow:
 * 1. Unset GITHUB_OWNER environment variable
 * 2. Attempt to run seed script
 * 3. Expect error: "GITHUB_OWNER and GITHUB_REPO environment variables are required"
 * 4. Unset GITHUB_REPO environment variable
 * 5. Attempt to run seed script
 * 6. Expect same error message
 *
 * EXPECTED: Test PASSES once seed implementation includes environment validation
 */

test.describe('Seed Environment Validation', () => {
  test.beforeEach(async () => {
    // Clean database before test
    await cleanupTestData();
  });

  test.afterAll(async () => {
    // Cleanup after test
    await cleanupTestData();
  });

  test('should fail when GITHUB_OWNER is missing', async () => {
    const seedCommand = 'npm run db:seed';

    // Run seed without GITHUB_OWNER (only GITHUB_REPO set)
    let errorThrown = false;
    let errorMessage = '';

    // Create env without GITHUB_OWNER
    const { GITHUB_OWNER, ...envWithoutOwner } = process.env;

    try {
      execSync(seedCommand, {
        cwd: process.cwd(),
        env: {
          ...envWithoutOwner,
          GITHUB_REPO: 'test-repo',
        },
        stdio: 'pipe',
      });
    } catch (error) {
      errorThrown = true;
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    // Verify error was thrown
    expect(errorThrown).toBe(true);

    // Verify error message contains expected text
    expect(errorMessage).toContain('GITHUB_OWNER and GITHUB_REPO environment variables are required');
  });

  test('should fail when GITHUB_REPO is missing', async () => {
    const seedCommand = 'npm run db:seed';

    // Run seed without GITHUB_REPO (only GITHUB_OWNER set)
    let errorThrown = false;
    let errorMessage = '';

    // Create env without GITHUB_REPO
    const { GITHUB_REPO, ...envWithoutRepo } = process.env;

    try {
      execSync(seedCommand, {
        cwd: process.cwd(),
        env: {
          ...envWithoutRepo,
          GITHUB_OWNER: 'test-owner',
        },
        stdio: 'pipe',
      });
    } catch (error) {
      errorThrown = true;
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    // Verify error was thrown
    expect(errorThrown).toBe(true);

    // Verify error message contains expected text
    expect(errorMessage).toContain('GITHUB_OWNER and GITHUB_REPO environment variables are required');
  });

  test('should fail when both environment variables are missing', async () => {
    const seedCommand = 'npm run db:seed';

    // Run seed without both GITHUB_OWNER and GITHUB_REPO
    let errorThrown = false;
    let errorMessage = '';

    // Create env without both variables
    const { GITHUB_OWNER, GITHUB_REPO, ...envWithoutBoth } = process.env;

    try {
      execSync(seedCommand, {
        cwd: process.cwd(),
        env: envWithoutBoth,
        stdio: 'pipe',
      });
    } catch (error) {
      errorThrown = true;
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    // Verify error was thrown
    expect(errorThrown).toBe(true);

    // Verify error message contains expected text
    expect(errorMessage).toContain('GITHUB_OWNER and GITHUB_REPO environment variables are required');
  });

  test('should succeed when both environment variables are provided', async () => {
    const seedCommand = 'npm run db:seed';

    // Run seed with both environment variables set
    let errorThrown = false;

    try {
      execSync(seedCommand, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          GITHUB_OWNER: 'valid-owner',
          GITHUB_REPO: 'valid-repo',
        },
        stdio: 'pipe',
      });
    } catch (error) {
      errorThrown = true;
      console.error('Unexpected error:', error);
    }

    // Verify no error was thrown
    expect(errorThrown).toBe(false);
  });

  test('should fail when GITHUB_OWNER is empty string', async () => {
    const seedCommand = 'npm run db:seed';

    // Run seed with empty GITHUB_OWNER
    let errorThrown = false;
    let errorMessage = '';

    try {
      execSync(seedCommand, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          GITHUB_OWNER: '', // Empty string
          GITHUB_REPO: 'test-repo',
        },
        stdio: 'pipe',
      });
    } catch (error) {
      errorThrown = true;
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    // Verify error was thrown
    expect(errorThrown).toBe(true);

    // Verify error message contains expected text
    expect(errorMessage).toContain('GITHUB_OWNER and GITHUB_REPO environment variables are required');
  });

  test('should fail when GITHUB_REPO is empty string', async () => {
    const seedCommand = 'npm run db:seed';

    // Run seed with empty GITHUB_REPO
    let errorThrown = false;
    let errorMessage = '';

    try {
      execSync(seedCommand, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          GITHUB_OWNER: 'test-owner',
          GITHUB_REPO: '', // Empty string
        },
        stdio: 'pipe',
      });
    } catch (error) {
      errorThrown = true;
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    // Verify error was thrown
    expect(errorThrown).toBe(true);

    // Verify error message contains expected text
    expect(errorMessage).toContain('GITHUB_OWNER and GITHUB_REPO environment variables are required');
  });
});
