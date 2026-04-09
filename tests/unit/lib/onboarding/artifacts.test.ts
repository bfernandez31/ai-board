import { describe, expect, it } from 'vitest';
import { assembleOnboardingArtifacts } from '@/lib/onboarding/artifacts';

describe('assembleOnboardingArtifacts', () => {
  it('preserves protected files that already exist', () => {
    const result = assembleOnboardingArtifacts({
      existingPaths: ['CLAUDE.md'],
      deterministicArtifacts: [
        { path: '.ai-board/config.yml', kind: 'config', content: 'version: 1\n' },
      ],
      guidanceArtifacts: [
        { path: 'CLAUDE.md', kind: 'guidance', content: '# Generated guidance\n' },
      ],
    });

    expect(result.summary.created).toEqual([{ path: '.ai-board/config.yml', kind: 'config' }]);
    expect(result.summary.preserved).toEqual([
      { path: 'CLAUDE.md', kind: 'guidance', reason: 'existing file preserved' },
    ]);
  });

  it('marks missing guidance artifacts during a partial run', () => {
    const result = assembleOnboardingArtifacts({
      existingPaths: [],
      deterministicArtifacts: [
        { path: '.ai-board/config.yml', kind: 'config', content: 'version: 1\n' },
      ],
      guidanceArtifacts: [],
      partialReason: 'Guidance generation failed after deterministic outputs succeeded',
    });

    expect(result.summary.missing).toEqual([
      { path: 'CLAUDE.md', kind: 'guidance', reason: 'Guidance generation failed after deterministic outputs succeeded' },
      { path: 'AGENTS.md', kind: 'agent-entry', reason: 'Guidance generation failed after deterministic outputs succeeded' },
      { path: '.ai-board/memory/constitution.md', kind: 'constitution', reason: 'Guidance generation failed after deterministic outputs succeeded' },
    ]);
  });
});
