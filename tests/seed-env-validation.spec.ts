import { test, expect } from '@playwright/test';
import { cleanupTestData } from './helpers/db-setup';
import { execSync } from 'child_process';

/**
 * Seed Environment Validation Test
 *
 * Verifies that the seed script properly validates required environment variables.
 * The seed should fail with a clear error message if GITHUB_OWNER or GITHUB_REPO is missing.
 * The repository contains a `.env` file, so the tests simulate "missing" by
 * overriding each variable with an empty string (which the seed treats as missing).
 *
 * Test Flow:
 * 1. Override GITHUB_OWNER with empty string and expect failure
 * 2. Override GITHUB_REPO with empty string and expect failure
 * 3. Override both variables with empty string and expect failure
 * 4. Provide both variables and expect success
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

  test('should fail when GITHUB_OWNER is missing or empty', async () => {
    const seedCommand = 'npm run db:seed';

    // Run seed with empty GITHUB_OWNER to simulate missing value (prevents dotenv from refilling)
    let errorThrown = false;
    let errorMessage = '';

    try {
      execSync(seedCommand, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          GITHUB_OWNER: '',
          GITHUB_REPO: 'test-repo',
        },
        stdio: 'pipe',
      });
    } catch (error) {
      errorThrown = true;
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    expect(errorThrown).toBe(true);
    expect(errorMessage).toContain('GITHUB_OWNER and GITHUB_REPO environment variables are required');
  });

  test('should fail when GITHUB_REPO is missing or empty', async () => {
    const seedCommand = 'npm run db:seed';

    // Run seed with empty GITHUB_REPO to simulate missing value
    let errorThrown = false;
    let errorMessage = '';

    try {
      execSync(seedCommand, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          GITHUB_OWNER: 'test-owner',
          GITHUB_REPO: '',
        },
        stdio: 'pipe',
      });
    } catch (error) {
      errorThrown = true;
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    expect(errorThrown).toBe(true);
    expect(errorMessage).toContain('GITHUB_OWNER and GITHUB_REPO environment variables are required');
  });

  test('should fail when both environment variables are empty', async () => {
    const seedCommand = 'npm run db:seed';

    let errorThrown = false;
    let errorMessage = '';

    try {
      execSync(seedCommand, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          GITHUB_OWNER: '',
          GITHUB_REPO: '',
        },
        stdio: 'pipe',
      });
    } catch (error) {
      errorThrown = true;
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    expect(errorThrown).toBe(true);
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

});
