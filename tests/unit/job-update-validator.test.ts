/**
 * Unit tests for job-status update validator.
 *
 * AIB-779: pluginVersion and agentCliVersion are accepted on RUNNING patches
 * but remain optional so jobs predating the feature stay valid.
 */

import { strict as assert } from 'node:assert';
import { describe, expect, it } from 'vitest';
import { jobStatusUpdateSchema } from '@/app/lib/job-update-validator';

describe('jobStatusUpdateSchema', () => {
  it('accepts a RUNNING patch with pluginVersion and agentCliVersion', () => {
    const result = jobStatusUpdateSchema.safeParse({
      status: 'RUNNING',
      workflowRunId: 123,
      pluginVersion: '1.0.1',
      agentCliVersion: 'claude 1.2.3',
    });
    expect(result.success).toBe(true);
    assert(result.success);
    expect(result.data.pluginVersion).toBe('1.0.1');
    expect(result.data.agentCliVersion).toBe('claude 1.2.3');
  });

  it('treats both version fields as optional', () => {
    const result = jobStatusUpdateSchema.safeParse({ status: 'RUNNING' });
    expect(result.success).toBe(true);
    assert(result.success);
    expect(result.data.pluginVersion).toBeUndefined();
    expect(result.data.agentCliVersion).toBeUndefined();
  });

  it('rejects empty version strings (capture failure should be encoded as omission, not empty)', () => {
    const result = jobStatusUpdateSchema.safeParse({
      status: 'RUNNING',
      pluginVersion: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects pluginVersion longer than 50 chars', () => {
    const result = jobStatusUpdateSchema.safeParse({
      status: 'RUNNING',
      pluginVersion: 'x'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it('rejects agentCliVersion longer than 100 chars', () => {
    const result = jobStatusUpdateSchema.safeParse({
      status: 'RUNNING',
      agentCliVersion: 'x'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('trims surrounding whitespace from version strings', () => {
    const result = jobStatusUpdateSchema.safeParse({
      status: 'RUNNING',
      pluginVersion: '  1.0.1  ',
      agentCliVersion: '\tcodex 0.4.0\n',
    });
    expect(result.success).toBe(true);
    assert(result.success);
    expect(result.data.pluginVersion).toBe('1.0.1');
    expect(result.data.agentCliVersion).toBe('codex 0.4.0');
  });

  it.each(['ACTIVE', 'INACTIVE', 'FALLBACK', 'NOT_APPLICABLE', 'NOT_RECORDED'])(
    'accepts tokenSavingStatus %s',
    (tokenSavingStatus) => {
      const result = jobStatusUpdateSchema.safeParse({
        status: 'RUNNING',
        tokenSavingStatus,
      });

      expect(result.success).toBe(true);
    }
  );

  it('accepts a 1000-character fallback reason', () => {
    const result = jobStatusUpdateSchema.safeParse({
      status: 'RUNNING',
      tokenSavingStatus: 'FALLBACK',
      tokenSavingFallbackReason: 'x'.repeat(1000),
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid tokenSavingStatus values', () => {
    const result = jobStatusUpdateSchema.safeParse({
      status: 'RUNNING',
      tokenSavingStatus: 'BROKEN',
    });

    expect(result.success).toBe(false);
  });

  it('rejects fallback reasons longer than 1000 characters', () => {
    const result = jobStatusUpdateSchema.safeParse({
      status: 'RUNNING',
      tokenSavingStatus: 'FALLBACK',
      tokenSavingFallbackReason: 'x'.repeat(1001),
    });

    expect(result.success).toBe(false);
  });
});
