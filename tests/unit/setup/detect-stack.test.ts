import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SCRIPT_PATH = path.resolve(__dirname, '../../../.specify/scripts/bash/detect-stack.sh');

function runDetection(dir: string): { config: string; analysis: string } {
  // Run the detection script in the temp directory
  execSync(`bash "${SCRIPT_PATH}"`, {
    cwd: dir,
    env: { ...process.env, HOME: os.homedir() },
    timeout: 10000,
  });

  const configPath = path.join(dir, '.ai-board', 'config.yml');
  const analysisPath = path.join(dir, '.ai-board', 'analysis.json');

  return {
    config: fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : '',
    analysis: fs.existsSync(analysisPath) ? fs.readFileSync(analysisPath, 'utf-8') : '',
  };
}

describe('detect-stack.sh', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-stack-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects TypeScript/Next.js/Bun project', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'my-nextjs-app',
        dependencies: { next: '16.0.0', react: '18.0.0' },
        devDependencies: { typescript: '5.0.0' },
      })
    );
    fs.writeFileSync(path.join(tmpDir, 'bun.lock'), '');
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');

    const { config, analysis } = runDetection(tmpDir);

    expect(config).toContain('language: typescript');
    expect(config).toContain('framework: nextjs');
    expect(config).toContain('manager: bun');
    expect(analysis).toBeTruthy();
  });

  it('detects Rust/Cargo project', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'Cargo.toml'),
      `[package]\nname = "my-app"\nversion = "0.1.0"\n\n[dependencies]\nactix-web = "4"\n`
    );

    const { config } = runDetection(tmpDir);

    expect(config).toContain('language: rust');
    expect(config).toContain('manager: cargo');
  });

  it('detects Python/FastAPI project', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'pyproject.toml'),
      `[project]\nname = "myapp"\ndependencies = ["fastapi"]\n`
    );

    const { config } = runDetection(tmpDir);

    expect(config).toContain('language: python');
    expect(config).toContain('framework: fastapi');
  });

  it('detects Ruby/Rails/Bundler project', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'Gemfile'),
      `source "https://rubygems.org"\ngem "rails", "~> 7.0"\n`
    );

    const { config } = runDetection(tmpDir);

    expect(config).toContain('language: ruby');
    expect(config).toContain('framework: rails');
    expect(config).toContain('manager: bundler');
  });

  it('detects PHP/Laravel/Composer project', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'composer.json'),
      JSON.stringify({
        name: 'my/app',
        require: { 'laravel/framework': '^10.0' },
      })
    );

    const { config } = runDetection(tmpDir);

    expect(config).toContain('language: php');
    expect(config).toContain('framework: laravel');
    expect(config).toContain('manager: composer');
  });

  it('detects Go project', () => {
    fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/myapp\n\ngo 1.21\n');

    const { config } = runDetection(tmpDir);

    expect(config).toContain('language: go');
  });

  it('detects Java/Gradle project', () => {
    fs.writeFileSync(path.join(tmpDir, 'build.gradle'), 'apply plugin: "java"\n');

    const { config } = runDetection(tmpDir);

    expect(config).toContain('language: java');
    expect(config).toContain('manager: gradle');
  });

  it('produces minimal config for unknown project', () => {
    // Empty directory — nothing to detect
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# My Project');

    const { config } = runDetection(tmpDir);

    // Should still produce a valid config with defaults
    expect(config).toContain('version: 1');
    expect(config).toContain('language:');
  });

  it('generates analysis.json with detected info', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', dependencies: { express: '4.0.0' } })
    );

    const { analysis } = runDetection(tmpDir);
    const parsed = JSON.parse(analysis);

    expect(parsed).toHaveProperty('language');
    expect(parsed).toHaveProperty('framework');
    expect(parsed).toHaveProperty('packageManager');
  });
});
