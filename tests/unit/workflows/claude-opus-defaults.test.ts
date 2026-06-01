import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const OPUS_48 = 'claude-opus-4-8';
const OLD_OPUS_DEFAULT = 'claude-opus-4-7';

const runtimeDefaultFiles = [
  '.github/workflows/ai-board-assist.yml',
  '.github/workflows/health-scan.yml',
  '.github/workflows/inbox-analysis.yml',
  '.github/workflows/iterate.yml',
  '.github/workflows/onboard.yml',
  '.github/workflows/quick-impl.yml',
  '.github/workflows/retro-spec.yml',
  '.github/workflows/speckit.yml',
  '.github/workflows/verify.yml',
  '.ai-board/config.yml',
] as const;

describe('Claude workflow defaults', () => {
  it.each(runtimeDefaultFiles)('%s uses Claude Opus 4.8 instead of the previous Opus default', (path) => {
    const content = readFileSync(resolve(process.cwd(), path), 'utf8');

    expect(content).toContain(OPUS_48);
    expect(content).not.toContain(OLD_OPUS_DEFAULT);
  });
});
