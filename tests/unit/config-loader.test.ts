import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '@/lib/config-loader';

let tempDir: string;

const VALID_YAML = `version: 1

project:
  name: my-app
  language: typescript

runtime:
  manager: bun

commands:
  install: bun install
`;

const TEST_CAPABILITIES_YAML = `version: 1

project:
  name: my-app
  language: typescript

runtime:
  manager: bun

commands:
  install: bun install
  test_unit: bun run test:unit

testCapabilities:
  framework: vitest
  primaryCommandKey: test_unit
  hasE2E: false
`;

const NULLABLE_TEST_CAPABILITIES_YAML = `version: 1

project:
  name: my-app
  language: typescript

runtime:
  manager: bun

commands:
  install: bun install

testCapabilities:
  framework: null
  primaryCommandKey: null
  hasE2E: null
`;

const INVALID_YAML = `version: 1
project:
  name: my-app
  language: typescript
  bad_indent
    runtime:
`;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'config-loader-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function writeConfig(content: string) {
  const configDir = join(tempDir, '.ai-board');
  await mkdir(configDir, { recursive: true });
  await writeFile(join(configDir, 'config.yml'), content, 'utf-8');
}

describe('loadConfig', () => {
  it('missing .ai-board/config.yml returns error with specific message', async () => {
    const result = await loadConfig(tempDir);

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Missing .ai-board/config.yml');
  });

  it('invalid YAML syntax returns parse error with guidance', async () => {
    await writeConfig(INVALID_YAML);

    const result = await loadConfig(tempDir);

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe('invalid_value');
    expect(result.errors[0].message).toContain('YAML');
  });

  it('valid file delegates to validateConfig and returns correct result', async () => {
    await writeConfig(VALID_YAML);

    const result = await loadConfig(tempDir);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.version).toBe(1);
    expect(result.data.project.name).toBe('my-app');
    expect(result.data.project.language).toBe('typescript');
    expect(result.data.runtime.manager).toBe('bun');
    expect(result.data.commands.install).toBe('bun install');
  });

  it('loads testCapabilities and nullable test command fields from config', async () => {
    await writeConfig(TEST_CAPABILITIES_YAML);

    const result = await loadConfig(tempDir);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.commands.test_unit).toBe('bun run test:unit');
    expect(result.data.commands.test_integration).toBeUndefined();
    expect(result.data.commands.test_e2e).toBeUndefined();
    expect(result.data.testCapabilities).toEqual({
      framework: 'vitest',
      primaryCommandKey: 'test_unit',
      hasE2E: false,
    });
  });

  it('accepts nullable testCapabilities values when no test command is configured', async () => {
    await writeConfig(NULLABLE_TEST_CAPABILITIES_YAML);

    const result = await loadConfig(tempDir);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.testCapabilities).toEqual({
      framework: null,
      primaryCommandKey: null,
      hasE2E: null,
    });
  });

  it('empty file returns all required-field errors', async () => {
    await writeConfig('');

    const result = await loadConfig(tempDir);

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
