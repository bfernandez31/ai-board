import { describe, it, expect } from 'vitest';
import {
  computeSemanticTags,
  extractStructuralDomains,
  TAG_CI,
  TAG_DB_SCHEMA,
  TAG_TESTS,
} from '@/lib/outcomes/domain';

describe('extractStructuralDomains', () => {
  it('returns the unique top-level path segment for each touched file', () => {
    const domains = extractStructuralDomains([
      { path: 'lib/outcomes/compute.ts', additions: 10, deletions: 0 },
      { path: 'lib/outcomes/jobs.ts', additions: 5, deletions: 1 },
      { path: 'app/api/foo.ts', additions: 1, deletions: 1 },
      { path: 'tests/unit/foo.test.ts', additions: 8, deletions: 0 },
    ]);
    expect(domains).toEqual(['app', 'lib', 'tests']);
  });

  it('buckets root-level files under "(root)"', () => {
    const domains = extractStructuralDomains([
      { path: 'README.md', additions: 1, deletions: 0 },
      { path: 'lib/foo.ts', additions: 1, deletions: 0 },
    ]);
    expect(domains).toEqual(['(root)', 'lib']);
  });

  it('strips a leading slash before bucketing', () => {
    const domains = extractStructuralDomains([
      { path: '/lib/foo.ts', additions: 1, deletions: 0 },
    ]);
    expect(domains).toEqual(['lib']);
  });

  it('skips empty paths defensively', () => {
    const domains = extractStructuralDomains([
      { path: '', additions: 0, deletions: 0 },
      { path: 'lib/foo.ts', additions: 1, deletions: 0 },
    ]);
    expect(domains).toEqual(['lib']);
  });

  it('returns empty array for empty input', () => {
    expect(extractStructuralDomains([])).toEqual([]);
  });
});

describe('computeSemanticTags — TypeScript/Next stack', () => {
  const tsConfig = {
    project: { language: 'typescript', framework: 'nextjs' },
    services: [{ type: 'postgres' }],
    testing: { framework: 'vitest', e2e: true, e2e_framework: 'playwright' },
  };

  it('tags db_schema when prisma schema is touched', () => {
    const result = computeSemanticTags(
      [{ path: 'prisma/schema.prisma', additions: 5, deletions: 0 }],
      tsConfig
    );
    expect(result.tags).toContain(TAG_DB_SCHEMA);
  });

  it('tags db_schema when migrations directory is touched', () => {
    const result = computeSemanticTags(
      [{ path: 'prisma/migrations/20260101_add/migration.sql', additions: 5, deletions: 0 }],
      tsConfig
    );
    expect(result.tags).toContain(TAG_DB_SCHEMA);
  });

  it('tags tests for vitest .test.ts files', () => {
    const result = computeSemanticTags(
      [{ path: 'tests/unit/foo.test.ts', additions: 10, deletions: 0 }],
      tsConfig
    );
    expect(result.tags).toContain(TAG_TESTS);
    expect(result.testFilesChanged).toBe(1);
    expect(result.codeFilesChanged).toBe(0);
  });

  it('tags tests for playwright e2e files', () => {
    const result = computeSemanticTags(
      [{ path: 'tests/e2e/login.spec.ts', additions: 5, deletions: 0 }],
      tsConfig
    );
    expect(result.tags).toContain(TAG_TESTS);
  });

  it('tags ci for github workflow changes', () => {
    const result = computeSemanticTags(
      [{ path: '.github/workflows/deploy.yml', additions: 5, deletions: 1 }],
      tsConfig
    );
    expect(result.tags).toContain(TAG_CI);
  });

  it('returns sorted, deduplicated tags', () => {
    const result = computeSemanticTags(
      [
        { path: 'tests/unit/foo.test.ts', additions: 1, deletions: 0 },
        { path: '.github/workflows/x.yml', additions: 1, deletions: 0 },
        { path: 'prisma/schema.prisma', additions: 1, deletions: 0 },
      ],
      tsConfig
    );
    expect(result.tags).toEqual([TAG_DB_SCHEMA, TAG_TESTS, TAG_CI].sort());
  });

  it('splits code vs test file counts correctly and excludes CI from code', () => {
    const result = computeSemanticTags(
      [
        { path: 'lib/foo.ts', additions: 5, deletions: 0 },
        { path: 'lib/bar.ts', additions: 3, deletions: 0 },
        { path: 'tests/unit/foo.test.ts', additions: 5, deletions: 0 },
        { path: '.github/workflows/x.yml', additions: 1, deletions: 0 },
      ],
      tsConfig
    );
    expect(result.codeFilesChanged).toBe(2);
    expect(result.testFilesChanged).toBe(1);
  });
});

