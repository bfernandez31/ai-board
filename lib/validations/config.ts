/**
 * Zod schema definitions for .ai-board/config.yml validation.
 *
 * Defines the versioned YAML schema used by external projects to declare
 * their environment, tooling, and workflow configuration.
 */
import { z } from 'zod';

// ─── Enum Schemas ───────────────────────────────────────────────────

export const ProjectLanguageSchema = z.enum([
  'typescript',
  'javascript',
  'python',
  'go',
  'rust',
  'java',
  'kotlin',
  'ruby',
  'php',
]);

export const ProjectFrameworkSchema = z.enum([
  'nextjs',
  'express',
  'fastapi',
  'django',
  'flask',
  'gin',
  'spring-boot',
  'quarkus',
  'micronaut',
  'rails',
  'laravel',
  'actix',
  'rocket',
  'none',
]);

export const PackageManagerSchema = z.enum([
  'bun',
  'npm',
  'yarn',
  'pnpm',
  'pip',
  'poetry',
  'cargo',
  'maven',
  'gradle',
  'bundler',
  'composer',
]);

export const ServiceTypeSchema = z.enum([
  'postgres',
  'redis',
  'mysql',
  'mongo',
]);

export const AgentCliSchema = z.enum(['claude-code', 'codex']);

export const ValidationErrorTypeSchema = z.enum([
  'missing_required',
  'invalid_value',
  'invalid_type',
  'unknown_field',
]);

// ─── Section Schemas ────────────────────────────────────────────────

export const ProjectSectionSchema = z.object({
  name: z.string().min(1, 'project.name must be a non-empty string'),
  language: ProjectLanguageSchema.nullable(),
  framework: ProjectFrameworkSchema.default('none'),
}).strict();

export const RuntimeSectionSchema = z.object({
  manager: PackageManagerSchema,
  manager_version: z.string().optional(),
  node: z.string().optional(),
  python: z.string().optional(),
  java: z.string().optional(),
  go: z.string().optional(),
  rust: z.string().optional(),
}).strict();

export const CommandsSectionSchema = z.object({
  install: z.string().min(1, 'commands.install must be a non-empty string'),
  build: z.string().optional(),
  lint: z.string().optional(),
  type_check: z.string().optional(),
  test_unit: z.string().optional(),
  test_integration: z.string().optional(),
  test_e2e: z.string().optional(),
  db_setup: z.string().optional(),
  db_seed: z.string().optional(),
}).strict();

export const ServiceConfigSchema = z.object({
  type: ServiceTypeSchema,
  version: z.string().min(1, 'service version must be a non-empty string'),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
}).strict();

export const AgentSectionSchema = z.object({
  cli: AgentCliSchema.default('claude-code'),
  model: z.string().optional(),
}).strict();

// ─── Root Config Schema ─────────────────────────────────────────────

export const ProjectConfigSchema = z
  .object({
    version: z.literal(1),
    project: ProjectSectionSchema,
    runtime: RuntimeSectionSchema,
    services: z.array(ServiceConfigSchema).default([]),
    commands: CommandsSectionSchema,
    env: z.record(z.string(), z.string()).default({}),
    agent: AgentSectionSchema.default({ cli: 'claude-code' }),
  })
  .strict();

// ─── Inferred Types ─────────────────────────────────────────────────

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type ProjectSection = z.infer<typeof ProjectSectionSchema>;
export type RuntimeSection = z.infer<typeof RuntimeSectionSchema>;
export type CommandsSection = z.infer<typeof CommandsSectionSchema>;
export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;
export type AgentSection = z.infer<typeof AgentSectionSchema>;

// ─── Validation Types ───────────────────────────────────────────────

export type ValidationErrorType = z.infer<typeof ValidationErrorTypeSchema>;

export interface ValidationError {
  path: string;
  type: ValidationErrorType;
  value?: unknown;
  message: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
}

export type ValidationResult =
  | { success: true; data: ProjectConfig; warnings: ValidationWarning[] }
  | { success: false; errors: ValidationError[]; warnings: ValidationWarning[] };

// ─── Zod Error Mapping ──────────────────────────────────────────────

