import type { Project } from '@prisma/client';

interface ServiceEntry {
  type: string;
  version: string;
  database?: string;
}

/**
 * Maps project.config services array to workflow dispatch inputs.
 *
 * With config: maps each service to needs_{type}/_{type}_version pairs.
 * Without config (null): returns defaults (PostgreSQL 16) for backward compatibility.
 * With config but empty services: returns empty object.
 *
 * NOTE: package_manager is NOT a dispatch input — setup-environment.sh reads
 * runtime.manager directly from the cloned repo's config.yml.
 */
export function getProjectServiceInputs(project?: Pick<Project, 'config'>): Record<string, string> {
  if (!project?.config) {
    return {
      needs_postgres: 'true',
      postgres_version: '16',
    };
  }

  const config = project.config as Record<string, unknown>;
  const services = config.services as ServiceEntry[] | undefined;

  if (!services || services.length === 0) {
    return {};
  }

  const inputs: Record<string, string> = {};
  for (const service of services) {
    inputs[`needs_${service.type}`] = 'true';
    inputs[`${service.type}_version`] = service.version;
    if (service.database) {
      inputs[`${service.type}_db`] = service.database;
    }
  }
  return inputs;
}
