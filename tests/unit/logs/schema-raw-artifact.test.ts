import { describe, it, expect } from 'vitest';
import { JobLogSubmissionSchema } from '@/app/lib/logs/schema';

describe('JobLogSubmissionSchema — raw artifact fields', () => {
  const base = {
    captureStatus: 'CAPTURED' as const,
    preview: 'ok',
    schemaVersion: 1 as const,
    eventCount: 5,
    errorCount: 0,
    artifactKey: 'logs/1/2/3.jsonl.gz',
    artifactSize: 1000,
  };

  it('accepts submission with both rawArtifactKey and rawArtifactSize', () => {
    const result = JobLogSubmissionSchema.safeParse({
      ...base,
      rawArtifactKey: 'logs/1/2/3-raw.jsonl.gz',
      rawArtifactSize: 2000,
    });
    expect(result.success).toBe(true);
  });

  it('accepts submission without raw artifact fields', () => {
    const result = JobLogSubmissionSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('rejects rawArtifactKey without rawArtifactSize', () => {
    const result = JobLogSubmissionSchema.safeParse({
      ...base,
      rawArtifactKey: 'logs/1/2/3-raw.jsonl.gz',
    });
    expect(result.success).toBe(false);
  });

  it('rejects rawArtifactSize without rawArtifactKey', () => {
    const result = JobLogSubmissionSchema.safeParse({
      ...base,
      rawArtifactSize: 2000,
    });
    expect(result.success).toBe(false);
  });
});
