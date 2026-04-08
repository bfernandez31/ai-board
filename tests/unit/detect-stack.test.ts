import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { parse as parseYaml } from 'yaml';

const SCRIPT_PATH = path.resolve(__dirname, '../../.github/scripts/detect-stack.sh');

// ─── Helpers ────────────────────────────────────────────────────────

function createFixtureDir(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `detect-stack-${name}-`));
  return dir;
}

function runDetectStack(fixtureDir: string): { exitCode: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(`bash "${SCRIPT_PATH}" "${fixtureDir}"`, {
      encoding: 'utf-8',
      timeout: 15000,
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (error: unknown) {
    const err = error as { status: number; stdout: string; stderr: string };
    return { exitCode: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

function readConfigYml(fixtureDir: string): Record<string, unknown> {
  const configPath = path.join(fixtureDir, '.ai-board', 'config.yml');
  const content = fs.readFileSync(configPath, 'utf-8');
  return parseYaml(content) as Record<string, unknown>;
}

interface AnalysisResult {
  language: string | null;
  framework: string | null;
  packageManager: string | null;
  testFramework: string | null;
  services: Array<{ type: string; source: string }>;
  commands: Record<string, string>;
  manifests: string[];
  lockfiles: string[];
  configFiles: string[];
  projectName: string;
  runtimeVersions: Record<string, string>;
  secondaryLanguages: string[];
}

function readAnalysisJson(fixtureDir: string): AnalysisResult {
  const analysisPath = path.join(fixtureDir, 'analysis.json');
  const content = fs.readFileSync(analysisPath, 'utf-8');
  return JSON.parse(content) as AnalysisResult;
}

function cleanupFixture(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── TypeScript/Next.js Fixture ─────────────────────────────────────

describe('detect-stack.sh — TypeScript/Next.js', () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = createFixtureDir('ts-nextjs');

    // package.json with next, prisma, vitest
    fs.writeFileSync(
      path.join(fixtureDir, 'package.json'),
      JSON.stringify({
        name: 'my-nextjs-app',
        dependencies: { next: '16.0.0', '@prisma/client': '6.0.0' },
        devDependencies: { typescript: '5.9.0', vitest: '4.0.0', prisma: '6.0.0' },
        scripts: { dev: 'next dev', build: 'next build', test: 'vitest run', lint: 'eslint .' },
      }),
    );

    // bun lockfile
    fs.writeFileSync(path.join(fixtureDir, 'bun.lockb'), '');

    // tsconfig
    fs.writeFileSync(path.join(fixtureDir, 'tsconfig.json'), '{}');

    // vitest config
    fs.writeFileSync(path.join(fixtureDir, 'vitest.config.ts'), 'export default {}');

    // docker-compose with postgres
    fs.writeFileSync(
      path.join(fixtureDir, 'docker-compose.yml'),
      'services:\n  db:\n    image: postgres:14\n',
    );

    // prisma schema
    fs.mkdirSync(path.join(fixtureDir, 'prisma'));
    fs.writeFileSync(
      path.join(fixtureDir, 'prisma', 'schema.prisma'),
      'datasource db {\n  provider = "postgresql"\n}\n',
    );

    const result = runDetectStack(fixtureDir);
    expect(result.exitCode).toBe(0);
  });

  afterAll(() => cleanupFixture(fixtureDir));

  it('config.yml has correct language, framework, package manager', () => {
    const config = readConfigYml(fixtureDir);
    const project = config.project as Record<string, unknown>;
    const runtime = config.runtime as Record<string, unknown>;

    expect(project.language).toBe('typescript');
    expect(project.framework).toBe('nextjs');
    expect(runtime.manager).toBe('bun');
  });

  it('analysis.json has correct structure and values', () => {
    const analysis = readAnalysisJson(fixtureDir);

    expect(analysis.language).toBe('typescript');
    expect(analysis.framework).toBe('nextjs');
    expect(analysis.packageManager).toBe('bun');
    expect(analysis.testFramework).toBe('vitest');
    expect(analysis.projectName).toBe('my-nextjs-app');

    // Services
    expect(analysis.services).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'postgres' })]),
    );

    // Structure validation — all required fields exist
    expect(analysis).toHaveProperty('language');
    expect(analysis).toHaveProperty('framework');
    expect(analysis).toHaveProperty('packageManager');
    expect(analysis).toHaveProperty('testFramework');
    expect(analysis).toHaveProperty('services');
    expect(analysis).toHaveProperty('commands');
    expect(analysis).toHaveProperty('manifests');
    expect(analysis).toHaveProperty('lockfiles');
    expect(analysis).toHaveProperty('configFiles');
    expect(analysis).toHaveProperty('projectName');
    expect(analysis).toHaveProperty('runtimeVersions');
    expect(analysis).toHaveProperty('secondaryLanguages');

    // Manifests and lockfiles
    expect(analysis.manifests).toContain('package.json');
    expect(analysis.lockfiles).toContain('bun.lockb');
  });
});

// ─── Empty Repository ───────────────────────────────────────────────

