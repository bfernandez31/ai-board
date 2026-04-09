/**
 * Config sync module — fetches .ai-board/config.yml from GitHub,
 * validates it, strips the env section, and stores it in the database.
 *
 * Follows the same Octokit pattern as lib/github/constitution-fetcher.ts.
 */
import { Octokit } from '@octokit/rest';
import { parse as parseYaml } from 'yaml';
import { prisma } from '@/lib/db/client';
import { validateConfig, stripServiceCredentials } from '@/lib/validations/config';
import type { ValidationWarning } from '@/lib/validations/config';
import type { Project, Prisma } from '@prisma/client';

const CONFIG_FILE_PATH = '.ai-board/config.yml';
const STALENESS_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

export interface ConfigSyncResult {
  success: true;
  config: Record<string, unknown>;
  syncedAt: Date;
  warnings: ValidationWarning[];
}

export interface ConfigSyncError {
  success: false;
  code: 'VALIDATION_ERROR' | 'CONFIG_NOT_FOUND' | 'GITHUB_ERROR' | 'YAML_PARSE_ERROR';
  error: string;
  details?: unknown;
}

export type ConfigSyncOutcome = ConfigSyncResult | ConfigSyncError;

/**
 * Check whether a project's config is stale (null or older than 1 hour).
 */
export function isConfigStale(project: Pick<Project, 'configSyncedAt'>): boolean {
  if (!project.configSyncedAt) return true;
  return Date.now() - project.configSyncedAt.getTime() > STALENESS_THRESHOLD_MS;
}

/**
 * Fetch .ai-board/config.yml from GitHub, validate, strip env, store in DB.
 * Uses optimistic locking via updateMany with configSyncedAt condition.
 */
export async function syncProjectConfig(
  project: Pick<Project, 'id' | 'githubOwner' | 'githubRepo' | 'configSyncedAt'>,
  accessToken?: string
): Promise<ConfigSyncOutcome> {
  // In test mode, return mock data
  if (process.env.TEST_MODE === 'true') {
    const now = new Date();
    const mockConfig = {
      version: 1,
      project: { name: 'test-project', language: 'typescript', framework: 'nextjs' },
      runtime: { manager: 'bun' },
      services: [{ type: 'postgres', version: '16' }],
      commands: { install: 'bun install' },
      agent: { cli: 'claude-code' },
    };
    await prisma.project.update({
      where: { id: project.id },
      data: { config: mockConfig, configSyncedAt: now },
    });
    return { success: true, config: mockConfig, syncedAt: now, warnings: [] };
  }

  const token = accessToken ?? process.env.GITHUB_TOKEN;
  if (!token) {
    return { success: false, code: 'GITHUB_ERROR', error: 'GITHUB_TOKEN not configured' };
  }

  const octokit = new Octokit({ auth: token });

  // 1. Fetch config from GitHub (use repo's default branch, not hardcoded 'main')
  let rawContent: string;
  try {
    const repoInfo = await octokit.repos.get({
      owner: project.githubOwner,
      repo: project.githubRepo,
    });
    const defaultBranch = repoInfo.data.default_branch;

    const response = await octokit.repos.getContent({
      owner: project.githubOwner,
      repo: project.githubRepo,
      path: CONFIG_FILE_PATH,
      ref: defaultBranch,
    });

    if (!('content' in response.data) || !response.data.content) {
      return {
        success: false,
        code: 'CONFIG_NOT_FOUND',
        error: `No ${CONFIG_FILE_PATH} found in repository`,
      };
    }

    rawContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Not Found')) {
      return {
        success: false,
        code: 'CONFIG_NOT_FOUND',
        error: `No ${CONFIG_FILE_PATH} found in repository`,
      };
    }
    return {
      success: false,
      code: 'GITHUB_ERROR',
      error: `Failed to fetch config from GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }

  // 2. Parse YAML
  let parsed: unknown;
  try {
    parsed = parseYaml(rawContent);
  } catch (err) {
    return {
      success: false,
      code: 'YAML_PARSE_ERROR',
      error: `YAML syntax error: ${err instanceof Error ? err.message : 'invalid YAML'}`,
    };
  }

  parsed ??= {};

  // 3. Validate via Zod schema
  const validation = validateConfig(parsed);
  if (!validation.success) {
    return {
      success: false,
      code: 'VALIDATION_ERROR',
      error: 'Config validation failed',
      details: validation.errors,
    };
  }

  // 4. Strip env section and service credentials before storing
  const strippedConfig = stripServiceCredentials(validation.data);
  const { env: _env, ...configWithoutEnv } = strippedConfig;

  // 5. Store in DB with optimistic locking
  const now = new Date();
  const updateResult = await prisma.project.updateMany({
    where: {
      id: project.id,
      OR: [
        { configSyncedAt: project.configSyncedAt },
        { configSyncedAt: null },
      ],
    },
    data: {
      config: configWithoutEnv as unknown as Prisma.InputJsonValue,
      configSyncedAt: now,
    },
  });

  // If optimistic lock failed, another sync just completed — re-read
  if (updateResult.count === 0) {
    const updated = await prisma.project.findUnique({
      where: { id: project.id },
      select: { config: true, configSyncedAt: true },
    });
    if (updated?.config) {
      return {
        success: true,
        config: updated.config as Record<string, unknown>,
        syncedAt: updated.configSyncedAt!,
        warnings: validation.warnings,
      };
    }
  }

  return {
    success: true,
    config: configWithoutEnv as unknown as Record<string, unknown>,
    syncedAt: now,
    warnings: validation.warnings,
  };
}

/**
 * Ensure config is fresh before dispatch. If stale, sync inline.
 * Returns the project with fresh config, or throws on sync failure.
 */
export async function ensureFreshConfig(
  project: Pick<Project, 'id' | 'githubOwner' | 'githubRepo' | 'configSyncedAt'>
): Promise<void> {
  if (!isConfigStale(project)) return;

  const result = await syncProjectConfig(project);
  if (!result.success) {
    throw new Error(
      `Config sync failed before dispatch: ${result.error} (${result.code})`
    );
  }
}
