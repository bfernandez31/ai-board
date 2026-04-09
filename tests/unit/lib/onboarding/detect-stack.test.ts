import { mkdir, writeFile } from 'node:fs/promises';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectStackFromRepository } from '@/lib/onboarding/detect-stack';

const tempRoots: string[] = [];

async function createRepo(name: string, files: Record<string, string>) {
  const repoRoot = path.join(os.tmpdir(), `ai-board-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  tempRoots.push(repoRoot);
  await mkdir(repoRoot, { recursive: true });

  for (const [relativePath, content] of Object.entries(files)) {
    const destination = path.join(repoRoot, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content, 'utf8');
  }

  return repoRoot;
}

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe('detectStackFromRepository', () => {
  it('prefers bun + nextjs for a typed node repository', async () => {
    const repoRoot = await createRepo('next', {
      'package.json': JSON.stringify({
        name: 'web-app',
        dependencies: { next: '16.0.0' },
        scripts: { build: 'next build', lint: 'next lint', 'test:unit': 'vitest run' },
      }),
      'tsconfig.json': '{}',
      'bun.lockb': '',
      'prisma/schema.prisma': 'datasource db { provider = "postgresql" url = env("DATABASE_URL") }',
    });

    const result = await detectStackFromRepository(repoRoot, { agent: 'CODEX', defaultBranch: 'trunk' });
    expect(result.primaryLanguage).toBe('typescript');
    expect(result.packageManager).toBe('bun');
    expect(result.framework).toBe('nextjs');
    expect(result.agent.cli).toBe('codex');
    expect(result.defaultBranch).toBe('trunk');
    expect(result.services).toEqual([{ type: 'postgres', version: 'latest' }]);
  });

  it('detects rails repositories deterministically', async () => {
    const repoRoot = await createRepo('rails', {
      'Gemfile': "gem 'rails'\n",
      'config/application.rb': 'module Demo; end',
    });

    const result = await detectStackFromRepository(repoRoot);
    expect(result.primaryLanguage).toBe('ruby');
    expect(result.packageManager).toBe('bundler');
    expect(result.framework).toBe('rails');
    expect(result.commands.install).toBe('bundle install');
  });

  it('detects laravel repositories deterministically', async () => {
    const repoRoot = await createRepo('laravel', {
      'composer.json': JSON.stringify({ require: { laravel: '^11.0' } }),
      'artisan': '',
    });

    const result = await detectStackFromRepository(repoRoot);
    expect(result.primaryLanguage).toBe('php');
    expect(result.packageManager).toBe('composer');
    expect(result.framework).toBe('laravel');
  });

  it('throws when no supported stack can be inferred', async () => {
    const repoRoot = await createRepo('unknown', {
      'README.md': '# hello',
    });

    await expect(detectStackFromRepository(repoRoot)).rejects.toThrow(
      'Unable to determine a supported project stack',
    );
  });
});
