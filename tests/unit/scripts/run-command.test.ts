import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = join(__dirname, '../../../.github/scripts/run-command.sh');
const TMP_DIR = join(__dirname, '../../../tmp-run-command-test');

function runScript(
  args: string,
  expectSuccess = true,
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const result = execSync(`bash "${SCRIPT_PATH}" ${args}`, {
      encoding: 'utf-8',
      timeout: 10000,
      env: process.env,
    });
    return { stdout: result, stderr: '', exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    if (expectSuccess) {
      throw error;
    }
    return {
      stdout: execError.stdout || '',
      stderr: execError.stderr || '',
      exitCode: execError.status || 1,
    };
  }
}

function checkForYq(): boolean {
  try {
    execSync('which yq', { encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}

// yq is required — available in CI via setup-environment.sh, may not be installed locally
const hasYq = checkForYq();

describe.skipIf(!hasYq)('run-command.sh', () => {

  beforeEach(() => {
    // Clean up tmp dir before each test
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
  });

  it('exits 1 when missing arguments', () => {
    const result = runScript('', false);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage:');
  });

  it('exits 1 when only one argument provided', () => {
    const result = runScript(TMP_DIR, false);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage:');
  });

  it('uses fallback default when config.yml is missing and key has a default', () => {
    // Create a minimal package.json so bun install can succeed
    writeFileSync(join(TMP_DIR, 'package.json'), '{"name":"test","dependencies":{}}');
    const result = runScript(`${TMP_DIR} install`);
    expect(result.exitCode).toBe(0);
  });

  it('exits 0 silently when config.yml is missing and key has no default', () => {
    const result = runScript(`${TMP_DIR} nonexistent_key`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('exits 0 when command key is not defined in config', () => {
    mkdirSync(join(TMP_DIR, '.ai-board'), { recursive: true });
    writeFileSync(
      join(TMP_DIR, '.ai-board/config.yml'),
      `version: 1
project:
  name: Test
  language: typescript
runtime:
  manager: bun
commands:
  install: echo installed
agent:
  cli: claude-code
`
    );

    const result = runScript(`${TMP_DIR} test_e2e`);
    expect(result.exitCode).toBe(0);
  });

  it('resolves test_primary through testCapabilities.primaryCommandKey', () => {
    mkdirSync(join(TMP_DIR, '.ai-board'), { recursive: true });
    writeFileSync(
      join(TMP_DIR, '.ai-board/config.yml'),
      `version: 1
project:
  name: Test
  language: typescript
runtime:
  manager: bun
commands:
  install: echo installed
  test_unit: echo "unit tests ran"
testCapabilities:
  framework: vitest
  primaryCommandKey: test_unit
  hasE2E: false
agent:
  cli: claude-code
`
    );

    const result = runScript(`${TMP_DIR} test_primary`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('unit tests ran');
  });

  it('exits 0 when test_primary is requested without a configured primary command', () => {
    mkdirSync(join(TMP_DIR, '.ai-board'), { recursive: true });
    writeFileSync(
      join(TMP_DIR, '.ai-board/config.yml'),
      `version: 1
project:
  name: Test
  language: typescript
runtime:
  manager: bun
commands:
  install: echo installed
testCapabilities:
  framework: vitest
  primaryCommandKey: null
  hasE2E: false
agent:
  cli: claude-code
`
    );

    const result = runScript(`${TMP_DIR} test_primary`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('executes valid command and returns exit code 0', () => {
    mkdirSync(join(TMP_DIR, '.ai-board'), { recursive: true });
    writeFileSync(
      join(TMP_DIR, '.ai-board/config.yml'),
      `version: 1
project:
  name: Test
  language: typescript
runtime:
  manager: bun
commands:
  install: echo "hello from install"
agent:
  cli: claude-code
`
    );

    const result = runScript(`${TMP_DIR} install`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello from install');
  });

  it('propagates non-zero exit code from command', () => {
    mkdirSync(join(TMP_DIR, '.ai-board'), { recursive: true });
    writeFileSync(
      join(TMP_DIR, '.ai-board/config.yml'),
      `version: 1
project:
  name: Test
  language: typescript
runtime:
  manager: bun
commands:
  build: exit 42
agent:
  cli: claude-code
`
    );

    const result = runScript(`${TMP_DIR} build`, false);
    expect(result.exitCode).toBe(42);
  });

  it('exits 1 for invalid YAML', () => {
    mkdirSync(join(TMP_DIR, '.ai-board'), { recursive: true });
    writeFileSync(
      join(TMP_DIR, '.ai-board/config.yml'),
      `{invalid yaml: [unterminated`
    );

    const result = runScript(`${TMP_DIR} install`, false);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid YAML');
  });
});
