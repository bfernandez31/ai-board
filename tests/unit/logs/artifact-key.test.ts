import { describe, it, expect } from 'vitest';
import {
  buildJobLogArtifactKey,
  buildJobLogRawArtifactKey,
  buildJobLogRawUrl,
  buildJobLogNativeRawUrl,
} from '@/app/lib/logs/artifact-key';

describe('buildJobLogArtifactKey', () => {
  it('returns the normalized artifact key', () => {
    expect(buildJobLogArtifactKey(1, 2, 3)).toBe('logs/1/2/3.jsonl.gz');
  });
});

describe('buildJobLogRawArtifactKey', () => {
  it('returns the raw native artifact key with -raw suffix', () => {
    expect(buildJobLogRawArtifactKey(1, 2, 3)).toBe('logs/1/2/3-raw.jsonl.gz');
  });

  it('produces a key distinct from the normalized key', () => {
    expect(buildJobLogRawArtifactKey(5, 10, 20)).not.toBe(buildJobLogArtifactKey(5, 10, 20));
  });
});

describe('buildJobLogRawUrl', () => {
  it('returns the normalized raw stream URL', () => {
    expect(buildJobLogRawUrl(1, 2, 3)).toBe('/api/projects/1/tickets/2/jobs/3/logs/raw');
  });
});

describe('buildJobLogNativeRawUrl', () => {
  it('returns the native raw stream URL with ?type=native', () => {
    expect(buildJobLogNativeRawUrl(1, 2, 3)).toBe(
      '/api/projects/1/tickets/2/jobs/3/logs/raw?type=native'
    );
  });
});
