import { describe, it, expect } from 'vitest';
import { validateConfig } from '@/lib/validations/config';

// ─── Helpers ────────────────────────────────────────────────────────

function validConfig(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    project: { name: 'my-app', language: 'typescript' },
    runtime: { manager: 'bun' },
    commands: { install: 'bun install' },
    ...overrides,
  };
}

function fullConfig() {
  return {
    version: 1,
    project: { name: 'my-app', language: 'typescript', framework: 'nextjs' },
    runtime: { manager: 'bun', manager_version: '1.3.0', node: '22', python: '3.12' },
    services: [
      { type: 'postgres', version: '14', database: 'myapp_test', username: 'postgres', password: 'postgres' },
      { type: 'redis', version: '7' },
    ],
    commands: {
      install: 'bun install',
      build: 'bun run build',
      lint: 'bun run lint',
      type_check: 'bun run type-check',
      test_unit: 'bun run test:unit',
      test_integration: 'bun run test:integration',
      test_e2e: 'bun run test:e2e',
    },
    env: { NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost:5432/myapp_test' },
    agent: { cli: 'claude-code', model: 'claude-sonnet-4-6' },
  };
}

// ─── US1: Valid Config Parsing ──────────────────────────────────────

describe('validateConfig — valid configs (US1)', () => {
  it('valid config with all fields returns success with correct types', () => {
    const result = validateConfig(fullConfig());

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.version).toBe(1);
    expect(result.data.project.name).toBe('my-app');
    expect(result.data.project.language).toBe('typescript');
    expect(result.data.project.framework).toBe('nextjs');
    expect(result.data.runtime.manager).toBe('bun');
    expect(result.data.runtime.node).toBe('22');
    expect(result.data.commands.install).toBe('bun install');
    expect(result.data.commands.build).toBe('bun run build');
    expect(result.data.services).toHaveLength(2);
    expect(result.data.services[0].type).toBe('postgres');
    expect(result.data.env.NODE_ENV).toBe('test');
    expect(result.data.agent.cli).toBe('claude-code');
    expect(result.data.agent.model).toBe('claude-sonnet-4-6');
  });

  it('valid config with only required fields returns defaults', () => {
    const result = validateConfig(validConfig());

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.project.framework).toBe('none');
    expect(result.data.services).toEqual([]);
    expect(result.data.env).toEqual({});
    expect(result.data.agent.cli).toBe('claude-code');
    expect(result.data.agent.model).toBeUndefined();
    expect(result.data.commands.build).toBeUndefined();
    expect(result.data.commands.lint).toBeUndefined();
  });

  it('valid config with all sections fully populated has every field with correct types', () => {
    const config = fullConfig();
    const result = validateConfig(config);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(typeof result.data.version).toBe('number');
    expect(typeof result.data.project.name).toBe('string');
    expect(typeof result.data.project.language).toBe('string');
    expect(typeof result.data.project.framework).toBe('string');
    expect(typeof result.data.runtime.manager).toBe('string');
    expect(typeof result.data.runtime.manager_version).toBe('string');
    expect(typeof result.data.runtime.node).toBe('string');
    expect(typeof result.data.runtime.python).toBe('string');
    expect(Array.isArray(result.data.services)).toBe(true);
    expect(typeof result.data.commands.install).toBe('string');
    expect(typeof result.data.commands.build).toBe('string');
    expect(typeof result.data.commands.lint).toBe('string');
    expect(typeof result.data.commands.type_check).toBe('string');
    expect(typeof result.data.commands.test_unit).toBe('string');
    expect(typeof result.data.commands.test_integration).toBe('string');
    expect(typeof result.data.commands.test_e2e).toBe('string');
    expect(typeof result.data.env).toBe('object');
    expect(typeof result.data.agent.cli).toBe('string');
    expect(typeof result.data.agent.model).toBe('string');
  });
});

// ─── US2: Invalid Config Errors ─────────────────────────────────────

