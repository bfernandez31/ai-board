import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('generate-test-report.js - Fallback Handling', () => {
  const scriptPath = path.resolve('.specify/scripts/generate-test-report.js');
  const tempDir = path.resolve('tmp-test-reports');

  // Helper to run the script
  function runScript(args: string): { stdout: string; code: number } {
    try {
      const stdout = execSync(`node ${scriptPath} ${args}`, {
        encoding: 'utf-8',
        cwd: process.cwd(),
      });
      return { stdout, code: 0 };
    } catch (error: any) {
      return { stdout: error.stdout || '', code: error.status || 1 };
    }
  }

  it('should handle invalid JSON gracefully and generate empty report', () => {
    // Setup: Create temp dir and invalid JSON files
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const invalidUnitFile = path.join(tempDir, 'invalid-unit.json');
    const invalidE2EFile = path.join(tempDir, 'invalid-e2e.json');
    const outputFile = path.join(tempDir, 'report.json');

    // Write invalid JSON (corrupted by Playwright crash)
    fs.writeFileSync(invalidUnitFile, '{"testResults": [{ incomplete json');
    fs.writeFileSync(invalidE2EFile, 'Error: Playwright timeout\n{"suites": [');

    // Run script
    const result = runScript(
      `--unit ${invalidUnitFile} --e2e ${invalidE2EFile} --output ${outputFile}`
    );

    // Should complete successfully (exit 0)
    expect(result.code).toBe(0);

    // Should generate report with 0 failures (graceful fallback)
    expect(fs.existsSync(outputFile)).toBe(true);

    const report = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    expect(report.summary.totalFailures).toBe(0);
    expect(report.summary.unitFailures).toBe(0);
    expect(report.summary.e2eFailures).toBe(0);

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should handle missing test result files gracefully', () => {
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const outputFile = path.join(tempDir, 'report.json');

    // Run script with non-existent files
    const result = runScript(
      `--unit /nonexistent/unit.json --e2e /nonexistent/e2e.json --output ${outputFile}`
    );

    // Should complete successfully
    expect(result.code).toBe(0);

    // Should generate empty report
    const report = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    expect(report.summary.totalFailures).toBe(0);

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should generate report with failures from valid E2E JSON', () => {
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const validE2EFile = path.join(tempDir, 'valid-e2e.json');
    const outputFile = path.join(tempDir, 'report.json');

    // Create valid Playwright JSON with failures
    const validE2E = {
      suites: [
        {
          title: 'API Tests',
          file: 'tests/api/tickets.spec.ts',
          specs: [
            {
              title: 'should return all tickets',
              file: 'tests/api/tickets.spec.ts',
              tests: [
                {
                  status: 'unexpected', // Failure
                  results: [
                    {
                      error: {
                        message: 'Expected 5 tickets but got 3',
                        stack: 'at tickets.spec.ts:42:5',
                      },
                      duration: 1234,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    fs.writeFileSync(validE2EFile, JSON.stringify(validE2E, null, 2));

    // Run script
    const result = runScript(`--e2e ${validE2EFile} --output ${outputFile}`);

    // Should complete successfully
    expect(result.code).toBe(0);

    // Should detect 1 E2E failure
    const report = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    expect(report.summary.totalFailures).toBe(1);
    expect(report.summary.e2eFailures).toBe(1);
    expect(report.summary.unitFailures).toBe(0);

    // Should identify root cause
    expect(report.rootCauses).toHaveLength(1);
    expect(report.rootCauses[0].count).toBe(1);
    expect(report.rootCauses[0].originalMessage).toContain('Expected');

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