function resolvePathValue(
  obj: Record<string, unknown>,
  pathParts: (string | number)[],
): unknown {
  let current: unknown = obj;
  for (const part of pathParts) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function mapZodErrors(
  issues: z.ZodIssue[],
  rawObj: Record<string, unknown>,
): ValidationError[] {
  return issues.flatMap((issue): ValidationError | ValidationError[] => {
    const path = issue.path.join('.');
    const actualValue = resolvePathValue(rawObj, issue.path as (string | number)[]);

    // Zod: unrecognized_keys — .strict() rejects unknown fields
    if (issue.code === 'unrecognized_keys') {
      const unrecognized = issue as z.ZodIssue & { keys: string[] };
      const keys = unrecognized.keys || [];
      return keys.map((key): ValidationError => ({
        path: path ? `${path}.${key}` : key,
        type: 'unknown_field',
        value: undefined,
        message: `Unknown field '${path ? `${path}.${key}` : key}' is not allowed in the config schema.`,
      }));
    }

    // Zod v4: invalid_type — distinguish missing (undefined) from wrong type
    if (issue.code === 'invalid_type') {
      if (actualValue === undefined) {
        return {
          path,
          type: 'missing_required',
          value: undefined,
          message: `Missing required field '${path}'. ${getFieldGuidance(path)}`,
        };
      }
      return {
        path,
        type: 'invalid_type',
        value: actualValue,
        message: `Invalid type for '${path}': expected ${issue.expected}, received ${typeof actualValue}. ${getFieldGuidance(path)}`,
      };
    }

    // Zod v4: invalid_value covers both literal mismatches and enum mismatches
    if (issue.code === 'invalid_value') {
      const issueWithValues = issue as z.ZodIssue & { values?: unknown[] };
      const values = issueWithValues.values;

      // Missing version (undefined doesn't match literal 1)
      if (path === 'version' && actualValue === undefined) {
        return {
          path,
          type: 'missing_required',
          value: undefined,
          message: `Missing required field 'version'. ${getFieldGuidance('version')}`,
        };
      }

      // Literal mismatch on version field
      if (path === 'version' && values && values.length === 1) {
        return {
          path,
          type: 'invalid_value',
          value: actualValue,
          message: `Unsupported config version '${actualValue}'. Supported versions: ${values.join(', ')}.`,
        };
      }

      // Enum mismatch — values contains the allowed options
      if (values && values.length > 1) {
        const allowed = values.join(', ');
        return {
          path,
          type: 'invalid_value',
          value: actualValue,
          message: `Invalid value '${actualValue}' for '${path}'. Allowed values: ${allowed}.`,
        };
      }
    }

    return {
      path,
      type: 'invalid_value',
      value: actualValue,
      message: issue.message,
    };
  });
}

function getFieldGuidance(path: string): string {
  const guidance: Record<string, string> = {
    version: "Add 'version: 1' at the top of your config.",
    project: "Add a 'project' section with 'name' and 'language'.",
    'project.name': 'Set project.name to your project name (e.g., "my-app").',
    'project.language':
      'Set project.language to one of: typescript, javascript, python, go, rust, java, kotlin, ruby, php.',
    runtime: "Add a 'runtime' section with 'manager'.",
    'runtime.manager':
      'Set runtime.manager to one of: bun, npm, yarn, pnpm, pip, poetry, cargo, maven, gradle, bundler, composer.',
    commands: "Add a 'commands' section with 'install'.",
    'commands.install':
      'Set commands.install to your install command (e.g., "bun install").',
  };
  return guidance[path] || '';
}

// ─── Credential Stripping ───────────────────────────────────────────

/**
 * Strip sensitive credentials (username, password) from service entries.
 * Returns a plain object with credentials removed from each service.
 */
export function stripServiceCredentials(
  config: ProjectConfig,
): Omit<ProjectConfig, 'services'> & { services: Record<string, unknown>[] } {
  const { services, ...rest } = config;
  const strippedServices = services.map(
    ({ username: _u, password: _p, ...service }) => service,
  );
  return { ...rest, services: strippedServices };
}

// ─── Public API ─────────────────────────────────────────────────────

export function validateConfig(raw: unknown): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const result = ProjectConfigSchema.safeParse(raw);

  if (result.success) {
    return { success: true, data: result.data, warnings };
  }

  const rawObj =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const errors = mapZodErrors(result.error.issues, rawObj);
  return { success: false, errors, warnings };
}
