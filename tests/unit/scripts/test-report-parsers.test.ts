import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const SCRIPT_PATH = join(__dirname, '../../../.claude-plugin/scripts/bash/run-tests-with-reports.sh');
const TMP_DIR = join(__dirname, '../../../tmp-test-report-parsers-test');
const REPORT_DIR = join(__dirname, '../../../tmp-test-report-parsers-reports');
const SUMMARY_PATH = join(REPORT_DIR, 'test-report-summary.json');

interface TestBucket {
  passed: number;
  failed: number;
  total: number;
  ran: boolean;
  error: string | null;
}

interface TestSummary {
  totalPassed: number;
  totalFailed: number;
  totalTests: number;
  hasErrors: boolean;
  unit: TestBucket;
  integration: TestBucket;
  e2e: TestBucket;
}

function runRunner(configPath: string, targetDir: string): TestSummary {
  try {
    execSync(`bash "${SCRIPT_PATH}" "${configPath}" "${targetDir}"`, {
      encoding: 'utf-8',
      timeout: 15000,
      env: { ...process.env, PORT: '0', TEST_REPORT_DIR: REPORT_DIR },
    });
  } catch {
    // Script always exits 0 — but if it somehow fails, we still want to read the summary
  }
  const raw = readFileSync(SUMMARY_PATH, 'utf-8');
  return JSON.parse(raw) as TestSummary;
}

function writeConfig(dir: string, config: string): string {
  const aiboardDir = join(dir, '.ai-board');
  mkdirSync(aiboardDir, { recursive: true });
  const configPath = join(aiboardDir, 'config.yml');
  writeFileSync(configPath, config);
  return configPath;
}

// yq is required — available in CI via setup-environment.sh, may not be installed locally
const hasYq = (() => {
  try { execSync('which yq', { encoding: 'utf-8' }); return true; } catch { return false; }
})();

// jq is required for JSON-based parsers
const hasJq = (() => {
  try { execSync('which jq', { encoding: 'utf-8' }); return true; } catch { return false; }
})();

