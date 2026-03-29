import { describe, expect, it } from 'vitest';
import { parseScanReport } from '@/lib/health/report-schemas';

describe('parseScanReport', () => {
  describe('SECURITY', () => {
    it('parses valid security report', () => {
      const report = parseScanReport('SECURITY', JSON.stringify({
        type: 'SECURITY',
        issues: [
          { id: 'sec-001', severity: 'high', description: 'SQL injection', file: 'api/route.ts', line: 42 },
          { id: 'sec-002', severity: 'low', description: 'Missing header' },
        ],
        generatedTickets: [{ ticketKey: 'AIB-123', stage: 'INBOX' }],
      }));

      expect(report).not.toBeNull();
      expect(report!.type).toBe('SECURITY');
      if (report!.type === 'SECURITY') {
        expect(report!.issues).toHaveLength(2);
        expect(report!.issues[0].severity).toBe('high');
        expect(report!.generatedTickets).toHaveLength(1);
      }
    });

    it('injects type from scanType when missing', () => {
      const report = parseScanReport('SECURITY', JSON.stringify({
        issues: [{ id: 'sec-001', severity: 'high', description: 'test' }],
        generatedTickets: [],
      }));

      expect(report).not.toBeNull();
      expect(report!.type).toBe('SECURITY');
    });

    it('returns null for type mismatch', () => {
      const report = parseScanReport('SECURITY', JSON.stringify({
        type: 'COMPLIANCE',
        issues: [],
        generatedTickets: [],
      }));

      expect(report).toBeNull();
    });
  });

  describe('COMPLIANCE', () => {
    it('parses valid compliance report with categories', () => {
      const report = parseScanReport('COMPLIANCE', JSON.stringify({
        type: 'COMPLIANCE',
        issues: [
          { id: 'comp-001', severity: 'medium', description: 'No strict mode', category: 'TypeScript-First' },
        ],
        generatedTickets: [],
      }));

      expect(report).not.toBeNull();
      expect(report!.type).toBe('COMPLIANCE');
      if (report!.type === 'COMPLIANCE') {
        expect(report!.issues[0].category).toBe('TypeScript-First');
      }
    });
  });

  describe('TESTS', () => {
    it('parses valid tests report with autoFixed and nonFixable', () => {
      const report = parseScanReport('TESTS', JSON.stringify({
        type: 'TESTS',
        autoFixed: [{ id: 'test-001', severity: 'low', description: 'Fixed assertion' }],
        nonFixable: [{ id: 'test-002', severity: 'high', description: 'Missing dependency' }],
        generatedTickets: [],
      }));

      expect(report).not.toBeNull();
      expect(report!.type).toBe('TESTS');
      if (report!.type === 'TESTS') {
        expect(report!.autoFixed).toHaveLength(1);
        expect(report!.nonFixable).toHaveLength(1);
      }
    });
  });

  describe('SPEC_SYNC', () => {
    it('parses valid spec sync report', () => {
      const report = parseScanReport('SPEC_SYNC', JSON.stringify({
        type: 'SPEC_SYNC',
        specs: [
          { specPath: 'specs/AIB-370/spec.md', status: 'synced' },
          { specPath: 'specs/AIB-371/spec.md', status: 'drifted', drift: 'Missing FR-005' },
        ],
        generatedTickets: [],
      }));

      expect(report).not.toBeNull();
      expect(report!.type).toBe('SPEC_SYNC');
      if (report!.type === 'SPEC_SYNC') {
        expect(report!.specs).toHaveLength(2);
        expect(report!.specs[1].drift).toBe('Missing FR-005');
      }
    });
  });

  describe('QUALITY_GATE', () => {
    it('parses valid quality gate report', () => {
      const report = parseScanReport('QUALITY_GATE', JSON.stringify({
        type: 'QUALITY_GATE',
        dimensions: [
          { name: 'Compliance', score: 92 },
          { name: 'Bug Detection', score: null },
        ],
        recentTickets: [{ ticketKey: 'AIB-350', score: 87 }],
      }));

      expect(report).not.toBeNull();
      expect(report!.type).toBe('QUALITY_GATE');
      if (report!.type === 'QUALITY_GATE') {
        expect(report!.dimensions).toHaveLength(2);
        expect(report!.dimensions[1].score).toBeNull();
        expect(report!.recentTickets).toHaveLength(1);
      }
    });
  });

  describe('LAST_CLEAN', () => {
    it('parses valid last clean report', () => {
      const report = parseScanReport('LAST_CLEAN', JSON.stringify({
        type: 'LAST_CLEAN',
        filesCleaned: 12,
        remainingIssues: 3,
        summary: 'Removed unused imports across 12 files.',
      }));

      expect(report).not.toBeNull();
      expect(report!.type).toBe('LAST_CLEAN');
      if (report!.type === 'LAST_CLEAN') {
        expect(report!.filesCleaned).toBe(12);
        expect(report!.remainingIssues).toBe(3);
      }
    });
  });

  describe('error handling', () => {
    it('returns null for null input', () => {
      expect(parseScanReport('SECURITY', null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(parseScanReport('SECURITY', undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseScanReport('SECURITY', '')).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      expect(parseScanReport('SECURITY', 'not json')).toBeNull();
    });

    it('returns null for malformed report (missing required fields)', () => {
      expect(parseScanReport('SECURITY', JSON.stringify({ type: 'SECURITY' }))).toBeNull();
    });

    it('returns null for invalid severity value', () => {
      const report = parseScanReport('SECURITY', JSON.stringify({
        type: 'SECURITY',
        issues: [{ id: '1', severity: 'critical', description: 'test' }],
        generatedTickets: [],
      }));
      expect(report).toBeNull();
    });
  });
});
