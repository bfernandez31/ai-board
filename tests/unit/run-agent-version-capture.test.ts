/**
 * Unit tests for the runtime-version capture helpers in run-agent.sh.
 *
 * AIB-779: spawns bash to source the relevant pure-shell functions and
 * exercises them against a temp filesystem. Verifies plugin.json parsing
 * and CLI --version normalization without needing the network or a real
 * agent CLI installed.
 */

import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RUN_AGENT_SH = resolve(__dirname, '../../.github/scripts/run-agent.sh');

/**
 * Extract just the helper definitions from run-agent.sh (the pure-shell
 * functions used for version capture) and source them in a wrapper. Avoids
 * triggering the dispatch_agent / argument-parsing top-level code.
 */
function runHelper(scriptBody: string): { stdout: string; stderr: string; code: number | null } {
  const wrapper = `
    set -uo pipefail
    extract_funcs() {
      awk '
        /^resolve_plugin_version\\(\\) {/,/^}$/ { print; next }
        /^resolve_agent_cli_version\\(\\) {/,/^}$/ { print; next }
      ' "$1"
    }
    eval "$(extract_funcs '${RUN_AGENT_SH}')"
    ${scriptBody}
  `;
  const result = spawnSync('bash', ['-c', wrapper], { encoding: 'utf8' });
  return { stdout: result.stdout, stderr: result.stderr, code: result.status };
}

describe('run-agent.sh version-capture helpers (AIB-779)', () => {
  it('resolve_plugin_version returns the .version field from a candidate plugin.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'plugin-version-'));
    mkdirSync(join(dir, '.claude-plugin'), { recursive: true });
    writeFileSync(
      join(dir, '.claude-plugin/plugin.json'),
      JSON.stringify({ name: 'ai-board', version: '2.5.0' }),
    );

    const result = runHelper(`cd '${dir}' && resolve_plugin_version`);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('2.5.0');
  });

  it('resolve_plugin_version returns non-zero when no plugin.json is reachable', () => {
    const dir = mkdtempSync(join(tmpdir(), 'plugin-version-empty-'));
    const result = runHelper(`cd '${dir}' && resolve_plugin_version; echo "exit=$?"`);
    expect(result.stdout.trim()).toContain('exit=1');
  });

  it('resolve_agent_cli_version strips the binary prefix and leading "v"', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fake-cli-'));
    const fakeCli = join(dir, 'fakecli');
    writeFileSync(fakeCli, '#!/usr/bin/env bash\necho "fakecli v1.2.3"\n');
    chmodSync(fakeCli, 0o755);

    const result = runHelper(
      `export PATH='${dir}':"$PATH"; resolve_agent_cli_version fakecli`,
    );
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('1.2.3');
  });

  it('resolve_agent_cli_version returns non-zero when CLI is missing', () => {
    const result = runHelper(
      `export PATH=/nonexistent; resolve_agent_cli_version doesnotexist; echo "exit=$?"`,
    );
    expect(result.stdout.trim()).toContain('exit=1');
  });

  it('resolve_agent_cli_version takes only the first line of multi-line --version output', () => {
    const dir = mkdtempSync(join(tmpdir(), 'multi-line-cli-'));
    const fakeCli = join(dir, 'multicli');
    writeFileSync(
      fakeCli,
      '#!/usr/bin/env bash\nprintf "multicli 0.4.0\\nbuild: 2026-05-01\\n"\n',
    );
    chmodSync(fakeCli, 0o755);

    const result = runHelper(
      `export PATH='${dir}':"$PATH"; resolve_agent_cli_version multicli`,
    );
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('0.4.0');
  });
});