describe('detect-stack.sh — Empty repository', () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = createFixtureDir('empty');
    // No manifest files at all

    const result = runDetectStack(fixtureDir);
    expect(result.exitCode).toBe(0);
  });

  afterAll(() => cleanupFixture(fixtureDir));

  it('config.yml has null language and project name from directory', () => {
    const config = readConfigYml(fixtureDir);
    const project = config.project as Record<string, unknown>;

    expect(project.language).toBeNull();
    expect(project.name).toBeTruthy();
  });

  it('analysis.json has null language and project name from directory name', () => {
    const analysis = readAnalysisJson(fixtureDir);

    expect(analysis.language).toBeNull();
    expect(analysis.framework).toBeNull();
    expect(analysis.packageManager).toBeNull();
    expect(analysis.manifests).toEqual([]);
    expect(analysis.lockfiles).toEqual([]);
    expect(analysis.projectName).toBeTruthy();
  });
});

// ─── Detection Script Independence (US2) ────────────────────────────

describe('detect-stack.sh — Independent execution (US2)', () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = createFixtureDir('independent');
    fs.writeFileSync(
      path.join(fixtureDir, 'package.json'),
      JSON.stringify({ name: 'test-app', dependencies: {}, devDependencies: { typescript: '5.0.0' } }),
    );
    fs.writeFileSync(path.join(fixtureDir, 'tsconfig.json'), '{}');
  });

  afterAll(() => cleanupFixture(fixtureDir));

  it('succeeds independently with exit code 0 and valid outputs', () => {
    const result = runDetectStack(fixtureDir);

    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(path.join(fixtureDir, '.ai-board', 'config.yml'))).toBe(true);
    expect(fs.existsSync(path.join(fixtureDir, 'analysis.json'))).toBe(true);

    const analysis = readAnalysisJson(fixtureDir);
    expect(analysis.language).toBe('typescript');
    expect(analysis.projectName).toBe('test-app');
  });
});

// ─── Multi-Language Fixtures (US3) ──────────────────────────────────

describe('detect-stack.sh — Python/FastAPI', () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = createFixtureDir('python-fastapi');

    fs.writeFileSync(
      path.join(fixtureDir, 'pyproject.toml'),
      `[project]\nname = "my-api"\n\n[project.dependencies]\nfastapi = ">=0.100"\nuvicorn = ">=0.20"\n\n[tool.pytest]\n`,
    );
    fs.writeFileSync(path.join(fixtureDir, 'poetry.lock'), '');

    const result = runDetectStack(fixtureDir);
    expect(result.exitCode).toBe(0);
  });

  afterAll(() => cleanupFixture(fixtureDir));

  it('detects python/fastapi/poetry', () => {
    const analysis = readAnalysisJson(fixtureDir);
    expect(analysis.language).toBe('python');
    expect(analysis.packageManager).toBe('poetry');
    expect(analysis.framework).toBe('fastapi');
  });
});

describe('detect-stack.sh — Rust/Actix', () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = createFixtureDir('rust-actix');

    fs.writeFileSync(
      path.join(fixtureDir, 'Cargo.toml'),
      `[package]\nname = "my-actix-api"\nversion = "0.1.0"\n\n[dependencies]\nactix-web = "4"\ntokio = "1"\n`,
    );

    const result = runDetectStack(fixtureDir);
    expect(result.exitCode).toBe(0);
  });

  afterAll(() => cleanupFixture(fixtureDir));

  it('detects rust/actix/cargo', () => {
    const analysis = readAnalysisJson(fixtureDir);
    expect(analysis.language).toBe('rust');
    expect(analysis.packageManager).toBe('cargo');
    expect(analysis.framework).toBe('actix');
  });
});

describe('detect-stack.sh — Go/Gin', () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = createFixtureDir('go-gin');

    fs.writeFileSync(
      path.join(fixtureDir, 'go.mod'),
      `module my-go-api\n\ngo 1.22\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n)\n`,
    );
    fs.writeFileSync(path.join(fixtureDir, 'go.sum'), '');

    const result = runDetectStack(fixtureDir);
    expect(result.exitCode).toBe(0);
  });

  afterAll(() => cleanupFixture(fixtureDir));

  it('detects go/gin', () => {
    const analysis = readAnalysisJson(fixtureDir);
    expect(analysis.language).toBe('go');
    expect(analysis.framework).toBe('gin');
    expect(analysis.lockfiles).toContain('go.sum');
  });
});

describe('detect-stack.sh — Java/Spring/Maven', () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = createFixtureDir('java-spring');

    fs.writeFileSync(
      path.join(fixtureDir, 'pom.xml'),
      `<project>\n  <parent>\n    <artifactId>spring-boot-starter-parent</artifactId>\n  </parent>\n  <dependencies>\n    <dependency>\n      <groupId>org.springframework.boot</groupId>\n      <artifactId>spring-boot-starter-web</artifactId>\n    </dependency>\n  </dependencies>\n</project>`,
    );

    const result = runDetectStack(fixtureDir);
    expect(result.exitCode).toBe(0);
  });

  afterAll(() => cleanupFixture(fixtureDir));

  it('detects java/spring-boot/maven', () => {
    const analysis = readAnalysisJson(fixtureDir);
    expect(analysis.language).toBe('java');
    expect(analysis.packageManager).toBe('maven');
    expect(analysis.framework).toBe('spring-boot');
  });
});

