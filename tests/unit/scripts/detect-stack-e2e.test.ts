import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const SCRIPT_PATH = join(__dirname, '../../../.github/scripts/detect-stack.sh');
const TMP_DIR = join(__dirname, '../../../tmp-detect-stack-test-e2e');

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

describe.skipIf(!hasRequiredTools)('detect-stack.sh — E2E framework detection (T005)', () => {
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

  it('Playwright detected → testing.e2e: true, testing.e2e_framework: playwright', () => {
    writeFileSync(
      join(TMP_DIR, 'package.json'),
      JSON.stringify({
        name: 'test-playwright',
        scripts: { test: 'vitest run' },
        devDependencies: {
          vitest: '^1.0.0',
          '@playwright/test': '^1.40.0',
        },
      })
    );
    writeFileSync(join(TMP_DIR, 'bun.lockb'), '');

    runDetect(TMP_DIR);

    const e2eVal = readConfigValue(TMP_DIR, '.testing.e2e');
    const e2eFramework = readConfigValue(TMP_DIR, '.testing.e2e_framework');
    expect(e2eVal).toBe('true');
    expect(e2eFramework).toBe('playwright');
  });

  it('Cypress detected → testing.e2e: true, testing.e2e_framework: cypress', () => {
    writeFileSync(
      join(TMP_DIR, 'package.json'),
      JSON.stringify({
        name: 'test-cypress',
        scripts: { test: 'vitest run' },
        devDependencies: {
          vitest: '^1.0.0',
          cypress: '^13.0.0',
        },
      })
    );
    writeFileSync(join(TMP_DIR, 'bun.lockb'), '');

    runDetect(TMP_DIR);

    const e2eVal = readConfigValue(TMP_DIR, '.testing.e2e');
    const e2eFramework = readConfigValue(TMP_DIR, '.testing.e2e_framework');
    expect(e2eVal).toBe('true');
    expect(e2eFramework).toBe('cypress');
  });

  it('Selenium detected → testing.e2e: true, testing.e2e_framework: selenium', () => {
    writeFileSync(
      join(TMP_DIR, 'package.json'),
      JSON.stringify({
        name: 'test-selenium',
        scripts: { test: 'vitest run' },
        devDependencies: {
          vitest: '^1.0.0',
          'selenium-webdriver': '^4.0.0',
        },
      })
    );
    writeFileSync(join(TMP_DIR, 'bun.lockb'), '');

    runDetect(TMP_DIR);

    const e2eVal = readConfigValue(TMP_DIR, '.testing.e2e');
    const e2eFramework = readConfigValue(TMP_DIR, '.testing.e2e_framework');
    expect(e2eVal).toBe('true');
    expect(e2eFramework).toBe('selenium');
  });

  it('No E2E deps → testing.e2e: false or absent', () => {
    writeFileSync(
      join(TMP_DIR, 'package.json'),
      JSON.stringify({
        name: 'test-no-e2e',
        scripts: { test: 'vitest run' },
        devDependencies: {
          vitest: '^1.0.0',
        },
      })
    );
    writeFileSync(join(TMP_DIR, 'bun.lockb'), '');

    runDetect(TMP_DIR);

    const e2eVal = readConfigValue(TMP_DIR, '.testing.e2e');
    expect(e2eVal).toBe('false');
  });
});
