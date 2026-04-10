import { describe, it, expect } from 'vitest';
import { getProjectServiceInputs } from '@/lib/workflows/service-inputs';
import type { Project } from '@prisma/client';

function makeProject(config: unknown): Pick<Project, 'config'> {
  return { config } as Pick<Project, 'config'>;
}

describe('getProjectServiceInputs', () => {
  describe('without config (null / undefined)', () => {
    it('returns defaults when project is undefined', () => {
      const result = getProjectServiceInputs();
      expect(result).toEqual({
        needs_postgres: 'true',
        postgres_version: '16',
      });
    });

    it('returns defaults when project.config is null', () => {
      const result = getProjectServiceInputs(makeProject(null));
      expect(result).toEqual({
        needs_postgres: 'true',
        postgres_version: '16',
      });
    });
  });

  describe('with config', () => {
    it('maps a single postgres service', () => {
      const result = getProjectServiceInputs(
        makeProject({
          services: [{ type: 'postgres', version: '14' }],
        })
      );
      expect(result).toEqual({
        needs_postgres: 'true',
        postgres_version: '14',
      });
    });

    it('maps multiple services (postgres + redis)', () => {
      const result = getProjectServiceInputs(
        makeProject({
          services: [
            { type: 'postgres', version: '14' },
            { type: 'redis', version: '7' },
          ],
        })
      );
      expect(result).toEqual({
        needs_postgres: 'true',
        postgres_version: '14',
        needs_redis: 'true',
        redis_version: '7',
      });
    });

    it('maps all supported service types', () => {
      const result = getProjectServiceInputs(
        makeProject({
          services: [
            { type: 'postgres', version: '16' },
            { type: 'redis', version: '7' },
            { type: 'mysql', version: '8' },
            { type: 'mongo', version: '7' },
          ],
        })
      );
      expect(result).toEqual({
        needs_postgres: 'true',
        postgres_version: '16',
        needs_redis: 'true',
        redis_version: '7',
        needs_mysql: 'true',
        mysql_version: '8',
        needs_mongo: 'true',
        mongo_version: '7',
      });
    });

    it('includes database name when specified', () => {
      const result = getProjectServiceInputs(
        makeProject({
          services: [
            { type: 'postgres', version: '14', database: 'myapp_test' },
          ],
        })
      );
      expect(result).toEqual({
        needs_postgres: 'true',
        postgres_version: '14',
        postgres_db: 'myapp_test',
      });
    });

    it('omits database key when not specified', () => {
      const result = getProjectServiceInputs(
        makeProject({
          services: [{ type: 'postgres', version: '14' }],
        })
      );
      expect(result).not.toHaveProperty('postgres_db');
    });

    it('maps database names for multiple services', () => {
      const result = getProjectServiceInputs(
        makeProject({
          services: [
            { type: 'postgres', version: '16', database: 'app_test' },
            { type: 'mysql', version: '8', database: 'app_mysql' },
            { type: 'redis', version: '7' },
          ],
        })
      );
      expect(result).toEqual({
        needs_postgres: 'true',
        postgres_version: '16',
        postgres_db: 'app_test',
        needs_mysql: 'true',
        mysql_version: '8',
        mysql_db: 'app_mysql',
        needs_redis: 'true',
        redis_version: '7',
      });
    });

    it('returns empty object when services array is empty', () => {
      const result = getProjectServiceInputs(
        makeProject({ services: [] })
      );
      expect(result).toEqual({});
    });

    it('returns empty object when services is undefined in config', () => {
      const result = getProjectServiceInputs(
        makeProject({ version: 1, project: { name: 'test' } })
      );
      expect(result).toEqual({});
    });
  });

  describe('does NOT include package_manager', () => {
    it('omits package_manager from dispatch inputs', () => {
      const result = getProjectServiceInputs(
        makeProject({
          runtime: { manager: 'npm' },
          services: [{ type: 'postgres', version: '14' }],
        })
      );
      expect(result).not.toHaveProperty('package_manager');
    });
  });
});
