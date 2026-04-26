/**
 * Generic structural-domain and semantic-tag inference for ticket outcomes.
 *
 * Produces a small set of stable signals about WHERE a change happened and
 * WHAT kind of surface it touched (db schema, tests, CI). All inference is
 * driven by the project's declared `config` (see lib/validations/config.ts)
 * and a generic lookup table — no per-project hardcoding.
 */

import type { FileChange, ProjectConfigLike } from './types';

export const TAG_DB_SCHEMA = 'touched_db_schema';
export const TAG_TESTS = 'touched_tests';
export const TAG_CI = 'touched_ci';

const TEST_FRAMEWORK_PATH_FRAGMENTS: Record<string, string[]> = {
  vitest: ['vitest.config', 'tests/', '.test.', '.spec.'],
  jest: ['jest.config', 'tests/', '__tests__/', '.test.', '.spec.'],
  mocha: ['.mocharc', 'test/', '.test.', '.spec.'],
  pytest: ['pytest.ini', 'pyproject.toml', 'tests/', 'test_'],
  unittest: ['tests/', 'test_'],
  go: ['_test.go'],
  cargo: ['tests/', '#[test]'],
  rspec: ['spec/', '_spec.rb'],
  phpunit: ['phpunit.xml', 'tests/'],
  playwright: ['playwright.config', 'e2e/', 'tests/e2e/'],
  cypress: ['cypress.config', 'cypress/'],
};

const LANGUAGE_TEST_FRAGMENTS: Record<string, string[]> = {
  typescript: ['.test.', '.spec.', 'tests/', '__tests__/'],
  javascript: ['.test.', '.spec.', 'tests/', '__tests__/'],
  python: ['test_', 'tests/'],
  go: ['_test.go'],
  rust: ['tests/'],
  java: ['/test/', 'Test.java'],
  kotlin: ['/test/', 'Test.kt'],
  ruby: ['spec/', '_spec.rb'],
  php: ['tests/'],
  zig: ['tests/'],
};

const SERVICE_DB_FRAGMENTS: Record<string, string[]> = {
  postgres: ['migrations/', 'schema.prisma', 'schema.sql', '.sql'],
  mysql: ['migrations/', 'schema.sql', '.sql'],
  mongo: ['migrations/', 'schema.', 'models/'],
  redis: [],
};

const CI_PATH_FRAGMENTS = [
  '.github/workflows/',
  '.github/actions/',
  '.gitlab-ci',
  '.circleci/',
  'azure-pipelines',
  'Jenkinsfile',
  '.travis.yml',
  'bitbucket-pipelines',
  '.drone.yml',
];

/**
 * Extract the top-level path segment for each touched file.
 *
 * Files at the repo root are bucketed under '(root)' so they remain queryable
 * instead of being silently dropped.
 */
export function extractStructuralDomains(files: FileChange[]): string[] {
  const segments = new Set<string>();
  for (const file of files) {
    const path = (file.path ?? '').replace(/^\/+/, '');
    if (!path) continue;
    const idx = path.indexOf('/');
    segments.add(idx === -1 ? '(root)' : path.slice(0, idx));
  }
  return Array.from(segments).sort();
}

function fragmentsForLanguage(language: string | null | undefined): string[] {
  if (!language) return [];
  return LANGUAGE_TEST_FRAGMENTS[language] ?? [];
}

function fragmentsForTestingFramework(
  framework: string | undefined,
  e2eFramework: string | undefined
): string[] {
  const fragments: string[] = [];
  const direct = framework ? TEST_FRAMEWORK_PATH_FRAGMENTS[framework.toLowerCase()] : undefined;
  if (direct) fragments.push(...direct);
  const e2e = e2eFramework ? TEST_FRAMEWORK_PATH_FRAGMENTS[e2eFramework.toLowerCase()] : undefined;
  if (e2e) fragments.push(...e2e);
  return fragments;
}

function fragmentsForServices(services: Array<{ type?: string }> | undefined): string[] {
  if (!services?.length) return [];
  const fragments: string[] = [];
  for (const svc of services) {
    const t = svc.type?.toLowerCase();
    if (!t) continue;
    fragments.push(...(SERVICE_DB_FRAGMENTS[t] ?? []));
  }
  return fragments;
}

/**
 * Build the per-project test-path matchers.
 * Combines the declared testing framework, e2e framework, and language defaults.
 */
function buildTestFragments(config: ProjectConfigLike | null | undefined): string[] {
  const language = config?.project?.language ?? null;
  const fromFramework = fragmentsForTestingFramework(
    config?.testing?.framework,
    config?.testing?.e2e_framework
  );
  const fromLanguage = fragmentsForLanguage(language);
  // De-dup while preserving stable order (framework before language).
  return Array.from(new Set([...fromFramework, ...fromLanguage]));
}

/**
 * Build the per-project DB-schema matchers.
 * Combines declared services with a generic `migrations/` fallback.
 */
function buildDbSchemaFragments(config: ProjectConfigLike | null | undefined): string[] {
  const fromServices = fragmentsForServices(config?.services);
  // Always allow generic `migrations/` paths; many repos place them outside service config.
  return Array.from(new Set([...fromServices, 'migrations/']));
}

function pathMatchesAny(path: string, fragments: readonly string[]): boolean {
  if (!path) return false;
  return fragments.some((f) => path.includes(f));
}

export interface SemanticTagsResult {
  tags: string[];
  codeFilesChanged: number;
  testFilesChanged: number;
}

/**
 * Compute semantic tags + test/code file split for a list of changed files.
 *
 * Tag derivation:
 *   - touched_db_schema: any file matches the project's DB schema fragments
 *   - touched_tests: any file matches the project's test fragments
 *   - touched_ci: any file matches generic CI paths (cross-stack)
 *
 * Returns tags sorted alphabetically for deterministic storage.
 */
export function computeSemanticTags(
  files: FileChange[],
  config: ProjectConfigLike | null | undefined
): SemanticTagsResult {
  const testFragments = buildTestFragments(config);
  const dbFragments = buildDbSchemaFragments(config);

  let touchedDb = false;
  let touchedTests = false;
  let touchedCi = false;
  let testCount = 0;
  let codeCount = 0;

  for (const file of files) {
    const path = file.path ?? '';
    const isTest = pathMatchesAny(path, testFragments);
    const isCi = pathMatchesAny(path, CI_PATH_FRAGMENTS);
    const isDb = pathMatchesAny(path, dbFragments);

    if (isTest) {
      touchedTests = true;
      testCount += 1;
    } else if (!isCi) {
      // CI files are not counted as "code" for the test-vs-code ratio.
      codeCount += 1;
    }
    if (isDb) touchedDb = true;
    if (isCi) touchedCi = true;
  }

  const tags: string[] = [];
  if (touchedDb) tags.push(TAG_DB_SCHEMA);
  if (touchedTests) tags.push(TAG_TESTS);
  if (touchedCi) tags.push(TAG_CI);

  return {
    tags: tags.sort(),
    codeFilesChanged: codeCount,
    testFilesChanged: testCount,
  };
}