describe('detect-stack.sh — Ruby/Rails', () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = createFixtureDir('ruby-rails');

    fs.writeFileSync(
      path.join(fixtureDir, 'Gemfile'),
      `source "https://rubygems.org"\ngem "rails", "~> 7.0"\ngem "rspec-rails"\n`,
    );
    fs.writeFileSync(path.join(fixtureDir, 'Gemfile.lock'), 'GEM\n  specs:\n    rails (7.0.0)\n');

    const result = runDetectStack(fixtureDir);
    expect(result.exitCode).toBe(0);
  });

  afterAll(() => cleanupFixture(fixtureDir));

  it('detects ruby/rails/bundler', () => {
    const analysis = readAnalysisJson(fixtureDir);
    expect(analysis.language).toBe('ruby');
    expect(analysis.packageManager).toBe('bundler');
    expect(analysis.framework).toBe('rails');
  });
});

describe('detect-stack.sh — PHP/Laravel', () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = createFixtureDir('php-laravel');

    fs.writeFileSync(
      path.join(fixtureDir, 'composer.json'),
      JSON.stringify({
        name: 'my-laravel-app',
        require: { 'php': '>=8.1', 'laravel/framework': '^10.0' },
        'require-dev': { 'phpunit/phpunit': '^10.0' },
      }),
    );
    fs.writeFileSync(path.join(fixtureDir, 'composer.lock'), '{}');

    const result = runDetectStack(fixtureDir);
    expect(result.exitCode).toBe(0);
  });

  afterAll(() => cleanupFixture(fixtureDir));

  it('detects php/laravel/composer', () => {
    const analysis = readAnalysisJson(fixtureDir);
    expect(analysis.language).toBe('php');
    expect(analysis.packageManager).toBe('composer');
    expect(analysis.framework).toBe('laravel');
    expect(analysis.testFramework).toBe('phpunit');
  });
});

describe('detect-stack.sh — Multi-language (TS + Python)', () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = createFixtureDir('multi-lang');

    fs.writeFileSync(
      path.join(fixtureDir, 'package.json'),
      JSON.stringify({
        name: 'multi-lang-app',
        devDependencies: { typescript: '5.0.0' },
      }),
    );
    fs.writeFileSync(path.join(fixtureDir, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(fixtureDir, 'pyproject.toml'), `[project]\nname = "ml-backend"\n`);

    const result = runDetectStack(fixtureDir);
    expect(result.exitCode).toBe(0);
  });

  afterAll(() => cleanupFixture(fixtureDir));

  it('detects primary typescript with python as secondary', () => {
    const analysis = readAnalysisJson(fixtureDir);
    expect(analysis.language).toBe('typescript');
    expect(analysis.secondaryLanguages).toContain('python');
  });
});

// ─── Idempotency (US4) ─────────────────────────────────────────────

describe('detect-stack.sh — Idempotency', () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = createFixtureDir('idempotent');

    fs.writeFileSync(
      path.join(fixtureDir, 'package.json'),
      JSON.stringify({ name: 'idem-app', devDependencies: { typescript: '5.0.0' } }),
    );
    fs.writeFileSync(path.join(fixtureDir, 'tsconfig.json'), '{}');

    // Create existing config.yml
    fs.mkdirSync(path.join(fixtureDir, '.ai-board'), { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, '.ai-board', 'config.yml'), 'old-content');

    // Create existing CLAUDE.md
    fs.writeFileSync(path.join(fixtureDir, 'CLAUDE.md'), '# Custom CLAUDE.md content');
  });

  afterAll(() => cleanupFixture(fixtureDir));

  it('overwrites config.yml with fresh detection', () => {
    const result = runDetectStack(fixtureDir);
    expect(result.exitCode).toBe(0);

    const config = readConfigYml(fixtureDir);
    const project = config.project as Record<string, unknown>;
    expect(project.language).toBe('typescript');
    expect(project.name).toBe('idem-app');
  });

  it('does NOT touch CLAUDE.md (Phase 2 responsibility)', () => {
    const claudeContent = fs.readFileSync(path.join(fixtureDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeContent).toBe('# Custom CLAUDE.md content');
  });
});

// ─── Error Conditions (US5) ─────────────────────────────────────────

describe('detect-stack.sh — Error conditions', () => {
  it('exits with code 1 for non-existent repo path', () => {
    const result = runDetectStack('/tmp/nonexistent-repo-path-' + Date.now());
    expect(result.exitCode).toBe(1);
  });

  it('produces no partial output on failure', () => {
    const badPath = '/tmp/nonexistent-repo-path-' + Date.now();
    runDetectStack(badPath);

    expect(fs.existsSync(path.join(badPath, '.ai-board', 'config.yml'))).toBe(false);
    expect(fs.existsSync(path.join(badPath, 'analysis.json'))).toBe(false);
  });
});