describe.skipIf(!hasYq || !hasJq)('run-tests-with-reports.sh — parser tests', () => {

  beforeEach(() => {
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
    mkdirSync(TMP_DIR, { recursive: true });
    if (existsSync(REPORT_DIR)) {
      rmSync(REPORT_DIR, { recursive: true, force: true });
    }
    mkdirSync(REPORT_DIR, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(TMP_DIR)) {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
    if (existsSync(REPORT_DIR)) {
      rmSync(REPORT_DIR, { recursive: true, force: true });
    }
  });

  // ── vitest parser ────────────────────────────────────────────────

  it('parses vitest JSON report correctly', () => {
    const mockReport = join(TMP_DIR, 'vitest-output.json');
    writeFileSync(mockReport, JSON.stringify({
      testResults: [
        {
          assertionResults: [
            { status: 'passed', fullName: 'test 1' },
            { status: 'passed', fullName: 'test 2' },
            { status: 'passed', fullName: 'test 3' },
            { status: 'failed', fullName: 'test 4' },
          ],
        },
      ],
    }));

    // The vitest parser injects --reporter=json --outputFile=<file>,
    // so our mock command must produce the JSON file at the injected path.
    // We accomplish this by having the command copy our mock report to the
    // outputFile argument that the runner appends. We parse $@ in a wrapper.
    //
    // Simpler approach: the command writes the correct vitest JSON to the
    // report path the runner will use (/tmp/test-report-unit.json), and
    // also the injected --outputFile path. Since the runner injects
    // `--outputFile=/tmp/test-report-unit.json`, we make our command
    // copy the fixture there. But the runner *appends* flags, so we need
    // a command that ignores extra args.
    //
    // Easiest: use `cp <fixture> /tmp/test-report-unit.json; true` as the
    // test command. The runner appends --reporter=json --outputFile=...,
    // which bash will try to run as part of the command. To handle this,
    // we wrap in a script that ignores trailing args.
    const wrapperScript = join(TMP_DIR, 'mock-vitest.sh');
    writeFileSync(wrapperScript, `#!/bin/bash
# Extract the --outputFile= argument injected by the runner
for arg in "$@"; do
  case "$arg" in
    --outputFile=*) OUTFILE="\${arg#--outputFile=}" ;;
  esac
done
if [ -n "$OUTFILE" ]; then
  cp "${mockReport}" "$OUTFILE"
fi
exit 0
`);
    execSync(`chmod +x "${wrapperScript}"`);

    const configPath = writeConfig(TMP_DIR, `version: 1
project:
  name: Test
  language: typescript
runtime:
  manager: bun
testing:
  framework: vitest
commands:
  test: bash ${wrapperScript}
agent:
  cli: claude-code
`);

    const summary = runRunner(configPath, TMP_DIR);

    expect(summary.unit.ran).toBe(true);
    expect(summary.unit.passed).toBe(3);
    expect(summary.unit.failed).toBe(1);
    expect(summary.unit.total).toBe(4);
    expect(summary.totalPassed).toBe(3);
    expect(summary.totalFailed).toBe(1);
    expect(summary.totalTests).toBe(4);
    expect(summary.hasErrors).toBe(true);
  });

  // ── jest parser (same schema as vitest) ──────────────────────────

  it('parses jest JSON report correctly', () => {
    const mockReport = join(TMP_DIR, 'jest-output.json');
    writeFileSync(mockReport, JSON.stringify({
      testResults: [
        {
          assertionResults: [
            { status: 'passed', fullName: 'suite > passes 1' },
            { status: 'passed', fullName: 'suite > passes 2' },
            { status: 'failed', fullName: 'suite > fails 1' },
            { status: 'failed', fullName: 'suite > fails 2' },
            { status: 'failed', fullName: 'suite > fails 3' },
          ],
        },
      ],
    }));

    const wrapperScript = join(TMP_DIR, 'mock-jest.sh');
    writeFileSync(wrapperScript, `#!/bin/bash
for arg in "$@"; do
  case "$arg" in
    --outputFile=*) OUTFILE="\${arg#--outputFile=}" ;;
  esac
done
if [ -n "$OUTFILE" ]; then
  cp "${mockReport}" "$OUTFILE"
fi
exit 0
`);
    execSync(`chmod +x "${wrapperScript}"`);

    const configPath = writeConfig(TMP_DIR, `version: 1
project:
  name: Test
  language: typescript
runtime:
  manager: bun
testing:
  framework: jest
commands:
  test: bash ${wrapperScript}
agent:
  cli: claude-code
`);

    const summary = runRunner(configPath, TMP_DIR);

    expect(summary.unit.ran).toBe(true);
    expect(summary.unit.passed).toBe(2);
    expect(summary.unit.failed).toBe(3);
    expect(summary.unit.total).toBe(5);
    expect(summary.totalPassed).toBe(2);
    expect(summary.totalFailed).toBe(3);
    expect(summary.hasErrors).toBe(true);
  });

  // ── pytest parser ────────────────────────────────────────────────

  it('parses pytest text output for pass/fail counts', () => {
    // pytest parser greps for "N passed" and "N failed" from stdout
    // The runner appends --tb=short -q, so our echo command must tolerate trailing args
    const wrapperScript = join(TMP_DIR, 'mock-pytest.sh');
    writeFileSync(wrapperScript, `#!/bin/bash
echo "============================= test session starts =============================="
echo "collected 7 items"
echo ""
echo "tests/test_app.py .....FF"
echo ""
echo "========================= short test summary info =========================="
echo "FAILED tests/test_app.py::test_bad1"
echo "FAILED tests/test_app.py::test_bad2"
echo "========================= 5 passed, 2 failed in 1.23s ========================="
exit 1
`);
    execSync(`chmod +x "${wrapperScript}"`);

    const configPath = writeConfig(TMP_DIR, `version: 1
project:
  name: Test
  language: python
runtime:
  manager: pip
testing:
  framework: pytest
commands:
  test: bash ${wrapperScript}
agent:
  cli: claude-code
`);

    const summary = runRunner(configPath, TMP_DIR);

    expect(summary.unit.ran).toBe(true);
    expect(summary.unit.passed).toBe(5);
    expect(summary.unit.failed).toBe(2);
    expect(summary.unit.total).toBe(7);
    expect(summary.hasErrors).toBe(true);
  });

  it('parses pytest output with only passed tests', () => {
    const wrapperScript = join(TMP_DIR, 'mock-pytest-pass.sh');
    writeFileSync(wrapperScript, `#!/bin/bash
echo "========================= 12 passed in 0.45s ========================="
exit 0
`);
    execSync(`chmod +x "${wrapperScript}"`);

    const configPath = writeConfig(TMP_DIR, `version: 1
project:
  name: Test
  language: python
runtime:
  manager: pip
testing:
  framework: pytest
commands:
  test: bash ${wrapperScript}
agent:
  cli: claude-code
`);

    const summary = runRunner(configPath, TMP_DIR);

    expect(summary.unit.passed).toBe(12);
    expect(summary.unit.failed).toBe(0);
    expect(summary.unit.total).toBe(12);
    expect(summary.hasErrors).toBe(false);
  });

  // ── cargo-test parser ────────────────────────────────────────────

  it('parses cargo-test result line correctly', () => {
    const wrapperScript = join(TMP_DIR, 'mock-cargo.sh');
    writeFileSync(wrapperScript, `#!/bin/bash
echo "running 11 tests"
echo "test tests::test_add ... ok"
echo "test tests::test_sub ... ok"
echo "test tests::test_mul ... ok"
echo "test tests::test_div ... ok"
echo "test tests::test_mod ... ok"
echo "test tests::test_neg ... ok"
echo "test tests::test_abs ... ok"
echo "test tests::test_pow ... ok"
echo "test tests::test_sqrt ... ok"
echo "test tests::test_log ... ok"
echo "test tests::test_overflow ... FAILED"
echo ""
echo "test result: FAILED. 10 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s"
exit 1
`);
    execSync(`chmod +x "${wrapperScript}"`);

    const configPath = writeConfig(TMP_DIR, `version: 1
project:
  name: Test
  language: rust
runtime:
  manager: cargo
testing:
  framework: cargo-test
commands:
  test: bash ${wrapperScript}
agent:
  cli: claude-code
`);

    const summary = runRunner(configPath, TMP_DIR);

    expect(summary.unit.ran).toBe(true);
    expect(summary.unit.passed).toBe(10);
    expect(summary.unit.failed).toBe(1);
    expect(summary.unit.total).toBe(11);
    expect(summary.hasErrors).toBe(true);
  });

  it('parses cargo-test with all passing', () => {
    const wrapperScript = join(TMP_DIR, 'mock-cargo-pass.sh');
    writeFileSync(wrapperScript, `#!/bin/bash
echo "running 3 tests"
echo "test tests::test_a ... ok"
echo "test tests::test_b ... ok"
echo "test tests::test_c ... ok"
echo ""
echo "test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s"
exit 0
`);
    execSync(`chmod +x "${wrapperScript}"`);

    const configPath = writeConfig(TMP_DIR, `version: 1
project:
  name: Test
  language: rust
runtime:
  manager: cargo
testing:
  framework: cargo-test
commands:
  test: bash ${wrapperScript}
agent:
  cli: claude-code
`);

    const summary = runRunner(configPath, TMP_DIR);

    expect(summary.unit.passed).toBe(3);
    expect(summary.unit.failed).toBe(0);
    expect(summary.unit.total).toBe(3);
    expect(summary.hasErrors).toBe(false);
  });

  // ── go-test parser ───────────────────────────────────────────────

  it('parses go-test JSON output correctly', () => {
    // The go-test runner appends -json and redirects stdout to the report file.
    // Our mock command must produce JSON lines on stdout (which gets redirected).
    // The runner runs: `$cmd -json > $report_file` — so our wrapper just prints lines.
    const wrapperScript = join(TMP_DIR, 'mock-gotest.sh');
    writeFileSync(wrapperScript, `#!/bin/bash
# go test -json output: one JSON object per line
# The runner appends -json to our command, so we just ignore that flag and output
echo '{"Action":"run","Test":"TestAdd","Package":"math"}'
echo '{"Action":"pass","Test":"TestAdd","Package":"math","Elapsed":0.01}'
echo '{"Action":"run","Test":"TestSub","Package":"math"}'
echo '{"Action":"pass","Test":"TestSub","Package":"math","Elapsed":0.01}'
echo '{"Action":"run","Test":"TestDiv","Package":"math"}'
echo '{"Action":"pass","Test":"TestDiv","Package":"math","Elapsed":0.02}'
echo '{"Action":"run","Test":"TestOverflow","Package":"math"}'
echo '{"Action":"fail","Test":"TestOverflow","Package":"math","Elapsed":0.03}'
echo '{"Action":"pass","Package":"math","Elapsed":0.1}'
exit 0
`);
    execSync(`chmod +x "${wrapperScript}"`);

    const configPath = writeConfig(TMP_DIR, `version: 1
project:
  name: Test
  language: go
runtime:
  manager: go
testing:
  framework: go-test
commands:
  test: bash ${wrapperScript}
agent:
  cli: claude-code
`);

    const summary = runRunner(configPath, TMP_DIR);

    expect(summary.unit.ran).toBe(true);
    // 3 test-level passes (TestAdd, TestSub, TestDiv), 1 test-level fail (TestOverflow)
    // The package-level pass line has no "Test" field, so the parser skips it
    expect(summary.unit.passed).toBe(3);
    expect(summary.unit.failed).toBe(1);
    expect(summary.unit.total).toBe(4);
    expect(summary.hasErrors).toBe(true);
  });

  // ── rspec parser ─────────────────────────────────────────────────

  it('parses rspec JSON report correctly', () => {
    const mockReport = join(TMP_DIR, 'rspec-output.json');
    writeFileSync(mockReport, JSON.stringify({
      examples: [
        { id: './spec/models/user_spec.rb[1:1]', status: 'passed', description: 'is valid' },
        { id: './spec/models/user_spec.rb[1:2]', status: 'passed', description: 'has email' },
        { id: './spec/models/user_spec.rb[1:3]', status: 'failed', description: 'validates name' },
        { id: './spec/models/post_spec.rb[1:1]', status: 'passed', description: 'has title' },
      ],
      summary: { example_count: 4, failure_count: 1 },
    }));

    // rspec runner injects: --format json --out <report_file>
    // Our mock extracts --out value and copies the fixture there
    const wrapperScript = join(TMP_DIR, 'mock-rspec.sh');
    writeFileSync(wrapperScript, `#!/bin/bash
OUTFILE=""
NEXT_IS_OUT=false
for arg in "$@"; do
  if [ "$NEXT_IS_OUT" = true ]; then
    OUTFILE="$arg"
    NEXT_IS_OUT=false
  elif [ "$arg" = "--out" ]; then
    NEXT_IS_OUT=true
  fi
done
if [ -n "$OUTFILE" ]; then
  cp "${mockReport}" "$OUTFILE"
fi
exit 0
`);
    execSync(`chmod +x "${wrapperScript}"`);

    const configPath = writeConfig(TMP_DIR, `version: 1
project:
  name: Test
  language: ruby
runtime:
  manager: bundler
testing:
  framework: rspec
commands:
  test: bash ${wrapperScript}
agent:
  cli: claude-code
`);

    const summary = runRunner(configPath, TMP_DIR);

    expect(summary.unit.ran).toBe(true);
    expect(summary.unit.passed).toBe(3);
    expect(summary.unit.failed).toBe(1);
    expect(summary.unit.total).toBe(4);
    expect(summary.hasErrors).toBe(true);
  });

  // ── exit-code fallback ───────────────────────────────────────────

  it('uses exit-code fallback when no framework specified — exit 0 gives 1 passed', () => {
    const configPath = writeConfig(TMP_DIR, `version: 1
project:
  name: Test
  language: unknown
runtime:
  manager: make
commands:
  test: "exit 0"
agent:
  cli: claude-code
`);

    const summary = runRunner(configPath, TMP_DIR);

    expect(summary.unit.ran).toBe(true);
    expect(summary.unit.passed).toBe(1);
    expect(summary.unit.failed).toBe(0);
    expect(summary.unit.total).toBe(1);
    expect(summary.hasErrors).toBe(false);
  });

  it('uses exit-code fallback when no framework specified — exit 1 gives 1 failed', () => {
    const configPath = writeConfig(TMP_DIR, `version: 1
project:
  name: Test
  language: unknown
runtime:
  manager: make
commands:
  test: "exit 1"
agent:
  cli: claude-code
`);

    const summary = runRunner(configPath, TMP_DIR);

    expect(summary.unit.ran).toBe(true);
    expect(summary.unit.passed).toBe(0);
    expect(summary.unit.failed).toBe(1);
    expect(summary.unit.total).toBe(1);
    expect(summary.hasErrors).toBe(true);
  });

  // ── summary schema validation ────────────────────────────────────

  it('produces summary JSON with all required fields', () => {
    const configPath = writeConfig(TMP_DIR, `version: 1
project:
  name: Test
  language: typescript
runtime:
  manager: bun
commands:
  test: "exit 0"
agent:
  cli: claude-code
`);

    const summary = runRunner(configPath, TMP_DIR);

    // Top-level fields
    expect(summary).toHaveProperty('totalPassed');
    expect(summary).toHaveProperty('totalFailed');
    expect(summary).toHaveProperty('totalTests');
    expect(summary).toHaveProperty('hasErrors');

    // Bucket fields
    for (const bucket of ['unit', 'integration', 'e2e'] as const) {
      expect(summary).toHaveProperty(bucket);
      expect(summary[bucket]).toHaveProperty('passed');
      expect(summary[bucket]).toHaveProperty('failed');
      expect(summary[bucket]).toHaveProperty('total');
      expect(summary[bucket]).toHaveProperty('ran');
      expect(summary[bucket]).toHaveProperty('error');
    }

    // Type correctness
    expect(typeof summary.totalPassed).toBe('number');
    expect(typeof summary.totalFailed).toBe('number');
    expect(typeof summary.totalTests).toBe('number');
    expect(typeof summary.hasErrors).toBe('boolean');
    expect(typeof summary.unit.passed).toBe('number');
    expect(typeof summary.unit.ran).toBe('boolean');
    // error is either null or string
    expect(summary.unit.error === null || typeof summary.unit.error === 'string').toBe(true);
  });

  it('totalTests equals totalPassed + totalFailed', () => {
    const mockReport = join(TMP_DIR, 'vitest-schema.json');
    writeFileSync(mockReport, JSON.stringify({
      testResults: [
        {
          assertionResults: [
            { status: 'passed', fullName: 'a' },
            { status: 'failed', fullName: 'b' },
          ],
        },
      ],
    }));

    const wrapperScript = join(TMP_DIR, 'mock-schema.sh');
    writeFileSync(wrapperScript, `#!/bin/bash
for arg in "$@"; do
  case "$arg" in
    --outputFile=*) OUTFILE="\${arg#--outputFile=}" ;;
  esac
done
if [ -n "$OUTFILE" ]; then
  cp "${mockReport}" "$OUTFILE"
fi
exit 0
`);
    execSync(`chmod +x "${wrapperScript}"`);

    const configPath = writeConfig(TMP_DIR, `version: 1
project:
  name: Test
  language: typescript
runtime:
  manager: bun
testing:
  framework: vitest
commands:
  test: bash ${wrapperScript}
agent:
  cli: claude-code
`);

    const summary = runRunner(configPath, TMP_DIR);

    expect(summary.totalTests).toBe(summary.totalPassed + summary.totalFailed);
    expect(summary.unit.total).toBe(summary.unit.passed + summary.unit.failed);
  });

  // ── no test command configured ───────────────────────────────────

  it('reports error when no test commands are configured', () => {
    const configPath = writeConfig(TMP_DIR, `version: 1
project:
  name: Test
  language: typescript
runtime:
  manager: bun
commands:
  install: echo installed
agent:
  cli: claude-code
`);

    const summary = runRunner(configPath, TMP_DIR);

    expect(summary.unit.ran).toBe(false);
    expect(summary.unit.error).toBe('No test commands configured');
    expect(summary.totalTests).toBe(0);
  });

  // ── config file not found ────────────────────────────────────────

  it('handles missing config.yml gracefully', () => {
    const fakePath = join(TMP_DIR, '.ai-board', 'nonexistent.yml');

    const summary = runRunner(fakePath, TMP_DIR);

    expect(summary.hasErrors).toBe(true);
    expect(summary.unit.error).toContain('Config file not found');
    expect(summary.totalTests).toBe(0);
  });

  // ── granular mode ────────────────────────────────────────────────

  it('runs granular mode when test_unit command is present', () => {
    const wrapperScript = join(TMP_DIR, 'mock-granular.sh');
    writeFileSync(wrapperScript, `#!/bin/bash
echo "========================= 3 passed in 0.10s ========================="
exit 0
`);
    execSync(`chmod +x "${wrapperScript}"`);

    const configPath = writeConfig(TMP_DIR, `version: 1
project:
  name: Test
  language: python
runtime:
  manager: pip
testing:
  framework: pytest
commands:
  test_unit: bash ${wrapperScript}
agent:
  cli: claude-code
`);

    const summary = runRunner(configPath, TMP_DIR);

    expect(summary.unit.ran).toBe(true);
    expect(summary.unit.passed).toBe(3);
    expect(summary.unit.failed).toBe(0);
    // integration and e2e should not have run
    expect(summary.integration.ran).toBe(false);
    expect(summary.e2e.ran).toBe(false);
  });

  // ── safety-net fallback: parser returns 0 0 0 but exit is non-zero ─

  it('falls back to exit-code parser when framework parser returns all zeros on failure', () => {
    // If vitest command fails and produces no report file, the parser returns 0 0 0.
    // The safety net should then use exit-code fallback: 0 1 1
    const wrapperScript = join(TMP_DIR, 'mock-vitest-crash.sh');
    writeFileSync(wrapperScript, `#!/bin/bash
# Simulates vitest crashing — produces no report file, exits non-zero
exit 1
`);
    execSync(`chmod +x "${wrapperScript}"`);

    const configPath = writeConfig(TMP_DIR, `version: 1
project:
  name: Test
  language: typescript
runtime:
  manager: bun
testing:
  framework: vitest
commands:
  test: bash ${wrapperScript}
agent:
  cli: claude-code
`);

    const summary = runRunner(configPath, TMP_DIR);

    expect(summary.unit.ran).toBe(true);
    // Safety net: exit-code fallback gives 0 passed, 1 failed
    expect(summary.unit.passed).toBe(0);
    expect(summary.unit.failed).toBe(1);
    expect(summary.unit.total).toBe(1);
    expect(summary.hasErrors).toBe(true);
  });
});
