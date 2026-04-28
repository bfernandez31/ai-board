import { describe, it, expect } from 'vitest';
import { extractStackContext } from '@/lib/analysis/stack-extract';

describe('extractStackContext', () => {
  it('extracts a TS/Next/postgres stack', () => {
    const config = {
      version: 1 as const,
      project: { name: 'demo', language: 'typescript' as const, framework: 'nextjs' as const },
      runtime: { manager: 'bun' as const },
      services: [{ type: 'postgres' as const, version: '14' }],
      testing: { framework: 'vitest', e2e: true, e2e_framework: 'playwright' },
      commands: { install: 'bun install' },
      env: {},
      agent: { cli: 'claude-code' as const, model: 'claude-opus-4-7' },
    };
    const ctx = extractStackContext(config);
    expect(ctx.language).toBe('typescript');
    expect(ctx.framework).toBe('nextjs');
    expect(ctx.services).toEqual([{ type: 'postgres', version: '14' }]);
    expect(ctx.testingFramework).toBe('vitest');
    expect(ctx.e2e).toBe(true);
    expect(ctx.e2eFramework).toBe('playwright');
    expect(ctx.agent).toEqual({ cli: 'claude-code', model: 'claude-opus-4-7' });
  });

  it('extracts a Python/FastAPI stack with no e2e', () => {
    const config = {
      version: 1 as const,
      project: { name: 'demo', language: 'python' as const, framework: 'fastapi' as const },
      runtime: { manager: 'pip' as const },
      services: [{ type: 'postgres' as const, version: '14' }],
      testing: { framework: 'pytest', e2e: false },
      commands: { install: 'pip install -r requirements.txt' },
      env: {},
      agent: { cli: 'claude-code' as const },
    };
    const ctx = extractStackContext(config);
    expect(ctx.language).toBe('python');
    expect(ctx.framework).toBe('fastapi');
    expect(ctx.testingFramework).toBe('pytest');
    expect(ctx.e2e).toBe(false);
    expect(ctx.e2eFramework).toBeNull();
    expect(ctx.agent.model).toBeNull();
  });

  it('returns null/empty for absent fields', () => {
    const ctx = extractStackContext(null);
    expect(ctx.language).toBeNull();
    expect(ctx.framework).toBeNull();
    expect(ctx.services).toEqual([]);
    expect(ctx.testingFramework).toBeNull();
    expect(ctx.e2e).toBe(false);
    expect(ctx.e2eFramework).toBeNull();
  });

  it('does not leak commands strings', () => {
    const config = {
      version: 1 as const,
      project: { name: 'demo', language: 'typescript' as const, framework: 'nextjs' as const },
      runtime: { manager: 'bun' as const },
      services: [],
      commands: { install: 'bun install', dev_server: 'bun run dev', test: 'bun run test' },
      env: { SECRET_KEY: 'super-secret' },
      agent: { cli: 'claude-code' as const },
    };
    const ctx = extractStackContext(config);
    const json = JSON.stringify(ctx);
    expect(json).not.toContain('bun install');
    expect(json).not.toContain('SECRET_KEY');
    expect(json).not.toContain('super-secret');
  });

  it('truncates services array to 10 deterministically', () => {
    const services = Array.from({ length: 15 }, (_, i) => ({
      type: 'postgres' as const,
      version: `v${i}`,
    }));
    const ctx = extractStackContext({ services } as Parameters<typeof extractStackContext>[0]);
    expect(ctx.services).toHaveLength(10);
    expect(ctx.services[0].version).toBe('v0');
    expect(ctx.services[9].version).toBe('v9');
  });

  it('handles services with no entries gracefully', () => {
    const ctx = extractStackContext({ services: [] } as Parameters<typeof extractStackContext>[0]);
    expect(ctx.services).toEqual([]);
  });
});
