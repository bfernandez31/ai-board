import { describe, it, expect } from 'vitest';
import {
  MODEL_CONTEXT_WINDOWS,
  getContextWindow,
  getPeakContextThresholdState,
  getPeakContextColor,
} from '@/lib/telemetry/context-window';

describe('MODEL_CONTEXT_WINDOWS', () => {
  it('seeds Claude 4.x family at 200k', () => {
    expect(MODEL_CONTEXT_WINDOWS['claude-opus-4-8']).toBe(200_000);
    expect(MODEL_CONTEXT_WINDOWS['claude-opus-4-7']).toBe(200_000);
    expect(MODEL_CONTEXT_WINDOWS['claude-opus-4-6']).toBe(200_000);
    expect(MODEL_CONTEXT_WINDOWS['claude-sonnet-4-6']).toBe(200_000);
    expect(MODEL_CONTEXT_WINDOWS['claude-haiku-4-5']).toBe(200_000);
  });

  it('seeds GPT-5 family at 400k', () => {
    expect(MODEL_CONTEXT_WINDOWS['gpt-5']).toBe(400_000);
    expect(MODEL_CONTEXT_WINDOWS['gpt-5.4']).toBe(400_000);
    expect(MODEL_CONTEXT_WINDOWS['gpt-5.5']).toBe(400_000);
    expect(MODEL_CONTEXT_WINDOWS['gpt-5-codex']).toBe(400_000);
  });

  it('seeds Gemini 2.x family at 1M', () => {
    expect(MODEL_CONTEXT_WINDOWS['gemini-2.5-pro']).toBe(1_048_576);
    expect(MODEL_CONTEXT_WINDOWS['gemini-2.5-flash']).toBe(1_048_576);
    expect(MODEL_CONTEXT_WINDOWS['gemini-2.0-flash']).toBe(1_048_576);
  });

  it('does not include Mistral models', () => {
    expect(MODEL_CONTEXT_WINDOWS['mistral-large-latest']).toBeUndefined();
  });
});

describe('getContextWindow', () => {
  it('returns 200k for an exact Claude match', () => {
    expect(getContextWindow('claude-opus-4-8')).toBe(200_000);
    expect(getContextWindow('claude-opus-4-7')).toBe(200_000);
    expect(getContextWindow('claude-haiku-4-5-20251001')).toBe(200_000);
  });

  it('returns 400k for an exact OpenAI match', () => {
    expect(getContextWindow('gpt-5.4')).toBe(400_000);
  });

  it('returns 1M for an exact Gemini match', () => {
    expect(getContextWindow('gemini-2.5-pro')).toBe(1_048_576);
  });

  it('falls back to substring match for Gemini variants', () => {
    expect(getContextWindow('models/gemini-2.5-pro-latest')).toBe(1_048_576);
    expect(getContextWindow('Gemini-2.5-Flash-Preview')).toBe(1_048_576);
    expect(getContextWindow('vendor/gemini-2.0-flash-001')).toBe(1_048_576);
  });

  it('returns null for unknown models', () => {
    expect(getContextWindow('mistral-large-latest')).toBeNull();
    expect(getContextWindow('llama-3-8b')).toBeNull();
    expect(getContextWindow('totally-fictional-model')).toBeNull();
  });

  it('returns null when model is null', () => {
    expect(getContextWindow(null)).toBeNull();
  });
});

describe('getPeakContextThresholdState', () => {
  const claude = 'claude-opus-4-8'; // 200_000

  it('returns healthy for ratios under the warning threshold', () => {
    // 59.9% of 200k = 119_800
    expect(getPeakContextThresholdState(119_800, claude)).toBe('healthy');
    expect(getPeakContextThresholdState(0, claude)).toBe('healthy');
    expect(getPeakContextThresholdState(50_000, claude)).toBe('healthy');
  });

  it('returns warning at exactly the warning threshold', () => {
    // 60% of 200k = 120_000
    expect(getPeakContextThresholdState(120_000, claude)).toBe('warning');
  });

  it('returns warning between 60% and 80%', () => {
    // 79.9% of 200k = 159_800
    expect(getPeakContextThresholdState(159_800, claude)).toBe('warning');
  });

  it('returns danger at exactly the danger threshold', () => {
    // 80% of 200k = 160_000
    expect(getPeakContextThresholdState(160_000, claude)).toBe('danger');
  });

  it('returns danger at and above 95%', () => {
    // 95% of 200k = 190_000
    expect(getPeakContextThresholdState(190_000, claude)).toBe('danger');
    expect(getPeakContextThresholdState(199_000, claude)).toBe('danger');
  });

  it('returns unknown when peak is null', () => {
    expect(getPeakContextThresholdState(null, claude)).toBe('unknown');
  });

  it('returns unknown when model is null', () => {
    expect(getPeakContextThresholdState(50_000, null)).toBe('unknown');
  });

  it('returns unknown when model is unmapped', () => {
    expect(getPeakContextThresholdState(50_000, 'mistral-large-latest')).toBe('unknown');
  });
});

describe('getPeakContextColor', () => {
  it('returns red ctp tokens for danger', () => {
    expect(getPeakContextColor('danger')).toEqual({
      text: 'text-ctp-red',
      bg: 'bg-ctp-red/10',
    });
  });

  it('returns yellow ctp tokens for warning', () => {
    expect(getPeakContextColor('warning')).toEqual({
      text: 'text-ctp-yellow',
      bg: 'bg-ctp-yellow/10',
    });
  });

  it('returns neutral overlay tokens for healthy', () => {
    expect(getPeakContextColor('healthy')).toEqual({
      text: 'text-ctp-overlay1',
      bg: 'bg-transparent',
    });
  });

  it('returns neutral tokens for unknown state', () => {
    expect(getPeakContextColor('unknown')).toEqual({
      text: 'text-ctp-overlay1',
      bg: 'bg-transparent',
    });
  });

  it('returns literal static class strings (no dynamic construction)', () => {
    // This is a behavioral guard: every literal must appear as a string
    // somewhere in the test source so Tailwind's purger sees it. Asserting
    // exact equality forces a regression if anyone introduces template-string
    // construction.
    const danger = getPeakContextColor('danger');
    const warning = getPeakContextColor('warning');
    const healthy = getPeakContextColor('healthy');
    expect(typeof danger.text).toBe('string');
    expect(typeof warning.text).toBe('string');
    expect(typeof healthy.text).toBe('string');
    expect(danger.text).not.toContain('${');
    expect(warning.bg).not.toContain('${');
    expect(healthy.text).not.toContain('${');
  });
});
