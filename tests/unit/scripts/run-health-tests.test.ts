import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT_PATH = join(__dirname, '../../../scripts/run-health-tests.sh');
const TMP_ROOT = join(tmpdir(), 'run-health-tests-spec');

function writeExecutable(path: string, content: string) {
  writeFileSync(path, content, { mode: 0o755 });
}

function setupFixture(name: string) {
  const root = join(TMP_ROOT, name);
  const targetDir = join(root, 'target-repo');
  const helpersDir = join(root, 'helpers');

  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(targetDir, '.ai-board'), { recursive: true });
  mkdirSync(helpersDir, { recursive: true });

  return { root, targetDir, helpersDir };
}

function runHealthTests(args: string[], env: NodeJS.ProcessEnv) {
  execFileSync('bash', [SCRIPT_PATH, ...args], {
    env: {
      ...process.env,
      ...env,
    },
    encoding: 'utf-8',
    timeout: 15000,
  });

  return JSON.parse(readFileSync('/tmp/health-scan-result.json', 'utf-8')) as Record<string, unknown>;
}

afterEach(() => {
  rmSync(TMP_ROOT, { recursive: true, force: true });
  rmSync('/tmp/health-scan-result.json', { force: true });
  rmSync('/tmp/test-report-summary.json', { force: true });
  rmSync('/tmp/run-health-tests-counter', { force: true });
  rmSync('/tmp/run-health-tests-target-path', { force: true });
  rmSync('/tmp/health-tests-fix-result.json', { force: true });
});

describe('run-health-tests.sh', () => {
  it('writes a skipped result envelope when no primary test command is configured', () => {
    const { targetDir, helpersDir } = setupFixture('skip-no-primary');

    writeFileSync(
      join(targetDir, '.ai-board/config.yml'),
      `version: 1
project:
  name: fixture
  language: typescript
runtime:
  manager: bun
commands:
  install: bun install
testCapabilities:
  framework: vitest
  primaryCommandKey: null
  hasE2E: false
agent:
  cli: claude-code
`,
    );

    writeExecutable(
      join(helpersDir, 'run-tests-with-reports.sh'),
      '#!/bin/bash\nexit 99\n',
    );

    const result = runHealthTests(['CLAUDE', targetDir], {
      AI_BOARD_RUN_TESTS_WITH_REPORTS: join(helpersDir, 'run-tests-with-reports.sh'),
      AI_BOARD_RUN_AGENT: '/bin/true',
    });

    expect(result).toMatchObject({
      score: null,
      issuesFound: 0,
      issuesFixed: 0,
      skipped: true,
      skipReason: expect.stringContaining('No executable automated test command'),
      report: {
        type: 'TESTS',
        autoFixed: [],
        nonFixable: [],
        generatedTickets: [],
      },
    });
  });

  it('executes the shared test runner against the explicit target repository path', () => {
    const { targetDir, helpersDir } = setupFixture('target-path');

    writeFileSync(
      join(targetDir, '.ai-board/config.yml'),
      `version: 1
project:
  name: fixture
  language: typescript
runtime:
  manager: bun
commands:
  install: bun install
  test_unit: echo tests
testCapabilities:
  framework: vitest
  primaryCommandKey: test_unit
  hasE2E: false
agent:
  cli: claude-code
`,
    );

    writeExecutable(
      join(helpersDir, 'run-tests-with-reports.sh'),
      `#!/bin/bash
set -euo pipefail
printf '%s' "$1" > /tmp/run-health-tests-target-path
cat > /tmp/test-report-summary.json <<'JSON'
{"totalPassed":8,"totalFailed":0,"totalTests":8,"hasErrors":false,"unit":{"passed":8,"failed":0,"total":8,"ran":true,"error":null},"integration":{"passed":0,"failed":0,"total":0,"ran":false,"error":null},"e2e":{"passed":0,"failed":0,"total":0,"ran":false,"error":null}}
JSON
`,
    );

    const result = runHealthTests(['CLAUDE', targetDir], {
      AI_BOARD_RUN_TESTS_WITH_REPORTS: join(helpersDir, 'run-tests-with-reports.sh'),
      AI_BOARD_RUN_AGENT: '/bin/true',
    });

    expect(readFileSync('/tmp/run-health-tests-target-path', 'utf-8')).toBe(targetDir);
    expect(result).toMatchObject({
      score: 100,
      issuesFound: 0,
      issuesFixed: 0,
      skipped: false,
      report: {
        type: 'TESTS',
        autoFixed: [],
        nonFixable: [],
        generatedTickets: [],
      },
    });
  });

  it('preserves the first-run score and stops after the retry limit', () => {
    const { targetDir, helpersDir } = setupFixture('retry-limit');

    writeFileSync(
      join(targetDir, '.ai-board/config.yml'),
      `version: 1
project:
  name: fixture
  language: typescript
runtime:
  manager: bun
commands:
  install: bun install
  test_unit: echo tests
testCapabilities:
  framework: vitest
  primaryCommandKey: test_unit
  hasE2E: false
agent:
  cli: claude-code
`,
    );

    writeExecutable(
      join(helpersDir, 'run-tests-with-reports.sh'),
      `#!/bin/bash
set -euo pipefail
counter_file=/tmp/run-health-tests-counter
count=0
if [ -f "$counter_file" ]; then
  count=$(cat "$counter_file")
fi
count=$((count + 1))
printf '%s' "$count" > "$counter_file"

case "$count" in
  1)
    summary='{"totalPassed":8,"totalFailed":2,"totalTests":10,"hasErrors":true,"unit":{"passed":8,"failed":2,"total":10,"ran":true,"error":null},"integration":{"passed":0,"failed":0,"total":0,"ran":false,"error":null},"e2e":{"passed":0,"failed":0,"total":0,"ran":false,"error":null}}'
    ;;
  *)
    summary='{"totalPassed":9,"totalFailed":1,"totalTests":10,"hasErrors":true,"unit":{"passed":9,"failed":1,"total":10,"ran":true,"error":null},"integration":{"passed":0,"failed":0,"total":0,"ran":false,"error":null},"e2e":{"passed":0,"failed":0,"total":0,"ran":false,"error":null}}'
    ;;
esac
printf '%s' "$summary" > /tmp/test-report-summary.json
`,
    );

    writeExecutable(
      join(helpersDir, 'run-agent.sh'),
      `#!/bin/bash
cat > /tmp/health-tests-fix-result.json <<'JSON'
{"autoFixed":[{"id":"fix-1","severity":"medium","description":"Adjusted test fixture"}],"nonFixable":[{"id":"remaining-1","severity":"low","description":"Needs manual review"}]}
JSON
`,
    );

    const result = runHealthTests(['CLAUDE', targetDir], {
      AI_BOARD_RUN_TESTS_WITH_REPORTS: join(helpersDir, 'run-tests-with-reports.sh'),
      AI_BOARD_RUN_AGENT: join(helpersDir, 'run-agent.sh'),
      FIX_MODEL: 'stub-model',
    });

    expect(readFileSync('/tmp/run-health-tests-counter', 'utf-8')).toBe('4');
    expect(result.score).toBe(98);
    expect(result.issuesFound).toBe(2);
    expect(result.issuesFixed).toBe(1);
    expect(result.skipped).toBe(false);
  });
});
