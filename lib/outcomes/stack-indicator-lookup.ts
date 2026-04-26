/**
 * Generic stack-indicator lookup. Maps a project's declared services / testing framework /
 * language to a list of file globs used to derive the touchedDbSchema / touchedTests /
 * touchedCi semantic tags.
 *
 * Unknown keys fall through to empty pattern arrays — the lookup never throws (FR-009).
 */

import picomatch from 'picomatch';

export const STACK_INDICATORS = {
  services: {
    postgres: { db_schema: ['prisma/schema.prisma', 'migrations/**', '*.sql', 'db/migrate/**'] },
    mysql: { db_schema: ['migrations/**', '*.sql', 'db/migrate/**'] },
    sqlite: { db_schema: ['migrations/**', '*.sql'] },
    mongodb: { db_schema: ['migrations/**', 'models/**.ts', 'schemas/**'] },
  },
  testing: {
    vitest: { tests: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', 'tests/**', '__tests__/**'] },
    jest: { tests: ['**/*.test.{js,ts}', '**/*.spec.{js,ts}', 'tests/**', '__tests__/**'] },
    playwright: { tests: ['**/*.e2e.ts', 'tests/e2e/**'] },
    pytest: { tests: ['tests/**', '**/test_*.py', '**/*_test.py'] },
    'go-test': { tests: ['**/*_test.go'] },
    'rust-test': { tests: ['**/tests/**', '**/*_test.rs'] },
    'zig-test': { tests: ['**/test_*.zig', '**/*.test.zig'] },
  },
  languages: {
    typescript: { tests: ['**/*.test.ts', '**/*.spec.ts'], db_schema: [] as string[] },
    javascript: { tests: ['**/*.test.js', '**/*.spec.js'], db_schema: [] as string[] },
    python: { tests: ['tests/**', '**/test_*.py'], db_schema: ['migrations/**', '*.sql'] },
    go: { tests: ['**/*_test.go'], db_schema: ['migrations/**', '*.sql'] },
    rust: { tests: ['**/tests/**', '**/*_test.rs'], db_schema: ['migrations/**', '*.sql'] },
    zig: { tests: ['**/test_*.zig', '**/*.test.zig'], db_schema: [] as string[] },
  },
  ci: {
    generic: [
      '.github/workflows/**',
      '.gitlab-ci.yml',
      '.gitlab-ci.yaml',
      '.circleci/**',
      'azure-pipelines.yml',
      '.travis.yml',
      'Jenkinsfile',
      '.buildkite/**',
    ],
  },
} as const;

export interface ProjectStackConfig {
  project?: { language?: string | null; framework?: string | null } | null;
  services?: Array<{ type?: string | null }> | null;
  testing?: { framework?: string | null } | null;
}

export interface SemanticTags {
  touchedDbSchema: boolean;
  touchedTests: boolean;
  touchedCi: boolean;
}

type ServiceKey = keyof typeof STACK_INDICATORS.services;
type TestingKey = keyof typeof STACK_INDICATORS.testing;
type LanguageKey = keyof typeof STACK_INDICATORS.languages;

function lookupServicePatterns(serviceType: string | null | undefined): readonly string[] {
  if (!serviceType) return [];
  const entry = STACK_INDICATORS.services[serviceType as ServiceKey];
  return entry?.db_schema ?? [];
}

function lookupTestingPatterns(framework: string | null | undefined): readonly string[] {
  if (!framework) return [];
  const entry = STACK_INDICATORS.testing[framework as TestingKey];
  return entry?.tests ?? [];
}

function lookupLanguageTestPatterns(language: string | null | undefined): readonly string[] {
  if (!language) return [];
  const entry = STACK_INDICATORS.languages[language as LanguageKey];
  return entry?.tests ?? [];
}

function lookupLanguageDbPatterns(language: string | null | undefined): readonly string[] {
  if (!language) return [];
  const entry = STACK_INDICATORS.languages[language as LanguageKey];
  return entry?.db_schema ?? [];
}

export function matchesAny(filename: string, patterns: readonly string[]): boolean {
  if (patterns.length === 0) return false;
  for (const pattern of patterns) {
    if (picomatch.isMatch(filename, pattern, { dot: true })) return true;
  }
  return false;
}

export function deriveSemanticTags(
  files: readonly string[],
  projectConfig: ProjectStackConfig | null | undefined
): SemanticTags {
  const services = projectConfig?.services ?? [];
  const testFramework = projectConfig?.testing?.framework ?? null;
  const language = projectConfig?.project?.language ?? null;

  const dbPatterns = [
    ...services.flatMap((s) => lookupServicePatterns(s?.type)),
    ...lookupLanguageDbPatterns(language),
  ];
  const testPatterns = [
    ...lookupTestingPatterns(testFramework),
    ...lookupLanguageTestPatterns(language),
  ];
  const ciPatterns = STACK_INDICATORS.ci.generic;

  return {
    touchedDbSchema: files.some((f) => matchesAny(f, dbPatterns)),
    touchedTests: files.some((f) => matchesAny(f, testPatterns)),
    touchedCi: files.some((f) => matchesAny(f, ciPatterns)),
  };
}

export function getTestPatternsForProject(
  projectConfig: ProjectStackConfig | null | undefined
): string[] {
  const testFramework = projectConfig?.testing?.framework ?? null;
  const language = projectConfig?.project?.language ?? null;
  return [
    ...lookupTestingPatterns(testFramework),
    ...lookupLanguageTestPatterns(language),
  ];
}
