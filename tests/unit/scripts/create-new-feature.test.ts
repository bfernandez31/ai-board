import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SCRIPT_SOURCE = join(
  __dirname,
  '../../../.claude-plugin/scripts/bash/create-new-feature.sh'
);

const tempDirs: string[] = [];

function createIsolatedRepo(): { repoRoot: string; scriptPath: string } {
  const repoRoot = mkdtempSync(join(tmpdir(), 'ai-board-create-feature-'));
  tempDirs.push(repoRoot);

  mkdirSync(join(repoRoot, '.specify'), { recursive: true });

  const scriptDir = join(repoRoot, '.claude-plugin/scripts/bash');
  mkdirSync(scriptDir, { recursive: true });

  const scriptPath = join(scriptDir, 'create-new-feature.sh');
  copyFileSync(SCRIPT_SOURCE, scriptPath);

  return { repoRoot, scriptPath };
}

describe('create-new-feature.sh', () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('preserves the exact quick-impl ticket description in spec.md', () => {
    const { repoRoot, scriptPath } = createIsolatedRepo();
    const title = 'Activity Heatmap on Projects Page';
    const description = [
      'Add a GitHub-style contribution heatmap on the projects page, below the project cards grid.',
      'The heatmap displays AI activity across all user projects over the past year.',
      'Heatmap Grid',
      '- 7 rows (days of week), column count matches the selected period',
      '- Month labels on top, day-of-week labels on left',
      '- Cell intensity based on job count for that day',
      '',
      'Acceptance Criteria',
      '- Filters are URL-shareable and survive refresh',
      '- No new database models — uses existing job and ticket data',
    ].join('\n');

    const descriptionPath = join(repoRoot, 'ticket-description.txt');
    writeFileSync(descriptionPath, description);

    execFileSync(
      'bash',
      [
        scriptPath,
        '--json',
        '--mode=quick-impl',
        '--ticket-key=AIB-999',
        `--title=${title}`,
        `--description-file=${descriptionPath}`,
        title,
      ],
      {
        cwd: repoRoot,
        encoding: 'utf-8',
      }
    );

    const specPath = join(repoRoot, 'specs/AIB-999-activity-heatmap-on/spec.md');
    const specContent = readFileSync(specPath, 'utf-8');

    expect(specContent).toContain(`# Quick Implementation: ${title}`);
    expect(specContent).toContain(`## Description\n\n${description}\n\n## Implementation Notes`);
  });
});
