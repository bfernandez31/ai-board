import type { StackContext } from './types';
import type { ProjectConfig } from '@/lib/validations/config';

const STACK_SERVICE_TYPES = new Set(['postgres', 'redis', 'mysql', 'mongo']);

export function extractStackContext(
  config: Partial<ProjectConfig> | null | undefined
): StackContext {
  const project = config?.project ?? null;
  const services = Array.isArray(config?.services) ? config!.services : [];
  const testing = config?.testing ?? null;
  const agent = config?.agent ?? null;

  const safeServices = services
    .filter(
      (s): s is { type: 'postgres' | 'redis' | 'mysql' | 'mongo'; version: string } =>
        !!s && typeof s === 'object' && STACK_SERVICE_TYPES.has(s.type as string) && typeof s.version === 'string'
    )
    .map((s) => ({ type: s.type, version: s.version }))
    .slice(0, 10);

  return {
    language: project?.language ?? null,
    framework: project?.framework ?? null,
    services: safeServices,
    testingFramework: testing?.framework ?? null,
    e2e: testing?.e2e === true,
    e2eFramework: testing?.e2e_framework ?? null,
    agent: {
      cli: agent?.cli ?? 'claude-code',
      model: agent?.model ?? null,
    },
  };
}
