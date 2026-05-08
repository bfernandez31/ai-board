import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const AGENT_SCRIPT_PATH = join(__dirname, '../../../.github/scripts/run-agent.sh');

const SCRIPT_PATH = join(__dirname, '../../../.github/scripts/run-command.sh');
const TMP_DIR = join(__dirname, '../../../tmp-run-command-test');

function runScript(args: string, expectSuccess = true): { stdout: string; stderr: string; exitCode: number } {
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

// yq is required — available in CI via setup-environment.sh, may not be installed locally
const hasYq = (() => {
  try { execSync('which yq', { encoding: 'utf-8' }); return true; } catch { return false; }
})();

// Helper to invoke a named function defined in run-agent.sh in a controlled subshell.
// run-agent.sh is sourced with dummy args (CLAUDE test); the main dispatch block is
// guarded by a BASH_SOURCE check so only function definitions are loaded when sourced.
function runAgentHelperFn(
  cwd: string,
  funcCall: string,
  env?: Record<string, string>
): { stdout: string; stderr: string; exitCode: number } {
  const envPairs = Object.entries(env ?? {}).map(([k, v]) => `export ${k}=${JSON.stringify(v)};`).join(' ');
  try {
    const stdout = execSync(
      `bash -c '${envPairs} source "${AGENT_SCRIPT_PATH}" CLAUDE test 2>/dev/null; ${funcCall}'`,
      { encoding: 'utf-8', timeout: 10000, cwd }
    );
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', exitCode: e.status ?? 1 };
  }
}

describe('run-agent.sh — read_plugin_version', () => {
  beforeEach(() => {
    if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('returns trimmed version from .claude-plugin/plugin.json', () => {
    mkdirSync(join(TMP_DIR, '.claude-plugin'), { recursive: true });
    writeFileSync(join(TMP_DIR, '.claude-plugin/plugin.json'), JSON.stringify({ version: '1.0.1' }));
    const result = runAgentHelperFn(TMP_DIR, 'read_plugin_version');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('1.0.1');
  });

  it('returns empty string and exits 0 when manifest file is missing', () => {
    const result = runAgentHelperFn(TMP_DIR, 'read_plugin_version');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});

describe('run-agent.sh — capture_*_version helpers', () => {
  beforeEach(() => {
    if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
    mkdirSync(TMP_DIR, { recursive: true });
  });

  it('capture_claude_version returns trimmed first line of --version output', () => {
    // Inject a fake "claude" binary onto PATH that outputs a known version string
    mkdirSync(join(TMP_DIR, 'bin'), { recursive: true });
    writeFileSync(join(TMP_DIR, 'bin/claude'), '#!/bin/bash\necho "1.0.92 (Claude Code)"', { mode: 0o755 });
    const result = runAgentHelperFn(TMP_DIR, 'capture_claude_version', { PATH: `${join(TMP_DIR, 'bin')}:${process.env.PATH ?? '/usr/bin'}` });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('1.0.92 (Claude Code)');
  });

  it('capture_claude_version returns empty string when binary is missing on PATH', () => {
    const result = runAgentHelperFn(TMP_DIR, 'capture_claude_version', { PATH: '/nonexistent' });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});

describe('run-agent.sh — capture failure does not propagate non-zero (US3)', () => {
  beforeEach(() => {
    if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
    mkdirSync(TMP_DIR, { recursive: true });
  });

  it('read_plugin_version exits 0 and logs info (not error) when manifest is missing', () => {
    const result = runAgentHelperFn(TMP_DIR, 'read_plugin_version 2>&1 >/dev/null; echo "exit:$?"');
    expect(result.stdout).toContain('exit:0');
    // log_info prefix (ℹ️) should appear, not log_error prefix (❌)
    expect(result.stdout).toMatch(/ℹ️/);
    expect(result.stdout).not.toMatch(/❌/);
  });

  it('capture_claude_version exits 0 when binary is missing', () => {
    const result = runAgentHelperFn(TMP_DIR, 'capture_claude_version; echo "exit:$?"', { PATH: '/nonexistent' });
    expect(result.stdout).toContain('exit:0');
  });
});

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
