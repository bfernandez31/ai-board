import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

describe('Plugin Path Resolution', () => {
  const scriptsDir = path.join(process.cwd(), '.specify/scripts/bash');
  const commonShPath = path.join(scriptsDir, 'common.sh');

  describe('get_plugin_root()', () => {
    it('returns CLAUDE_PLUGIN_ROOT when set', async () => {
      const testRoot = '/test/plugin/root';
      const { stdout } = await execAsync(
        `source "${commonShPath}" && get_plugin_root`,
        {
          shell: '/bin/bash',
          env: { ...process.env, CLAUDE_PLUGIN_ROOT: testRoot },
        }
      );
      expect(stdout.trim()).toBe(testRoot);
    });

    it('returns git repo root when CLAUDE_PLUGIN_ROOT is not set', async () => {
      const { stdout: gitRoot } = await execAsync('git rev-parse --show-toplevel');
      const { stdout } = await execAsync(
        `source "${commonShPath}" && get_plugin_root`,
        {
          shell: '/bin/bash',
          env: { ...process.env, CLAUDE_PLUGIN_ROOT: '' },
        }
      );
      expect(stdout.trim()).toBe(gitRoot.trim());
    });

    it('respects CLAUDE_PLUGIN_ROOT over git root', async () => {
      const testRoot = '/custom/plugin/path';
      const { stdout: gitRoot } = await execAsync('git rev-parse --show-toplevel');
      const { stdout } = await execAsync(
        `source "${commonShPath}" && get_plugin_root`,
        {
          shell: '/bin/bash',
          env: { ...process.env, CLAUDE_PLUGIN_ROOT: testRoot },
        }
      );
      expect(stdout.trim()).toBe(testRoot);
      expect(stdout.trim()).not.toBe(gitRoot.trim());
    });
  });

  describe('get_repo_root()', () => {
    it('returns git repository root', async () => {
      const { stdout: expected } = await execAsync('git rev-parse --show-toplevel');
      const { stdout } = await execAsync(
        `source "${commonShPath}" && get_repo_root`,
        { shell: '/bin/bash' }
      );
      expect(stdout.trim()).toBe(expected.trim());
    });
  });
});
