import { describe, expect, it } from 'vitest';
import { getScanCommand, SCAN_COMMAND_MAP } from '@/lib/health/scan-commands';

describe('SCAN_COMMAND_MAP', () => {
  it('maps all 4 scan types to commands', () => {
    expect(SCAN_COMMAND_MAP).toEqual({
      SECURITY: 'health-security',
      COMPLIANCE: 'health-compliance',
      TESTS: 'health-tests',
      SPEC_SYNC: 'health-spec-sync',
    });
  });

  it('has exactly 4 entries', () => {
    expect(Object.keys(SCAN_COMMAND_MAP)).toHaveLength(4);
  });
});

describe('getScanCommand', () => {
  it('returns health-security for SECURITY', () => {
    expect(getScanCommand('SECURITY')).toBe('health-security');
  });

  it('returns health-compliance for COMPLIANCE', () => {
    expect(getScanCommand('COMPLIANCE')).toBe('health-compliance');
  });

  it('returns health-tests for TESTS', () => {
    expect(getScanCommand('TESTS')).toBe('health-tests');
  });

  it('returns health-spec-sync for SPEC_SYNC', () => {
    expect(getScanCommand('SPEC_SYNC')).toBe('health-spec-sync');
  });

  it('throws for unknown scan type', () => {
    expect(() => getScanCommand('UNKNOWN' as never)).toThrow('Unknown scan type: UNKNOWN');
  });
});
