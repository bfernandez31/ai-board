import { describe, expect, it } from 'vitest';
import {
  buildJobLogArtifactKey,
  buildJobLogRawArtifactKey,
  buildJobLogRawNativeUrl,
  buildJobLogRawUrl,
} from '@/app/lib/logs/artifact-key';

describe('artifact-key builders', () => {
  it('produces deterministic normalized + raw keys with distinct suffixes', () => {
    const normalized = buildJobLogArtifactKey(7, 42, 999);
    const raw = buildJobLogRawArtifactKey(7, 42, 999);
    expect(normalized).toBe('logs/7/42/999.jsonl.gz');
    expect(raw).toBe('logs/7/42/999.native.jsonl.gz');
    expect(raw).not.toBe(normalized);
  });

  it('keeps raw and normalized keys under the same project/ticket prefix so prune can find both', () => {
    const normalized = buildJobLogArtifactKey(1, 2, 3);
    const raw = buildJobLogRawArtifactKey(1, 2, 3);
    const prefix = 'logs/1/2/';
    expect(normalized.startsWith(prefix)).toBe(true);
    expect(raw.startsWith(prefix)).toBe(true);
  });

  it('builds distinct normalized and native raw URLs', () => {
    expect(buildJobLogRawUrl(1, 2, 3)).toBe('/api/projects/1/tickets/2/jobs/3/logs/raw');
    expect(buildJobLogRawNativeUrl(1, 2, 3)).toBe(
      '/api/projects/1/tickets/2/jobs/3/logs/raw-native'
    );
  });
});
