/**
 * Contract: .ai-board/config.yml Public API
 *
 * This file defines the TypeScript interface contract that consumers
 * (workflows, CLI tools) use to interact with the config validation utility.
 * Implementation must satisfy these interfaces exactly.
 */

// ─── Enums ───────────────────────────────────────────────────────────

export type ProjectLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java' | 'kotlin' | 'ruby' | 'php';

export type ProjectFramework = 'nextjs' | 'express' | 'fastapi' | 'django' | 'flask' | 'gin' | 'spring-boot' | 'quarkus' | 'micronaut' | 'rails' | 'laravel' | 'rspec' | 'phpunit' | 'actix' | 'rocket' | 'none';

export type PackageManager = 'bun' | 'npm' | 'yarn' | 'pnpm' | 'pip' | 'poetry' | 'cargo' | 'maven' | 'gradle' | 'bundler' | 'composer';

export type ServiceType = 'postgres' | 'redis' | 'mysql' | 'mongo';

export type AgentCli = 'claude-code' | 'codex';

export type ValidationErrorType = 'missing_required' | 'invalid_value' | 'invalid_type' | 'unknown_field';

// ─── Config Sections ─────────────────────────────────────────────────

export interface ProjectSection {
  name: string;
  language: ProjectLanguage;
  framework: ProjectFramework; // defaults to "none"
}

export interface RuntimeSection {
  manager: PackageManager;
  manager_version?: string;
  node?: string;
  python?: string;
}

export interface CommandsSection {
  install: string;
  build?: string;
  lint?: string;
  type_check?: string;
  test_unit?: string;
  test_integration?: string;
  test_e2e?: string;
}

export interface ServiceConfig {
  type: ServiceType;
  version: string;
  database?: string;
  username?: string;
  password?: string;
}

export interface AgentSection {
  cli: AgentCli; // defaults to "claude-code"
  model?: string;
}

// ─── Root Config ─────────────────────────────────────────────────────

export interface ProjectConfig {
  version: 1;
  project: ProjectSection;
  runtime: RuntimeSection;
  services: ServiceConfig[];
  commands: CommandsSection;
  env: Record<string, string>;
  agent: AgentSection;
}

// ─── Validation Results ──────────────────────────────────────────────

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

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Validate a parsed YAML object against the config schema.
 * Returns all errors/warnings at once (never fails on first error).
 */
export type ValidateConfig = (raw: unknown) => ValidationResult;

/**
 * Load and validate a config file from a given directory path.
 * Reads `.ai-board/config.yml`, parses YAML, validates schema.
 * Throws on file-not-found with specific error message (FR-010).
 */
export type LoadConfig = (projectDir: string) => Promise<ValidationResult>;
