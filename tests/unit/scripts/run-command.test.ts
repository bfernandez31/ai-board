import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

const SCRIPT_PATH = path.resolve(
  __dirname,
  "../../../.github/scripts/run-command.sh"
);

function runCommand(
  args: string,
  env?: Record<string, string>
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const result = execSync(`bash ${SCRIPT_PATH} ${args}`, {
      encoding: "utf-8",
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout: result, stderr: "", exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      status?: number;
    };
    return {
      stdout: execError.stdout || "",
      stderr: execError.stderr || "",
      exitCode: execError.status || 1,
    };
  }
}

describe("run-command.sh", () => {
  let tmpDir: string;

  beforeAll(() => {
    expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function createTmpDir(): string {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "run-cmd-test-"));
    return tmpDir;
  }

  function createConfig(dir: string, content: string): void {
    const configDir = path.join(dir, ".ai-board");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, "config.yml"), content);
  }

  it("T1: valid config executes configured command and returns exit code", () => {
    const dir = createTmpDir();
    createConfig(
      dir,
      `version: 1
commands:
  install: echo "hello from config"
`
    );

    const result = runCommand(`${dir} install`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hello from config");
  });

  it("T2: missing config uses fallback default", () => {
    const dir = createTmpDir();
    // No .ai-board/config.yml — should attempt fallback
    // The fallback for 'install' is 'bun install --frozen-lockfile' which will fail
    // in this test env. We just verify it tries and returns non-zero.
    const result = runCommand(`${dir} install`);
    // Fallback attempted — stderr should mention fallback
    expect(result.stderr).toContain("fallback default");
  });

  it("T3: empty command value exits 0 silently", () => {
    const dir = createTmpDir();
    createConfig(
      dir,
      `version: 1
commands:
  install: ""
`
    );

    const result = runCommand(`${dir} install`);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("T4: missing command key exits 0 silently", () => {
    const dir = createTmpDir();
    createConfig(
      dir,
      `version: 1
commands:
  install: echo "exists"
`
    );

    const result = runCommand(`${dir} build`);
    expect(result.exitCode).toBe(0);
  });

  it("T5: invalid YAML exits 2 with error message", () => {
    const dir = createTmpDir();
    createConfig(dir, `{{{invalid yaml!!!`);

    const result = runCommand(`${dir} install`);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid YAML");
  });

  it("T6: unrecognized command key with no config exits 0 silently", () => {
    const dir = createTmpDir();
    // No config file, unrecognized key
    const result = runCommand(`${dir} deploy`);
    expect(result.exitCode).toBe(0);
  });

  it("T7: missing arguments fails with usage message", () => {
    const result = runCommand("");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Usage:");
  });

  it("T8: command failure returns non-zero exit code faithfully", () => {
    const dir = createTmpDir();
    createConfig(
      dir,
      `version: 1
commands:
  build: exit 42
`
    );

    const result = runCommand(`${dir} build`);
    expect(result.exitCode).toBe(42);
  });
});
