import { describe, expect, it } from 'vitest';
import { JobLogSubmissionSchema } from '@/app/lib/logs/schema';

const validBase = {
  captureStatus: 'CAPTURED' as const,
  preview: 'ok',
  schemaVersion: 1 as const,
  eventCount: 1,
  errorCount: 0,
  artifactKey: 'logs/1/2/3.jsonl.gz',
  artifactSize: 100,
};

describe('JobLogSubmissionSchema raw artifact fields (AIB-776)', () => {
  it('accepts a submission with both raw fields when CAPTURED', () => {
    const result = JobLogSubmissionSchema.safeParse({
      ...validBase,
      rawArtifactKey: 'logs/1/2/3.native.jsonl.gz',
      rawArtifactSize: 250,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a submission with no raw fields (non-Claude or capture skipped)', () => {
    const result = JobLogSubmissionSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('rejects a submission with rawArtifactKey but no rawArtifactSize', () => {
    const result = JobLogSubmissionSchema.safeParse({
      ...validBase,
      rawArtifactKey: 'logs/1/2/3.native.jsonl.gz',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a submission with rawArtifactSize but no rawArtifactKey', () => {
    const result = JobLogSubmissionSchema.safeParse({
      ...validBase,
      rawArtifactSize: 250,
    });
    expect(result.success).toBe(false);
  });

  it('allows raw fields to accompany an UNAVAILABLE normalized capture', () => {
    // Native capture should be independent of normalized status — even if the
    // normalized side is UNAVAILABLE, raw might still have been uploaded.
    // Conversely, the runner today always omits raw when normalized fails, but
    // the schema should not artificially couple them.
    const result = JobLogSubmissionSchema.safeParse({
      captureStatus: 'UNAVAILABLE',
      preview: 'Logs unavailable — capture failed.',
      schemaVersion: 1,
      eventCount: 0,
      errorCount: 0,
      rawArtifactKey: 'logs/1/2/3.native.jsonl.gz',
      rawArtifactSize: 250,
    });
    expect(result.success).toBe(true);
  });
});
