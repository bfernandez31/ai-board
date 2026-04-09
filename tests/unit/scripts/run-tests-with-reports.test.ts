import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const SCRIPT_PATH = join(__dirname, '../../../.claude-plugin/scripts/bash/run-tests-with-reports.sh');
const TMP_DIR = join(__dirname, '../../../tmp-run-tests-reports-test');
const SUMMARY_REPORT = '/tmp/test-report-summary.json';

function runScript(configPath: string, targetDir: string, env?: Record<string, string>): { stdout: string; exitCode: number } {
  try {
    const result = execSync(`bash "${SCRIPT_PATH}" "${configPath}" "${targetDir}"`, {
      encoding: 'utf-8',
      timeout: 30000,
      env: { ...process.env, ...env },
    });
    return { stdout: result, exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; status?: number };
    return { stdout: execError.stdout || '', exitCode: execError.status || 1 };
  }
}

function readSummary(): Record<string, unknown> {
  return JSON.parse(readFileSync(SUMMARY_REPORT, 'utf-8'));
}

const hasYq = (() => {
  try { execSync('which yq', { encoding: 'utf-8' }); return true; } catch { return false; }
})();

describe.skipIf(!hasYq)('run-tests-with-reports.sh', () => {
  beforeEach(() => {
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
    mkdirSync(TMP_DIR, { recursive: true });
    mkdirSync(join(TMP_DIR, '.ai-board'), { recursive: true });
  });

  afterAll(() => {
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
  });

  function writeConfig(yaml: string): string {
    const configPath = join(TMP_DIR, '.ai-board/config.yml');
    writeFileSync(configPath, yaml);
    return configPath;
  }

  it('exits 0 when config file is missing', () => {
    const result = runScript('/tmp/nonexistent-config.yml', TMP_DIR);
    expect(result.exitCode).toBe(0);
    const summary = readSummary();
    expect(summary.totalPassed).toBe(0);
    expect(summary.totalFailed).toBe(0);
  });

  it('runs single-command mode with exit-code fallback (success)', () => {
    const config = writeConfig(`
version: 1
commands:
  test: "echo 'all tests passed'"
`);
    const result = runScript(config, TMP_DIR);
    expect(result.exitCode).toBe(0);
    const summary = readSummary();
    expect(summary.totalPassed).toBeGreaterThanOrEqual(1);
    expect(summary.totalFailed).toBe(0);
    expect(summary.hasErrors).toBe(false);
  });

  it('runs single-command mode with exit-code fallback (failure)', () => {
    const config = writeConfig(`
version: 1
commands:
  test: "echo 'tests failed'; exit 1"
`);
    const result = runScript(config, TMP_DIR);
    expect(result.exitCode).toBe(0); // always exits 0
    const summary = readSummary();
    expect(summary.totalFailed).toBeGreaterThanOrEqual(1);
    expect(summary.hasErrors).toBe(true);
  });

  it('runs granular mode with unit and integration commands', () => {
    const config = writeConfig(`
version: 1
commands:
  test_unit: "echo 'unit ok'"
  test_integration: "echo 'int ok'"
`);
    const result = runScript(config, TMP_DIR);
    expect(result.exitCode).toBe(0);
    const summary = readSummary();
    const unit = summary.unit as Record<string, unknown>;
    const integration = summary.integration as Record<string, unknown>;
    expect(unit.ran).toBe(true);
    expect(integration.ran).toBe(true);
  });

  it('produces summary with correct schema', () => {
    const config = writeConfig(`
version: 1
commands:
  test: "echo 'ok'"
`);
    runScript(config, TMP_DIR);
    const summary = readSummary();
    // Verify all required fields exist
    expect(summary).toHaveProperty('totalPassed');
    expect(summary).toHaveProperty('totalFailed');
    expect(summary).toHaveProperty('totalTests');
    expect(summary).toHaveProperty('hasErrors');
    expect(summary).toHaveProperty('unit');
    expect(summary).toHaveProperty('integration');
    expect(summary).toHaveProperty('e2e');
    const unit = summary.unit as Record<string, unknown>;
    expect(unit).toHaveProperty('passed');
    expect(unit).toHaveProperty('failed');
    expect(unit).toHaveProperty('total');
    expect(unit).toHaveProperty('ran');
    expect(unit).toHaveProperty('error');
  });

  it('single-command mode puts results in unit bucket', () => {
    const config = writeConfig(`
version: 1
commands:
  test: "echo 'ok'"
`);
    runScript(config, TMP_DIR);
    const summary = readSummary();
    const unit = summary.unit as Record<string, unknown>;
    const integration = summary.integration as Record<string, unknown>;
    const e2e = summary.e2e as Record<string, unknown>;
    expect(unit.ran).toBe(true);
    expect(integration.ran).toBe(false);
    expect(e2e.ran).toBe(false);
  });

  it('vitest framework injects reporter flags', () => {
    // Create a mock vitest report that the script can parse
    const mockReport = JSON.stringify({
      testResults: [{
        assertionResults: [
          { status: 'passed', title: 'test1' },
          { status: 'passed', title: 'test2' },
          { status: 'failed', title: 'test3', failureMessages: ['expected true'] }
        ]
      }]
    });
    const mockReportPath = join(TMP_DIR, 'mock-vitest.json');
    writeFileSync(mockReportPath, mockReport);

    // Use a command that copies our mock report to where vitest would write it
    const config = writeConfig(`
version: 1
testing:
  framework: vitest
commands:
  test: "cp ${mockReportPath} /tmp/test-report-unit.json && exit 1"
`);
    runScript(config, TMP_DIR);
    const summary = readSummary();
    expect(summary.totalPassed).toBe(2);
    expect(summary.totalFailed).toBe(1);
  });
});
