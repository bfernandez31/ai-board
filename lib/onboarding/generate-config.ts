import { stringify } from 'yaml';
import { validateConfig } from '@/lib/validations/config';
import type { ProjectConfig } from '@/lib/validations/config';
import type { RepositoryAnalysisSummary } from '@/lib/onboarding/detect-stack';

function compactObject<T extends Record<string, string | undefined>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as Partial<T>;
}

export function generateProjectConfig(analysis: RepositoryAnalysisSummary): ProjectConfig {
  const config: ProjectConfig = {
    version: 1,
    project: {
      name: analysis.projectName,
      language: analysis.primaryLanguage,
      framework: analysis.framework,
    },
    runtime: compactObject({
      manager: analysis.packageManager,
      manager_version: analysis.runtime.manager_version,
      node: analysis.runtime.node,
      python: analysis.runtime.python,
      java: analysis.runtime.java,
      go: analysis.runtime.go,
      rust: analysis.runtime.rust,
      ruby: analysis.runtime.ruby,
      php: analysis.runtime.php,
    }) as ProjectConfig['runtime'],
    services: analysis.services,
    commands: {
      install: analysis.commands.install ?? inferInstallFallback(analysis),
      build: analysis.commands.build,
      lint: analysis.commands.lint,
      type_check: analysis.commands.type_check,
      test_unit: analysis.commands.test_unit,
      test_integration: analysis.commands.test_integration,
      test_e2e: analysis.commands.test_e2e,
      db_setup: analysis.commands.db_setup,
      db_seed: analysis.commands.db_seed,
    },
    env: {},
    agent: analysis.agent,
  };

  const validation = validateConfig(config);
  if (!validation.success) {
    throw new Error(validation.errors.map((error) => `${error.path}: ${error.message}`).join('; '));
  }

  return validation.data;
}

function inferInstallFallback(analysis: RepositoryAnalysisSummary): string {
  switch (analysis.packageManager) {
    case 'bun':
    case 'npm':
    case 'pnpm':
    case 'yarn':
    case 'poetry':
    case 'pip':
    case 'cargo':
    case 'maven':
    case 'gradle':
    case 'bundler':
    case 'composer':
      return `${analysis.packageManager} install`;
    default:
      return 'echo "No install step inferred"';
  }
}

export function serializeProjectConfig(config: ProjectConfig): string {
  return stringify(config, {
    indent: 2,
    lineWidth: 0,
  });
}

export function generateProjectConfigYaml(analysis: RepositoryAnalysisSummary): {
  config: ProjectConfig;
  yaml: string;
} {
  const config = generateProjectConfig(analysis);
  return {
    config,
    yaml: serializeProjectConfig(config),
  };
}
