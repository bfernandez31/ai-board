import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const SCRIPT_PATH = join(__dirname, '../../../.github/scripts/detect-stack.sh');
const TMP_DIR = join(__dirname, '../../../tmp-detect-stack-test-lint');

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

describe.skipIf(!hasRequiredTools)('detect-stack.sh — lint & type-check detection (T006)', () => {
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

  it('JS/TS with lint and type-check scripts → commands.lint and commands.type_check present', () => {
    writeFileSync(
      join(TMP_DIR, 'package.json'),
      JSON.stringify({
        name: 'test-lint-typecheck',
        scripts: {
          test: 'vitest run',
          lint: 'eslint .',
          'type-check': 'tsc --noEmit',
        },
        devDependencies: { vitest: '^1.0.0', typescript: '^5.0.0' },
      })
    );
    writeFileSync(join(TMP_DIR, 'tsconfig.json'), '{}');
    writeFileSync(join(TMP_DIR, 'bun.lockb'), '');

    runDetect(TMP_DIR);

    const lintCmd = readConfigValue(TMP_DIR, '.commands.lint');
    const typeCheckCmd = readConfigValue(TMP_DIR, '.commands.type_check');
    expect(lintCmd).toBe('bun run lint');
    expect(typeCheckCmd).toBe('bun run type-check');
  });

  it('JS/TS with typecheck (no dash) → commands.type_check present', () => {
    writeFileSync(
      join(TMP_DIR, 'package.json'),
      JSON.stringify({
        name: 'test-typecheck-nodash',
        scripts: {
          test: 'vitest run',
          typecheck: 'tsc --noEmit',
        },
        devDependencies: { vitest: '^1.0.0', typescript: '^5.0.0' },
      })
    );
    writeFileSync(join(TMP_DIR, 'tsconfig.json'), '{}');
    writeFileSync(join(TMP_DIR, 'bun.lockb'), '');

    runDetect(TMP_DIR);

    const typeCheckCmd = readConfigValue(TMP_DIR, '.commands.type_check');
    expect(typeCheckCmd).toBe('bun run typecheck');
  });

  it('Python with ruff → commands.lint contains ruff', () => {
    writeFileSync(
      join(TMP_DIR, 'requirements.txt'),
      'ruff>=0.1.0\npytest>=7.0.0\n'
    );

    runDetect(TMP_DIR);

    const lintCmd = readConfigValue(TMP_DIR, '.commands.lint');
    expect(lintCmd).toContain('ruff');
  });

  it('Python with mypy → commands.type_check contains mypy', () => {
    writeFileSync(
      join(TMP_DIR, 'requirements.txt'),
      'mypy>=1.0.0\npytest>=7.0.0\n'
    );

    runDetect(TMP_DIR);

    const typeCheckCmd = readConfigValue(TMP_DIR, '.commands.type_check');
    expect(typeCheckCmd).toContain('mypy');
  });

  it('Rust → commands.lint contains cargo clippy, commands.type_check contains cargo check', () => {
    writeFileSync(
      join(TMP_DIR, 'Cargo.toml'),
      `[package]\nname = "test-rust"\nversion = "0.1.0"\nedition = "2021"\n`
    );

    runDetect(TMP_DIR);

    const lintCmd = readConfigValue(TMP_DIR, '.commands.lint');
    const typeCheckCmd = readConfigValue(TMP_DIR, '.commands.type_check');
    expect(lintCmd).toContain('cargo clippy');
    expect(typeCheckCmd).toContain('cargo check');
  });

  it('Go → commands.lint contains go vet', () => {
    writeFileSync(
      join(TMP_DIR, 'go.mod'),
      `module test-go\n\ngo 1.21\n`
    );

    runDetect(TMP_DIR);

    const lintCmd = readConfigValue(TMP_DIR, '.commands.lint');
    expect(lintCmd).toContain('go vet');
  });
});
