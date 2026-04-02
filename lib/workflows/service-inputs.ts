import type { Project } from '@prisma/client';

/**
 * Returns service inputs for workflow dispatch (needs_postgres, postgres_version, etc.).
 *
 * TODO(AIB-470): Read from project.config (stored in DB) once config sync is implemented.
 * See specs/specifications/platform-opening-design.md §3-4.
 * For now, returns hardcoded defaults for ai-board (the only project).
 */
export function getProjectServiceInputs(_project?: Project): Record<string, string> {
  return {
    needs_postgres: 'true',
    postgres_version: '14',
  };
}
