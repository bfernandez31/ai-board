import { describe, expect, it } from 'vitest';
import { groupIssuesIntoTickets } from '@/lib/health/ticket-creation';
import type {
  SecurityReport,
  ComplianceReport,
  TestsReport,
  SpecSyncReport,
} from '@/lib/health/types';

describe('groupIssuesIntoTickets', () => {
  // --- SECURITY: Group by severity ---

  describe('SECURITY scan type', () => {
    it('groups issues by severity level', () => {
      const report: SecurityReport = {
        type: 'SECURITY',
        issues: [
          { id: '1', severity: 'high', description: 'SQL injection', file: 'api/route.ts', line: 10 },
          { id: '2', severity: 'high', description: 'XSS vulnerability', file: 'components/form.tsx', line: 25 },
          { id: '3', severity: 'medium', description: 'Missing CSRF token', file: 'lib/auth.ts' },
        ],
        generatedTickets: [],
      };

      const tickets = groupIssuesIntoTickets('SECURITY', report);
      expect(tickets).toHaveLength(2);

      const highTicket = tickets.find((t) => t.title.includes('HIGH'));
      expect(highTicket).toBeDefined();
      expect(highTicket!.title).toContain('2 HIGH severity issues');
      expect(highTicket!.description).toContain('api/route.ts:10');
      expect(highTicket!.description).toContain('components/form.tsx:25');

      const mediumTicket = tickets.find((t) => t.title.includes('MEDIUM'));
      expect(mediumTicket).toBeDefined();
      expect(mediumTicket!.title).toContain('1 MEDIUM severity issue');
    });

    it('returns empty array for zero issues', () => {
      const report: SecurityReport = {
        type: 'SECURITY',
        issues: [],
        generatedTickets: [],
      };
      expect(groupIssuesIntoTickets('SECURITY', report)).toEqual([]);
    });

    it('sets stage to INBOX and workflowType to QUICK', () => {
      const report: SecurityReport = {
        type: 'SECURITY',
        issues: [{ id: '1', severity: 'low', description: 'Minor issue' }],
        generatedTickets: [],
      };
      const tickets = groupIssuesIntoTickets('SECURITY', report);
      expect(tickets[0].stage).toBe('INBOX');
      expect(tickets[0].workflowType).toBe('QUICK');
    });

    it('includes exploitScenario and recommendation in ticket description when present', () => {
      const report: SecurityReport = {
        type: 'SECURITY',
        issues: [
          {
            id: '1',
            severity: 'high',
            description: 'SQL injection via $queryRaw',
            file: 'lib/db.ts',
            line: 42,
            confidence: 9,
            exploitScenario: 'Attacker sends crafted input to execute arbitrary SQL',
            recommendation: 'Use Prisma.sql tagged template instead',
          },
        ],
        generatedTickets: [],
      };
      const tickets = groupIssuesIntoTickets('SECURITY', report);
      expect(tickets).toHaveLength(1);
      expect(tickets[0].description).toContain('**Exploit:**');
      expect(tickets[0].description).toContain('Attacker sends crafted input');
      expect(tickets[0].description).toContain('**Fix:**');
      expect(tickets[0].description).toContain('Prisma.sql tagged template');
    });

    it('omits exploitScenario and recommendation lines when fields are absent', () => {
      const report: SecurityReport = {
        type: 'SECURITY',
        issues: [
          { id: '1', severity: 'medium', description: 'Missing auth check', file: 'app/api/route.ts', line: 10 },
        ],
        generatedTickets: [],
      };
      const tickets = groupIssuesIntoTickets('SECURITY', report);
      expect(tickets[0].description).not.toContain('**Exploit:**');
      expect(tickets[0].description).not.toContain('**Fix:**');
    });
  });

  // --- COMPLIANCE: Group by principle (category) ---

  describe('COMPLIANCE scan type', () => {
    it('groups violations by constitution principle', () => {
      const report: ComplianceReport = {
        type: 'COMPLIANCE',
        issues: [
          { id: '1', severity: 'high', description: 'Missing type annotations', file: 'lib/utils.ts', category: 'TypeScript-First' },
          { id: '2', severity: 'medium', description: 'Any type used', file: 'lib/api.ts', category: 'TypeScript-First' },
          { id: '3', severity: 'high', description: 'No unit test', file: 'lib/calc.ts', category: 'Test-Driven' },
        ],
        generatedTickets: [],
      };

      const tickets = groupIssuesIntoTickets('COMPLIANCE', report);
      expect(tickets).toHaveLength(2);

      const tsTicket = tickets.find((t) => t.title.includes('TypeScript-First'));
      expect(tsTicket).toBeDefined();
      expect(tsTicket!.title).toContain('2 violations');

      const testTicket = tickets.find((t) => t.title.includes('Test-Driven'));
      expect(testTicket).toBeDefined();
      expect(testTicket!.title).toContain('1 violation');
    });

    it('uses "General" for issues without category', () => {
      const report: ComplianceReport = {
        type: 'COMPLIANCE',
        issues: [{ id: '1', severity: 'low', description: 'Uncategorized issue' }],
        generatedTickets: [],
      };
      const tickets = groupIssuesIntoTickets('COMPLIANCE', report);
      expect(tickets[0].title).toContain('General');
    });

    it('returns empty array for zero violations', () => {
      const report: ComplianceReport = {
        type: 'COMPLIANCE',
        issues: [],
        generatedTickets: [],
      };
      expect(groupIssuesIntoTickets('COMPLIANCE', report)).toEqual([]);
    });
  });

  // --- TESTS: One ticket per unfixable test ---

  describe('TESTS scan type', () => {
    it('creates one ticket per non-fixable test failure', () => {
      const report: TestsReport = {
        type: 'TESTS',
        autoFixed: [{ id: 'af1', severity: 'low', description: 'Auto-fixed test' }],
        nonFixable: [
          { id: 'nf1', severity: 'high', description: 'Broken assertion in user service', file: 'tests/user.test.ts' },
          { id: 'nf2', severity: 'high', description: 'Timeout in API integration', file: 'tests/api.test.ts' },
        ],
        generatedTickets: [],
      };

      const tickets = groupIssuesIntoTickets('TESTS', report);
      expect(tickets).toHaveLength(2);
      expect(tickets[0].title).toContain('Broken assertion in user service');
      expect(tickets[0].description).toContain('tests/user.test.ts');
      expect(tickets[1].title).toContain('Timeout in API integration');
    });

    it('ignores auto-fixed tests (no tickets)', () => {
      const report: TestsReport = {
        type: 'TESTS',
        autoFixed: [{ id: 'af1', severity: 'low', description: 'Fixed test' }],
        nonFixable: [],
        generatedTickets: [],
      };
      expect(groupIssuesIntoTickets('TESTS', report)).toEqual([]);
    });
  });

  // --- SPEC_SYNC: One ticket per drifted spec ---

  describe('SPEC_SYNC scan type', () => {
    it('creates one ticket per desynchronized spec', () => {
      const report: SpecSyncReport = {
        type: 'SPEC_SYNC',
        specs: [
          { specPath: 'specs/AIB-100/spec.md', status: 'drifted', drift: 'API endpoint removed' },
          { specPath: 'specs/AIB-200/spec.md', status: 'synced' },
          { specPath: 'specs/AIB-300/spec.md', status: 'drifted', drift: 'New fields not in spec' },
        ],
        generatedTickets: [],
      };

      const tickets = groupIssuesIntoTickets('SPEC_SYNC', report);
      expect(tickets).toHaveLength(2);
      expect(tickets[0].title).toContain('specs/AIB-100/spec.md');
      expect(tickets[0].description).toContain('API endpoint removed');
      expect(tickets[1].title).toContain('specs/AIB-300/spec.md');
    });

    it('returns empty array when all specs are synced', () => {
      const report: SpecSyncReport = {
        type: 'SPEC_SYNC',
        specs: [
          { specPath: 'specs/AIB-100/spec.md', status: 'synced' },
        ],
        generatedTickets: [],
      };
      expect(groupIssuesIntoTickets('SPEC_SYNC', report)).toEqual([]);
    });
  });

  // --- Zero issues case (all scan types) ---

  describe('zero issues', () => {
    it('returns empty array for each scan type with no issues', () => {
      expect(groupIssuesIntoTickets('SECURITY', { type: 'SECURITY', issues: [], generatedTickets: [] })).toEqual([]);
      expect(groupIssuesIntoTickets('COMPLIANCE', { type: 'COMPLIANCE', issues: [], generatedTickets: [] })).toEqual([]);
      expect(groupIssuesIntoTickets('TESTS', { type: 'TESTS', autoFixed: [], nonFixable: [], generatedTickets: [] })).toEqual([]);
      expect(groupIssuesIntoTickets('SPEC_SYNC', { type: 'SPEC_SYNC', specs: [], generatedTickets: [] })).toEqual([]);
    });
  });
});
