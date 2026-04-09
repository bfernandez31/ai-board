import { describe, expect, it } from 'vitest';
import { generateProjectConfig, generateProjectConfigYaml } from '@/lib/onboarding/generate-config';
import type { RepositoryAnalysisSummary } from '@/lib/onboarding/detect-stack';

function createAnalysis(overrides: Partial<RepositoryAnalysisSummary> = {}): RepositoryAnalysisSummary {
  return {
    projectName: 'demo',
    primaryLanguage: 'typescript',
    packageManager: 'bun',
    framework: 'nextjs',
    services: [{ type: 'postgres', version: 'latest' }],
    commands: {
      install: 'bun install',
      build: 'bun run build',
      lint: 'bun run lint',
      type_check: 'bun run type-check',
      test_unit: 'bun run test:unit',
    },
    runtime: { manager: 'bun', node: '22' },
    agent: { cli: 'claude-code' },
    signals: ['Detected package.json'],
    conflicts: [],
    defaultBranch: 'main',
    ...overrides,
  };
}

describe('generateProjectConfig', () => {
  it('builds a schema-valid config from analysis', () => {
    const config = generateProjectConfig(createAnalysis());
    expect(config.project.language).toBe('typescript');
    expect(config.runtime.manager).toBe('bun');
    expect(config.commands.type_check).toBe('bun run type-check');
  });

  it('supports Ruby and PHP outputs', () => {
    const rubyConfig = generateProjectConfig(createAnalysis({
      primaryLanguage: 'ruby',
      packageManager: 'bundler',
      framework: 'rails',
      commands: { install: 'bundle install', test_unit: 'bundle exec rspec' },
      runtime: { manager: 'bundler', ruby: '3.3' },
    }));
    const phpConfig = generateProjectConfig(createAnalysis({
      primaryLanguage: 'php',
      packageManager: 'composer',
      framework: 'laravel',
      commands: { install: 'composer install', test_unit: 'php artisan test' },
      runtime: { manager: 'composer', php: '8.3' },
    }));

    expect(rubyConfig.runtime.ruby).toBe('3.3');
    expect(phpConfig.runtime.php).toBe('8.3');
  });

  it('serializes config yaml with the detected fields', () => {
    const { yaml } = generateProjectConfigYaml(createAnalysis({
      commands: { install: 'bun install', test_unit: 'bun run test:unit' },
    }));

    expect(yaml).toContain('language: typescript');
    expect(yaml).toContain('manager: bun');
    expect(yaml).toContain('install: bun install');
  });
});
