import { describe, it, expect } from 'vitest';
import {
  deriveSemanticTags,
  matchesAny,
  type ProjectStackConfig,
} from '@/lib/outcomes/stack-indicator-lookup';

describe('matchesAny', () => {
  it('matches ** glob across deep paths', () => {
    expect(matchesAny('a/b/c/foo.test.ts', ['**/*.test.ts'])).toBe(true);
  });

  it('matches root-level file pattern', () => {
    expect(matchesAny('Jenkinsfile', ['Jenkinsfile'])).toBe(true);
  });

  it('matches brace alternation', () => {
    expect(matchesAny('lib/foo.test.ts', ['**/*.test.{js,ts}'])).toBe(true);
    expect(matchesAny('lib/foo.test.js', ['**/*.test.{js,ts}'])).toBe(true);
  });

  it('returns false for empty pattern list', () => {
    expect(matchesAny('lib/foo.ts', [])).toBe(false);
  });

  it('matches dotfile/dotdir patterns when dot enabled', () => {
    expect(matchesAny('.github/workflows/ci.yml', ['.github/workflows/**'])).toBe(true);
  });
});

describe('deriveSemanticTags', () => {
  it('returns all-false when projectConfig is null', () => {
    const tags = deriveSemanticTags(['app/foo.ts'], null);
    expect(tags).toEqual({
      touchedDbSchema: false,
      touchedTests: false,
      touchedCi: false,
    });
  });

  it('returns all-false when service/framework/language unknown', () => {
    const cfg: ProjectStackConfig = {
      project: { language: 'haskell-but-not-supported', framework: null },
      services: [{ type: 'cassandra-not-supported' }],
      testing: { framework: 'tap-not-supported' },
    };
    const tags = deriveSemanticTags(
      ['migrations/0042.sql', 'tests/foo.test.ts', '.github/workflows/ci.yml'],
      cfg
    );
    // CI patterns are "generic" and always apply, so touchedCi should be true here.
    expect(tags.touchedCi).toBe(true);
    // db_schema and tests come from unknown frameworks → false.
    expect(tags.touchedDbSchema).toBe(false);
    expect(tags.touchedTests).toBe(false);
  });

  // === TypeScript / Vitest stack ===
  it('tags TypeScript+postgres+vitest project correctly', () => {
    const cfg: ProjectStackConfig = {
      project: { language: 'typescript', framework: 'nextjs' },
      services: [{ type: 'postgres' }],
      testing: { framework: 'vitest' },
    };
    const tags = deriveSemanticTags(
      ['prisma/schema.prisma', 'tests/integration/foo.test.ts', '.github/workflows/ci.yml'],
      cfg
    );
    expect(tags).toEqual({
      touchedDbSchema: true,
      touchedTests: true,
      touchedCi: true,
    });
  });

  // === Python / pytest stack (T025) ===
  it('tags Python+postgres+pytest project correctly', () => {
    const cfg: ProjectStackConfig = {
      project: { language: 'python', framework: 'django' },
      services: [{ type: 'postgres' }],
      testing: { framework: 'pytest' },
    };
    const tags = deriveSemanticTags(
      ['migrations/0042_add_field.py', 'tests/test_users.py', '.github/workflows/ci.yml'],
      cfg
    );
    expect(tags).toEqual({
      touchedDbSchema: true,
      touchedTests: true,
      touchedCi: true,
    });
  });

  // === Go / go-test stack (T025) ===
  it('tags Go+postgres+go-test project correctly', () => {
    const cfg: ProjectStackConfig = {
      project: { language: 'go', framework: null },
      services: [{ type: 'postgres' }],
      testing: { framework: 'go-test' },
    };
    const tags = deriveSemanticTags(
      ['migrations/0001_init.sql', 'foo/bar_test.go', '.github/workflows/ci.yml'],
      cfg
    );
    expect(tags).toEqual({
      touchedDbSchema: true,
      touchedTests: true,
      touchedCi: true,
    });
  });

  // === Rust / rust-test stack (T025) ===
  it('tags Rust+rust-test project correctly', () => {
    const cfg: ProjectStackConfig = {
      project: { language: 'rust', framework: null },
      services: [],
      testing: { framework: 'rust-test' },
    };
    const tags = deriveSemanticTags(
      ['tests/foo.rs', 'src/lib_test.rs', '.github/workflows/ci.yml'],
      cfg
    );
    expect(tags.touchedTests).toBe(true);
    expect(tags.touchedCi).toBe(true);
  });

  // === Zig stack (T025) ===
  it('tags Zig+zig-test project correctly', () => {
    const cfg: ProjectStackConfig = {
      project: { language: 'zig', framework: null },
      services: [],
      testing: { framework: 'zig-test' },
    };
    const tags = deriveSemanticTags(['src/test_foo.zig'], cfg);
    expect(tags.touchedTests).toBe(true);
  });

  it('returns false tags when no files match', () => {
    const cfg: ProjectStackConfig = {
      project: { language: 'typescript', framework: 'nextjs' },
      services: [{ type: 'postgres' }],
      testing: { framework: 'vitest' },
    };
    const tags = deriveSemanticTags(['app/page.tsx'], cfg);
    expect(tags).toEqual({
      touchedDbSchema: false,
      touchedTests: false,
      touchedCi: false,
    });
  });

  it('does not throw when projectConfig is undefined', () => {
    expect(() => deriveSemanticTags(['lib/foo.ts'], undefined)).not.toThrow();
  });
});
