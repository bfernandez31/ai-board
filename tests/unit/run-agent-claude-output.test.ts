/**
 * Unit tests for the Claude output reducer in run-agent.sh.
 *
 * Spawns bash to source `emit_claude_results` and feeds it a stream-json
 * transcript. Guards the regression where a background-task wake-up turn
 * replaced the agent's real answer on stdout, dropping the QUALITY_SCORE_JSON
 * marker that verify.yml parses.
 */

import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RUN_AGENT_SH = resolve(__dirname, '../../.github/scripts/run-agent.sh');

function emitClaudeResults(stream: string): { stdout: string; code: number | null } {
  const wrapper = `
    set -uo pipefail
    eval "$(awk '/^emit_claude_results\\(\\) {/,/^}$/ { print }' '${RUN_AGENT_SH}')"
    emit_claude_results
  `;
  const result = spawnSync('bash', ['-c', wrapper], { encoding: 'utf8', input: stream });
  return { stdout: result.stdout, code: result.status };
}

const MARKER = 'QUALITY_SCORE_JSON:{"version":1,"qualityScore":98,"threshold":"Excellent"}';

describe('run-agent.sh emit_claude_results', () => {
  it('prints the single result of a normal run and nothing else', () => {
    const stream = [
      JSON.stringify({ type: 'system', subtype: 'init', tools: ['Bash'] }),
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'working' }] } }),
      JSON.stringify({ type: 'result', subtype: 'success', result: `Review posted.\n${MARKER}` }),
    ].join('\n');

    const { stdout, code } = emitClaudeResults(stream);
    expect(code).toBe(0);
    expect(stdout).toBe(`Review posted.\n${MARKER}\n`);
  });

  it('keeps the first result when a background-task wake-up produces a second one', () => {
    const stream = [
      JSON.stringify({ type: 'result', subtype: 'success', result: MARKER }),
      JSON.stringify({ type: 'system', subtype: 'task_notification', status: 'completed' }),
      JSON.stringify({ type: 'result', subtype: 'success', result: 'The monitor expired, no action needed.' }),
    ].join('\n');

    const { stdout } = emitClaudeResults(stream);
    expect(stdout).toBe(`${MARKER}\nThe monitor expired, no action needed.\n`);
  });

  it('passes non-JSON lines through and skips results without text', () => {
    const stream = [
      'Warning: something the CLI printed outside the stream',
      '42',
      JSON.stringify({ type: 'result', subtype: 'error_max_turns' }),
      JSON.stringify({ type: 'result', subtype: 'success', result: 'done' }),
    ].join('\n');

    const { stdout, code } = emitClaudeResults(stream);
    expect(code).toBe(0);
    expect(stdout).toBe('Warning: something the CLI printed outside the stream\n42\ndone\n');
  });
});
