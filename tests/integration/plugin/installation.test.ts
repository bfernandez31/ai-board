import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';

describe('Plugin Installation Validation', () => {
  const repoRoot = process.cwd();

  describe('Plugin Manifest', () => {
    it('has valid plugin.json manifest', () => {
      const manifestPath = path.join(repoRoot, '.claude-plugin/plugin.json');
      expect(existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      expect(manifest.name).toBe('ai-board');
      expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(manifest.commands).toBe('./commands/');
      expect(manifest.skills).toBe('./skills/');
      expect(manifest.hooks).toBe('./hooks/hooks.json');
    });
  });

  describe('Hooks Configuration', () => {
    it('has valid hooks.json', () => {
      const hooksPath = path.join(repoRoot, 'hooks/hooks.json');
      expect(existsSync(hooksPath)).toBe(true);

      const hooks = JSON.parse(readFileSync(hooksPath, 'utf-8'));
      expect(hooks.hooks).toBeDefined();
      expect(hooks.hooks.SessionStart).toBeDefined();
      expect(hooks.hooks.SessionStart[0].hooks[0].type).toBe('command');
      expect(hooks.hooks.SessionStart[0].hooks[0].command).toContain(
        'setup-constitution.sh'
      );
    });
  });

  describe('Directory Structure', () => {
    const requiredDirs = [
      '.claude-plugin',
      'commands',
      'scripts/bash',
      'templates',
      'skills',
      'memory',
    ];

    requiredDirs.forEach((dir) => {
      it(`has ${dir}/ directory`, () => {
        const dirPath = path.join(repoRoot, dir);
        expect(existsSync(dirPath)).toBe(true);
        expect(statSync(dirPath).isDirectory()).toBe(true);
      });
    });
  });

  describe('Constitution Template', () => {
    it('has constitution.md template in memory/', () => {
      const constitutionPath = path.join(repoRoot, 'memory/constitution.md');
      expect(existsSync(constitutionPath)).toBe(true);

      const content = readFileSync(constitutionPath, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('Setup Constitution Script', () => {
    it('has setup-constitution.sh script', () => {
      const scriptPath = path.join(
        repoRoot,
        '.specify/scripts/bash/setup-constitution.sh'
      );
      expect(existsSync(scriptPath)).toBe(true);

      // Check executable permission
      const stats = statSync(scriptPath);
      const isExecutable = (stats.mode & 0o111) !== 0;
      expect(isExecutable).toBe(true);
    });
  });

  describe('Path Resolution Utility', () => {
    it('has get_plugin_root function in common.sh', () => {
      const commonShPath = path.join(
        repoRoot,
        '.specify/scripts/bash/common.sh'
      );
      expect(existsSync(commonShPath)).toBe(true);

      const content = readFileSync(commonShPath, 'utf-8');
      expect(content).toContain('get_plugin_root()');
      expect(content).toContain('CLAUDE_PLUGIN_ROOT');
    });
  });
});
