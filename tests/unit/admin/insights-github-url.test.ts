import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildInsightsRunUrl } from '@/lib/admin/insights-github-url';

describe('buildInsightsRunUrl (AIB-798 US3)', () => {
  beforeEach(() => {
    vi.stubEnv('GITHUB_OWNER', '');
    vi.stubEnv('GITHUB_REPO', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when workflowRunId is null', () => {
    expect(buildInsightsRunUrl(null, 'me', 'r')).toBeNull();
  });

  it('returns null when workflowRunId is an empty string', () => {
    expect(buildInsightsRunUrl('', 'me', 'r')).toBeNull();
  });

  it('returns null when workflowRunId is non-numeric', () => {
    expect(buildInsightsRunUrl('abc', 'me', 'r')).toBeNull();
  });

  it('composes the GH Actions URL when owner+repo+workflowRunId all resolve', () => {
    expect(buildInsightsRunUrl('12345', 'me', 'r')).toBe(
      'https://github.com/me/r/actions/runs/12345'
    );
  });

  it('returns null when env vars are unset and owner/repo are not provided', () => {
    expect(buildInsightsRunUrl('12345')).toBeNull();
  });

  it('composes the URL from env vars when arguments are not provided', () => {
    vi.stubEnv('GITHUB_OWNER', 'envowner');
    vi.stubEnv('GITHUB_REPO', 'envrepo');
    expect(buildInsightsRunUrl('98765')).toBe(
      'https://github.com/envowner/envrepo/actions/runs/98765'
    );
  });
});
