import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Regression test for ai-board's own config.yml.
 * Verifies that the updated config.yml with the new testing section
 * produces the correct values that the generic runner would use.
 */

const CONFIG_PATH = join(__dirname, '../../../.ai-board/config.yml');

const hasYq = (() => {
  try { execSync('which yq', { encoding: 'utf-8' }); return true; } catch { return false; }
})();

function readYq(key: string): string {
  return execSync(`yq -r '${key}' "${CONFIG_PATH}"`, {
    encoding: 'utf-8',
    timeout: 5000,
  }).trim();
}

describe.skipIf(!hasYq)('ai-board config.yml regression', () => {
  it('has vitest as test framework', () => {
    expect(readYq('.testing.framework')).toBe('vitest');
  });

  it('has E2E enabled with playwright', () => {
    expect(readYq('.testing.e2e')).toBe('true');
    expect(readYq('.testing.e2e_framework')).toBe('playwright');
  });

  it('has granular test commands (take priority over commands.test)', () => {
    expect(readYq('.commands.test_unit')).toBe('bun run test:unit');
    expect(readYq('.commands.test_integration')).toBe('bun run test:integration');
    expect(readYq('.commands.test_e2e')).toBe('bun run test:e2e');
  });

  it('has generic test command as fallback', () => {
    expect(readYq('.commands.test')).toBe('bun run test');
  });

  it('has dev_server command for integration/e2e', () => {
    expect(readYq('.commands.dev_server')).toBe('TEST_MODE=true bun run dev');
  });

  it('granular commands take priority over commands.test per resolution rules', () => {
    // Verify all three granular commands exist — when present, runner uses these
    // instead of commands.test, resulting in weighted scoring (-1/-3/-5)
    const hasUnit = readYq('.commands.test_unit') !== 'null';
    const hasInt = readYq('.commands.test_integration') !== 'null';
    const hasE2e = readYq('.commands.test_e2e') !== 'null';
    expect(hasUnit && hasInt && hasE2e).toBe(true);
  });

  it('preserves existing command structure', () => {
    expect(readYq('.commands.install')).toBe('bun install --frozen-lockfile');
    expect(readYq('.commands.build')).toBe('bun run build');
    expect(readYq('.commands.lint')).toBe('bun run lint');
    expect(readYq('.commands.type_check')).toBe('bun run type-check');
  });
});
