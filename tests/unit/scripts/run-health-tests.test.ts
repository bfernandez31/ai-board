import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const SCRIPT_PATH = join(__dirname, '../../../.claude-plugin/scripts/bash/run-health-tests.sh');
const TMP_DIR = join(__dirname, '../../../tmp-run-health-tests-test');
const RESULT_DIR = join(__dirname, '../../../tmp-run-health-tests-results');
const RESULT_FILE = join(RESULT_DIR, 'health-scan-result.json');

function runScript(
  agentType: string,
  configPath: string,
  targetDir: string,
  env?: Record<string, string>
): { stdout: string; exitCode: number } {
  try {
    const result = execSync(`bash "${SCRIPT_PATH}" "${agentType}" "${configPath}" "${targetDir}"`, {
      encoding: 'utf-8',
      timeout: 30000,
      // MAX_ITERATIONS=0 disables the fix loop (no LLM agent in unit tests)
      env: { ...process.env, MAX_ITERATIONS: '0', HEALTH_RESULT_DIR: RESULT_DIR, TEST_REPORT_DIR: RESULT_DIR, ...env },
    });
    return { stdout: result, exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; status?: number };
    return { stdout: execError.stdout || '', exitCode: execError.status || 1 };
  }
}

function readResult(): Record<string, unknown> {
  return JSON.parse(readFileSync(RESULT_FILE, 'utf-8'));
}

const hasYq = (() => {
  try { execSync('which yq', { encoding: 'utf-8' }); return true; } catch { return false; }
})();

describe.skipIf(!hasYq)('run-health-tests.sh', () => {
  beforeEach(() => {
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
    mkdirSync(TMP_DIR, { recursive: true });
    mkdirSync(join(TMP_DIR, '.ai-board'), { recursive: true });
    if (existsSync(RESULT_DIR)) {
      rmSync(RESULT_DIR, { recursive: true, force: true });
    }
    mkdirSync(RESULT_DIR, { recursive: true });
    // Init git repo so the orchestrator's git commands don't fail
    execSync('git init', { cwd: TMP_DIR, encoding: 'utf-8' });
    execSync('git config user.name "test"', { cwd: TMP_DIR, encoding: 'utf-8' });
    execSync('git config user.email "test@test.com"', { cwd: TMP_DIR, encoding: 'utf-8' });
    writeFileSync(join(TMP_DIR, '.gitkeep'), '');
    execSync('git add . && git commit -m "init"', { cwd: TMP_DIR, encoding: 'utf-8' });
  });

  afterAll(() => {
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
    if (existsSync(RESULT_DIR)) {
      rmSync(RESULT_DIR, { recursive: true, force: true });
    }
  });

  function writeConfig(yaml: string): string {
    const configPath = join(TMP_DIR, '.ai-board/config.yml');
    writeFileSync(configPath, yaml);
    return configPath;
  }

  // ── SKIPPED scenarios (T027) ────────────────────────────────────

  it('writes SKIPPED result when no test commands configured', () => {
    const config = writeConfig(`
version: 1
project:
  name: "test"
commands:
  install: "echo ok"
`);
    runScript('CLAUDE', config, TMP_DIR);
    const result = readResult();
    expect(result.skipped).toBe(true);
    expect(result.skipReason).toContain('No test command');
    expect(result.score).toBe(0);
  });

  it('writes SKIPPED result when commands section is empty', () => {
    const config = writeConfig(`
version: 1
project:
  name: "test"
`);
    runScript('CLAUDE', config, TMP_DIR);
    const result = readResult();
    expect(result.skipped).toBe(true);
  });

  it('writes SKIPPED result when config.yml is missing', () => {
    runScript('CLAUDE', '/tmp/nonexistent-config.yml', TMP_DIR);
    const result = readResult();
    expect(result.skipped).toBe(true);
  });

  // ── Scoring scenarios ────────────────────────────────────────────

  it('scores 100 when all tests pass (single-command mode)', () => {
    const config = writeConfig(`
version: 1
commands:
  test: "echo 'all pass'"
`);
    runScript('CLAUDE', config, TMP_DIR);
    const result = readResult();
    expect(result.score).toBe(100);
    expect(result.issuesFound).toBe(0);
  });

  it('uses flat -2 penalty per failure in single-command mode', () => {
    // exit-code fallback: exit 1 → 1 failure → score = 100 - (1*2) = 98
    const config = writeConfig(`
version: 1
commands:
  test: "echo 'fail'; exit 1"
`);
    runScript('CLAUDE', config, TMP_DIR);
    const result = readResult();
    expect(result.score).toBe(98);
  });

  it('produces result with correct schema', () => {
    const config = writeConfig(`
version: 1
commands:
  test: "echo ok"
`);
    runScript('CLAUDE', config, TMP_DIR);
    const result = readResult();
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('issuesFound');
    expect(result).toHaveProperty('issuesFixed');
    expect(result).toHaveProperty('report');
    const report = result.report as Record<string, unknown>;
    expect(report).toHaveProperty('type', 'TESTS');
    expect(report).toHaveProperty('autoFixed');
    expect(report).toHaveProperty('nonFixable');
    expect(report).toHaveProperty('generatedTickets');
    expect(result).toHaveProperty('tokensUsed');
    expect(result).toHaveProperty('costUsd');
  });

  it('writes test-framework.txt with detected framework', () => {
    const config = writeConfig(`
version: 1
testing:
  framework: vitest
commands:
  test: "echo ok"
`);
    runScript('CLAUDE', config, TMP_DIR);
    const framework = readFileSync(join(RESULT_DIR, 'test-framework.txt'), 'utf-8').trim();
    expect(framework).toBe('vitest');
  });

  // ── Error handling (T030) ────────────────────────────────────────

  it('handles test command execution failure gracefully', () => {
    const config = writeConfig(`
version: 1
commands:
  test: "nonexistent-command-that-does-not-exist"
`);
    // Should not throw — orchestrator handles errors
    const { exitCode } = runScript('CLAUDE', config, TMP_DIR);
    // Script should complete (may exit 0 or non-zero, but shouldn't crash)
    const result = readResult();
    expect(result).toHaveProperty('score');
  });
});
