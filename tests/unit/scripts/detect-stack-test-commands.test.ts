import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const SCRIPT_PATH = join(__dirname, '../../../.github/scripts/detect-stack.sh');
const TMP_DIR = join(__dirname, '../../../tmp-detect-stack-test-cmds');

function runDetect(dir: string): string {
  return execSync(`bash "${SCRIPT_PATH}" "${dir}"`, {
    encoding: 'utf-8',
    timeout: 15000,
    env: process.env,
  });
}

function readConfigValue(dir: string, yqPath: string): string {
  return execSync(`yq -r '${yqPath}' "${dir}/.ai-board/config.yml"`, {
    encoding: 'utf-8',
    timeout: 5000,
  }).trim();
}

const hasRequiredTools = (() => {
  try {
    execSync('which jq', { encoding: 'utf-8' });
    execSync('which yq', { encoding: 'utf-8' });
    return true;
  } catch { return false; }
})();

describe.skipIf(!hasRequiredTools)('detect-stack.sh — test commands (T004)', () => {
  beforeEach(() => {
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
  });

  it('JS/TS with bun (bun.lockb) → bun run test', () => {
    writeFileSync(
      join(TMP_DIR, 'package.json'),
      JSON.stringify({
        name: 'test-bun-lockb',
        scripts: { test: 'vitest run' },
        devDependencies: { vitest: '^1.0.0' },
      })
    );
    writeFileSync(join(TMP_DIR, 'bun.lockb'), '');

    runDetect(TMP_DIR);

    const testCmd = readConfigValue(TMP_DIR, '.commands.test');
    expect(testCmd).toBe('bun run test');
  });

  it('JS/TS with bun (bun.lock) → bun run test', () => {
    writeFileSync(
      join(TMP_DIR, 'package.json'),
      JSON.stringify({
        name: 'test-bun-lock',
        scripts: { test: 'vitest run' },
        devDependencies: { vitest: '^1.0.0' },
      })
    );
    writeFileSync(join(TMP_DIR, 'bun.lock'), '');

    runDetect(TMP_DIR);

    const testCmd = readConfigValue(TMP_DIR, '.commands.test');
    expect(testCmd).toBe('bun run test');
  });

  it('JS/TS with npm → npm test', () => {
    writeFileSync(
      join(TMP_DIR, 'package.json'),
      JSON.stringify({
        name: 'test-npm',
        scripts: { test: 'jest' },
        devDependencies: { jest: '^29.0.0' },
      })
    );
    writeFileSync(join(TMP_DIR, 'package-lock.json'), '{}');

    runDetect(TMP_DIR);

    const testCmd = readConfigValue(TMP_DIR, '.commands.test');
    expect(testCmd).toBe('npm test');
  });

  it('JS/TS with yarn → yarn test', () => {
    writeFileSync(
      join(TMP_DIR, 'package.json'),
      JSON.stringify({
        name: 'test-yarn',
        scripts: { test: 'jest' },
        devDependencies: { jest: '^29.0.0' },
      })
    );
    writeFileSync(join(TMP_DIR, 'yarn.lock'), '');

    runDetect(TMP_DIR);

    const testCmd = readConfigValue(TMP_DIR, '.commands.test');
    expect(testCmd).toBe('yarn test');
  });

  it('JS/TS with pnpm → pnpm test', () => {
    writeFileSync(
      join(TMP_DIR, 'package.json'),
      JSON.stringify({
        name: 'test-pnpm',
        scripts: { test: 'vitest run' },
        devDependencies: { vitest: '^1.0.0' },
      })
    );
    writeFileSync(join(TMP_DIR, 'pnpm-lock.yaml'), '');

    runDetect(TMP_DIR);

    const testCmd = readConfigValue(TMP_DIR, '.commands.test');
    expect(testCmd).toBe('pnpm test');
  });

  it('Python with pytest → pytest', () => {
    writeFileSync(
      join(TMP_DIR, 'pyproject.toml'),
      `[project]\nname = "test-python"\n\n[tool.pytest.ini_options]\ntestpaths = ["tests"]\n`
    );

    runDetect(TMP_DIR);

    const testCmd = readConfigValue(TMP_DIR, '.commands.test');
    expect(testCmd).toBe('pytest');
  });

  it('Rust → cargo test', () => {
    writeFileSync(
      join(TMP_DIR, 'Cargo.toml'),
      `[package]\nname = "test-rust"\nversion = "0.1.0"\nedition = "2021"\n`
    );

    runDetect(TMP_DIR);

    const testCmd = readConfigValue(TMP_DIR, '.commands.test');
    expect(testCmd).toBe('cargo test');
  });

  it('Go → go test ./...', () => {
    writeFileSync(
      join(TMP_DIR, 'go.mod'),
      `module test-go\n\ngo 1.21\n`
    );

    runDetect(TMP_DIR);

    const testCmd = readConfigValue(TMP_DIR, '.commands.test');
    expect(testCmd).toBe('go test ./...');
  });

  it('Ruby with rspec → bundle exec rspec', () => {
    writeFileSync(
      join(TMP_DIR, 'Gemfile'),
      `source "https://rubygems.org"\ngem 'rspec'\n`
    );

    runDetect(TMP_DIR);

    const testCmd = readConfigValue(TMP_DIR, '.commands.test');
    expect(testCmd).toBe('bundle exec rspec');
  });

  it('PHP with phpunit → ./vendor/bin/phpunit', () => {
    writeFileSync(
      join(TMP_DIR, 'composer.json'),
      JSON.stringify({
        name: 'test/test-php',
        'require-dev': { 'phpunit/phpunit': '^10.0' },
      })
    );

    runDetect(TMP_DIR);

    const testCmd = readConfigValue(TMP_DIR, '.commands.test');
    expect(testCmd).toBe('./vendor/bin/phpunit');
  });
});
