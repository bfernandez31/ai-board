import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { CLAUDE_GLOBAL_FALLBACK_MODEL } from '@/lib/models/claude-models';

const OLD_OPUS_DEFAULT = 'claude-opus-4-7';

const RUNTIME_DEFAULT_FILES = [
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
  it.each(RUNTIME_DEFAULT_FILES)(
    '%s uses the configured global Claude fallback instead of the previous Opus default',
    (path) => {
      const content = readFileSync(resolve(process.cwd(), path), 'utf-8');

      expect(content).toContain(CLAUDE_GLOBAL_FALLBACK_MODEL);
      expect(content).not.toContain(OLD_OPUS_DEFAULT);
    }
  );
});