describe('validateConfig — invalid configs (US2)', () => {
  it('missing required fields produce errors with correct paths and missing_required type', () => {
    const result = validateConfig({});

    expect(result.success).toBe(false);
    if (result.success) return;

    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain('version');
    expect(paths).toContain('project');
    expect(paths).toContain('runtime');
    expect(paths).toContain('commands');

    for (const error of result.errors) {
      expect(error.type).toBe('missing_required');
    }
  });

  it('invalid enum values produce invalid_value error listing allowed values', () => {
    const result = validateConfig(
      validConfig({
        project: { name: 'my-app', language: 'ruby' },
      }),
    );

    expect(result.success).toBe(false);
    if (result.success) return;

    const langError = result.errors.find((e) => e.path === 'project.language');
    expect(langError).toBeDefined();
    expect(langError!.type).toBe('invalid_value');
    expect(langError!.value).toBe('ruby');
    expect(langError!.message).toContain('typescript');
    expect(langError!.message).toContain('python');
  });

  it('wrong types produce invalid_type error', () => {
    const result = validateConfig(
      validConfig({
        runtime: { manager: 'bun', node: 22 },
      }),
    );

    expect(result.success).toBe(false);
    if (result.success) return;

    const nodeError = result.errors.find((e) => e.path === 'runtime.node');
    expect(nodeError).toBeDefined();
    expect(nodeError!.type).toBe('invalid_type');
    expect(nodeError!.message).toContain('string');
  });

  it('config with multiple errors returns all errors together', () => {
    const result = validateConfig({
      version: 2,
      project: { name: '', language: 'ruby' },
      runtime: { manager: 'maven' },
      commands: { install: '' },
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it('empty object returns all required-field errors', () => {
    const result = validateConfig({});

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    const types = result.errors.map((e) => e.type);
    expect(types.every((t) => t === 'missing_required')).toBe(true);
  });
});

// ─── US4: Optional Commands Gracefully Skipped ──────────────────────

describe('validateConfig — optional commands (US4)', () => {
  it('config with only commands.install validates, all other commands are undefined', () => {
    const result = validateConfig(validConfig());

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.commands.install).toBe('bun install');
    expect(result.data.commands.build).toBeUndefined();
    expect(result.data.commands.lint).toBeUndefined();
    expect(result.data.commands.type_check).toBeUndefined();
    expect(result.data.commands.test_unit).toBeUndefined();
    expect(result.data.commands.test_integration).toBeUndefined();
    expect(result.data.commands.test_e2e).toBeUndefined();
  });

  it('config with commands.lint omitted returns undefined for lint', () => {
    const result = validateConfig(
      validConfig({
        commands: { install: 'bun install', build: 'bun run build' },
      }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.commands.lint).toBeUndefined();
    expect(result.data.commands.build).toBe('bun run build');
  });
});

// ─── US5: Schema Version Validation ─────────────────────────────────

describe('validateConfig — version validation (US5)', () => {
  it('version: 1 passes validation', () => {
    const result = validateConfig(validConfig());
    expect(result.success).toBe(true);
  });

  it('version: 2 fails with unsupported version error listing supported versions', () => {
    const result = validateConfig(validConfig({ version: 2 }));

    expect(result.success).toBe(false);
    if (result.success) return;

    const versionError = result.errors.find((e) => e.path === 'version');
    expect(versionError).toBeDefined();
    expect(versionError!.message).toContain('Unsupported config version');
    expect(versionError!.message).toContain('1');
    expect(versionError!.value).toBe(2);
  });

  it('version: "one" (string) fails with type error', () => {
    const result = validateConfig(validConfig({ version: 'one' }));

    expect(result.success).toBe(false);
    if (result.success) return;

    const versionError = result.errors.find((e) => e.path === 'version');
    expect(versionError).toBeDefined();
  });
});

// ─── Unknown Fields (FR-014) ────────────────────────────────────────

describe('validateConfig — unknown fields produce warnings', () => {
  it('unknown top-level key produces a warning, not an error', () => {
    const result = validateConfig({ ...validConfig(), custom_field: 'hello' });

    expect(result.success).toBe(true);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings.some((w) => w.path === 'custom_field')).toBe(true);
  });

  it('unknown key within a known section produces a warning', () => {
    const result = validateConfig(
      validConfig({
        project: { name: 'my-app', language: 'typescript', color: 'blue' },
      }),
    );

    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.path === 'project.color')).toBe(true);
  });
});