describe('computeSemanticTags — works for non-TypeScript stacks', () => {
  it('detects go _test.go test files via language fragments', () => {
    const result = computeSemanticTags(
      [
        { path: 'pkg/widget/widget.go', additions: 10, deletions: 0 },
        { path: 'pkg/widget/widget_test.go', additions: 8, deletions: 0 },
      ],
      { project: { language: 'go' } }
    );
    expect(result.tags).toContain(TAG_TESTS);
    expect(result.testFilesChanged).toBe(1);
    expect(result.codeFilesChanged).toBe(1);
  });

  it('detects pytest test_ prefix via testing framework override', () => {
    const result = computeSemanticTags(
      [
        { path: 'src/foo.py', additions: 5, deletions: 0 },
        { path: 'tests/test_foo.py', additions: 5, deletions: 0 },
      ],
      { project: { language: 'python' }, testing: { framework: 'pytest', e2e: false } }
    );
    expect(result.tags).toContain(TAG_TESTS);
  });

  it('detects rust /tests/ directory via language fragment', () => {
    const result = computeSemanticTags(
      [
        { path: 'src/main.rs', additions: 10, deletions: 0 },
        { path: 'tests/integration.rs', additions: 5, deletions: 0 },
      ],
      { project: { language: 'rust' } }
    );
    expect(result.tags).toContain(TAG_TESTS);
  });

  it('detects ruby _spec.rb files via language fragment', () => {
    const result = computeSemanticTags(
      [{ path: 'spec/widget_spec.rb', additions: 5, deletions: 0 }],
      { project: { language: 'ruby' } }
    );
    expect(result.tags).toContain(TAG_TESTS);
  });

  it('detects zig /tests/ directory via language fragment', () => {
    const result = computeSemanticTags(
      [{ path: 'tests/widget.zig', additions: 5, deletions: 0 }],
      { project: { language: 'zig' } }
    );
    expect(result.tags).toContain(TAG_TESTS);
  });

  it('still detects CI changes for arbitrary stacks (cross-stack pattern)', () => {
    const result = computeSemanticTags(
      [{ path: '.gitlab-ci.yml', additions: 1, deletions: 0 }],
      { project: { language: 'go' } }
    );
    expect(result.tags).toContain(TAG_CI);
  });

  it('detects mysql migrations via service type', () => {
    const result = computeSemanticTags(
      [{ path: 'db/migrations/001_init.sql', additions: 10, deletions: 0 }],
      { project: { language: 'go' }, services: [{ type: 'mysql' }] }
    );
    expect(result.tags).toContain(TAG_DB_SCHEMA);
  });

  it('returns no semantic tags when only generic source code is touched', () => {
    const result = computeSemanticTags(
      [
        { path: 'src/main.rs', additions: 5, deletions: 0 },
        { path: 'src/lib.rs', additions: 3, deletions: 0 },
      ],
      { project: { language: 'rust' } }
    );
    expect(result.tags).toEqual([]);
    expect(result.codeFilesChanged).toBe(2);
    expect(result.testFilesChanged).toBe(0);
  });

  it('handles missing project config gracefully', () => {
    const result = computeSemanticTags(
      [
        { path: '.github/workflows/x.yml', additions: 1, deletions: 0 },
        { path: 'src/main.go', additions: 5, deletions: 0 },
      ],
      null
    );
    // CI is cross-stack; tests need language context so no test tag here
    expect(result.tags).toEqual([TAG_CI]);
  });
});
