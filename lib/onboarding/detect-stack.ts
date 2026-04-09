import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type {
  AgentSection,
  CommandsSection,
  PackageManagerSchema,
  ProjectFrameworkSchema,
  ProjectLanguageSchema,
  RuntimeSection,
  ServiceConfig,
} from '@/lib/validations/config';

type ProjectLanguage = z.infer<typeof ProjectLanguageSchema>;
type ProjectFramework = z.infer<typeof ProjectFrameworkSchema>;
type PackageManager = z.infer<typeof PackageManagerSchema>;

export interface RepositoryAnalysisSummary {
  projectName: string;
  primaryLanguage: ProjectLanguage;
  packageManager: PackageManager;
  framework: ProjectFramework;
  services: ServiceConfig[];
  commands: Partial<CommandsSection>;
  runtime: Partial<RuntimeSection>;
  agent: AgentSection;
  signals: string[];
  conflicts: string[];
  defaultBranch: string;
}

export interface DetectStackOptions {
  agent?: 'CLAUDE' | 'CODEX';
  defaultBranch?: string;
}

function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;

  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function readTextFile(filePath: string): string | null {
  if (!existsSync(filePath)) return null;

  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function inferNodePackageManager(repoRoot: string): PackageManager {
  if (existsSync(path.join(repoRoot, 'bun.lockb')) || existsSync(path.join(repoRoot, 'bun.lock'))) return 'bun';
  if (existsSync(path.join(repoRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(path.join(repoRoot, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function inferServices(repoRoot: string): ServiceConfig[] {
  const services = new Map<string, ServiceConfig>();
  const add = (service: ServiceConfig) => services.set(service.type, service);
  const dockerCompose = readTextFile(path.join(repoRoot, 'docker-compose.yml'))
    ?? readTextFile(path.join(repoRoot, 'docker-compose.yaml'))
    ?? '';
  const prismaSchema = readTextFile(path.join(repoRoot, 'prisma/schema.prisma')) ?? '';
  const gemfile = readTextFile(path.join(repoRoot, 'Gemfile')) ?? '';

  const postgresSignal = [dockerCompose, prismaSchema, gemfile].some((value) => /postgres/i.test(value));
  const mysqlSignal = [dockerCompose, prismaSchema].some((value) => /mysql/i.test(value));
  const redisSignal = [dockerCompose].some((value) => /redis/i.test(value));
  const mongoSignal = [dockerCompose].some((value) => /mongo/i.test(value));

  if (postgresSignal) add({ type: 'postgres', version: 'latest' });
  if (mysqlSignal) add({ type: 'mysql', version: 'latest' });
  if (redisSignal) add({ type: 'redis', version: 'latest' });
  if (mongoSignal) add({ type: 'mongo', version: 'latest' });

  return [...services.values()];
}

function normalizeNodeCommands(
  scripts: Record<string, string> | undefined,
  manager: PackageManager,
): Partial<CommandsSection> {
  const run = manager === 'npm' ? 'npm run' : `${manager} run`;
  const install = manager === 'yarn' ? 'yarn install' : `${manager} install`;

  return {
    install,
    build: scripts?.build ? `${run} build` : undefined,
    lint: scripts?.lint ? `${run} lint` : undefined,
    type_check: scripts?.['type-check'] ? `${run} type-check` : scripts?.typecheck ? `${run} typecheck` : undefined,
    test_unit: scripts?.['test:unit'] ? `${run} test:unit` : scripts?.test ? `${run} test` : undefined,
    test_integration: scripts?.['test:integration'] ? `${run} test:integration` : undefined,
    test_e2e: scripts?.['test:e2e'] ? `${run} test:e2e` : undefined,
    db_setup: scripts?.['db:setup'] ? `${run} db:setup` : scripts?.['prisma:generate'] ? `${run} prisma:generate` : undefined,
    db_seed: scripts?.['db:seed'] ? `${run} db:seed` : undefined,
  };
}

function resolveFrameworkNode(repoRoot: string, pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null): ProjectFramework {
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  if (deps.next || existsSync(path.join(repoRoot, 'next.config.js')) || existsSync(path.join(repoRoot, 'next.config.mjs')) || existsSync(path.join(repoRoot, 'next.config.ts'))) {
    return 'nextjs';
  }
  if (deps.express) return 'express';
  return 'none';
}

function resolvePythonFramework(pyproject: string): ProjectFramework {
  if (/fastapi/i.test(pyproject)) return 'fastapi';
  if (/django/i.test(pyproject)) return 'django';
  if (/flask/i.test(pyproject)) return 'flask';
  return 'none';
}

function resolveJavaBuildFile(entries: Set<string>, repoRoot: string): string {
  if (entries.has('pom.xml')) {
    return path.join(repoRoot, 'pom.xml');
  }

  if (entries.has('build.gradle.kts')) {
    return path.join(repoRoot, 'build.gradle.kts');
  }

  return path.join(repoRoot, 'build.gradle');
}

function resolveJavaFramework(buildFile: string): ProjectFramework {
  if (/spring-boot/i.test(buildFile)) return 'spring-boot';
  if (/quarkus/i.test(buildFile)) return 'quarkus';
  if (/micronaut/i.test(buildFile)) return 'micronaut';
  return 'none';
}

export async function detectStackFromRepository(
  repoRoot: string,
  options: DetectStackOptions = {},
): Promise<RepositoryAnalysisSummary> {
  const entries = new Set(await readdir(repoRoot));
  const projectName = path.basename(repoRoot);
  const signals: string[] = [];
  const conflicts: string[] = [];
  const agent: AgentSection = { cli: options.agent === 'CODEX' ? 'codex' : 'claude-code' };
  const services = inferServices(repoRoot);

  if (entries.has('package.json')) {
    const pkg = readJsonFile<{ name?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string> }>(path.join(repoRoot, 'package.json'));
    const manager = inferNodePackageManager(repoRoot);
    const framework = resolveFrameworkNode(repoRoot, pkg);
    signals.push('Detected package.json');
    if (framework !== 'none') signals.push(`Detected ${framework}`);

    return {
      projectName: pkg?.name || projectName,
      primaryLanguage: existsSync(path.join(repoRoot, 'tsconfig.json')) ? 'typescript' : 'javascript',
      packageManager: manager,
      framework,
      services,
      commands: normalizeNodeCommands(pkg?.scripts, manager),
      runtime: { manager, node: '22' },
      agent,
      signals,
      conflicts,
      defaultBranch: options.defaultBranch ?? 'main',
    };
  }

  if (entries.has('pyproject.toml') || entries.has('requirements.txt')) {
    const pyproject = readTextFile(path.join(repoRoot, 'pyproject.toml')) ?? '';
    const manager: PackageManager = /poetry/i.test(pyproject) ? 'poetry' : 'pip';
    const framework = resolvePythonFramework(pyproject);
    signals.push(entries.has('pyproject.toml') ? 'Detected pyproject.toml' : 'Detected requirements.txt');

    return {
      projectName,
      primaryLanguage: 'python',
      packageManager: manager,
      framework,
      services,
      commands: {
        install: manager === 'poetry' ? 'poetry install' : 'pip install -r requirements.txt',
        test_unit: manager === 'poetry' ? 'poetry run pytest' : 'pytest',
      },
      runtime: { manager, python: '3.12' },
      agent,
      signals,
      conflicts,
      defaultBranch: options.defaultBranch ?? 'main',
    };
  }

  if (entries.has('Gemfile')) {
    signals.push('Detected Gemfile');
    return {
      projectName,
      primaryLanguage: 'ruby',
      packageManager: 'bundler',
      framework: existsSync(path.join(repoRoot, 'config/application.rb')) ? 'rails' : 'none',
      services,
      commands: {
        install: 'bundle install',
        test_unit: existsSync(path.join(repoRoot, 'spec')) ? 'bundle exec rspec' : undefined,
      },
      runtime: { manager: 'bundler', ruby: '3.3' },
      agent,
      signals,
      conflicts,
      defaultBranch: options.defaultBranch ?? 'main',
    };
  }

  if (entries.has('composer.json')) {
    const composer = readJsonFile<{ scripts?: Record<string, string>; require?: Record<string, string> }>(path.join(repoRoot, 'composer.json'));
    signals.push('Detected composer.json');
    return {
      projectName,
      primaryLanguage: 'php',
      packageManager: 'composer',
      framework: composer?.require?.laravel || existsSync(path.join(repoRoot, 'artisan')) ? 'laravel' : 'none',
      services,
      commands: {
        install: 'composer install',
        test_unit: composer?.scripts?.test ? 'composer test' : 'php artisan test',
      },
      runtime: { manager: 'composer', php: '8.3' },
      agent,
      signals,
      conflicts,
      defaultBranch: options.defaultBranch ?? 'main',
    };
  }

  if (entries.has('Cargo.toml')) {
    signals.push('Detected Cargo.toml');
    return {
      projectName,
      primaryLanguage: 'rust',
      packageManager: 'cargo',
      framework: 'none',
      services,
      commands: {
        install: 'cargo fetch',
        build: 'cargo build',
        test_unit: 'cargo test',
      },
      runtime: { manager: 'cargo', rust: 'stable' },
      agent,
      signals,
      conflicts,
      defaultBranch: options.defaultBranch ?? 'main',
    };
  }

  if (entries.has('go.mod')) {
    const goMod = readTextFile(path.join(repoRoot, 'go.mod')) ?? '';
    signals.push('Detected go.mod');
    return {
      projectName,
      primaryLanguage: 'go',
      packageManager: 'npm',
      framework: /gin-gonic\/gin/i.test(goMod) ? 'gin' : 'none',
      services,
      commands: {
        install: 'go mod download',
        build: 'go build ./...',
        test_unit: 'go test ./...',
      },
      runtime: { manager: 'npm', go: '1.22' },
      agent,
      signals,
      conflicts,
      defaultBranch: options.defaultBranch ?? 'main',
    };
  }

  if (entries.has('pom.xml') || entries.has('build.gradle') || entries.has('build.gradle.kts')) {
    const manager: PackageManager = entries.has('pom.xml') ? 'maven' : 'gradle';
    const buildFile = readTextFile(resolveJavaBuildFile(entries, repoRoot)) ?? '';
    const framework = resolveJavaFramework(buildFile);
    const primaryLanguage: ProjectLanguage = /kotlin/i.test(buildFile) || entries.has('settings.gradle.kts') ? 'kotlin' : 'java';
    if (primaryLanguage === 'kotlin' && framework === 'spring-boot') {
      conflicts.push('Detected Kotlin build with Spring Boot dependencies');
    }
    signals.push(entries.has('pom.xml') ? 'Detected pom.xml' : 'Detected Gradle build file');

    return {
      projectName,
      primaryLanguage,
      packageManager: manager,
      framework,
      services,
      commands: {
        install: manager === 'maven' ? 'mvn -q -DskipTests compile' : './gradlew build -x test',
        build: manager === 'maven' ? 'mvn -q -DskipTests package' : './gradlew build -x test',
        test_unit: manager === 'maven' ? 'mvn test' : './gradlew test',
      },
      runtime: { manager, java: '21' },
      agent,
      signals,
      conflicts,
      defaultBranch: options.defaultBranch ?? 'main',
    };
  }

  throw new Error('Unable to determine a supported project stack from repository contents');
}
