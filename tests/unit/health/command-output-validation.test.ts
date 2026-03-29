import { describe, it, expect } from 'vitest';
import { parseScanReport, scanReportSchema } from '@/lib/health/report-schemas';
import { groupIssuesIntoTickets } from '@/lib/health/ticket-creation';
import type {
  SecurityReport,
  ComplianceReport,
  TestsReport,
  SpecSyncReport,
  ReportIssue,
} from '@/lib/health/types';

// --- Helpers ---

function makeIssue(overrides: Partial<ReportIssue> & { id: string; severity: 'high' | 'medium' | 'low'; description: string }): ReportIssue {
  return { ...overrides };
}

// --- US1: Security Report Validation ---

describe('SecurityReport schema validation', () => {
  it('valid SecurityReport with lowercase severity, id, type SECURITY, and generatedTickets passes', () => {
    const report: SecurityReport = {
      type: 'SECURITY',
      issues: [
        makeIssue({
          id: 'sec-001',
          severity: 'high',
          description: 'SQL injection in raw query',
          file: 'lib/db/queries.ts',
          line: 42,
          category: 'injection',
        }),
        makeIssue({
          id: 'sec-002',
          severity: 'medium',
          description: 'Missing CSRF token validation',
          file: 'app/api/submit/route.ts',
          line: 10,
          category: 'authentication',
        }),
      ],
      generatedTickets: [],
    };
    const result = scanReportSchema.safeParse(report);
    expect(result.success).toBe(true);
  });

  it('SecurityReport with uppercase severity FAILS validation', () => {
    const report = {
      type: 'SECURITY',
      issues: [
        {
          id: 'sec-001',
          severity: 'HIGH',
          description: 'SQL injection',
          file: 'lib/db.ts',
          line: 1,
        },
      ],
      generatedTickets: [],
    };
    const result = scanReportSchema.safeParse(report);
    expect(result.success).toBe(false);
  });

  it('SecurityReport missing id field FAILS validation', () => {
    const report = {
      type: 'SECURITY',
      issues: [
        {
          severity: 'high',
          description: 'Missing auth check',
          file: 'app/api/route.ts',
          line: 5,
        },
      ],
      generatedTickets: [],
    };
    const result = scanReportSchema.safeParse(report);
    expect(result.success).toBe(false);
  });

  it('parseScanReport() correctly parses a valid SecurityReport JSON string', () => {
    const report: SecurityReport = {
      type: 'SECURITY',
      issues: [
        makeIssue({
          id: 'sec-001',
          severity: 'low',
          description: 'Debug mode enabled',
          file: 'next.config.js',
          line: 3,
          category: 'misconfiguration',
        }),
      ],
      generatedTickets: [],
    };
    const parsed = parseScanReport('SECURITY', JSON.stringify(report));
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('SECURITY');
    expect((parsed as SecurityReport).issues).toHaveLength(1);
    expect((parsed as SecurityReport).issues[0].id).toBe('sec-001');
  });
});

// --- US2: Compliance Report Validation ---

describe('ComplianceReport schema validation', () => {
  it('valid ComplianceReport with id, severity, type COMPLIANCE, category, and generatedTickets passes', () => {
    const report: ComplianceReport = {
      type: 'COMPLIANCE',
      issues: [
        makeIssue({
          id: 'comp-ts-001',
          severity: 'medium',
          description: "Usage of 'any' type violates strict TypeScript principle",
          file: 'lib/utils/parser.ts',
          line: 15,
          category: 'TypeScript-First',
        }),
        makeIssue({
          id: 'comp-sec-001',
          severity: 'high',
          description: 'Hardcoded hex color violates Security-First principle',
          file: 'components/card.tsx',
          line: 22,
          category: 'Security-First',
        }),
      ],
      generatedTickets: [],
    };
    const result = scanReportSchema.safeParse(report);
    expect(result.success).toBe(true);
  });

  it('ComplianceReport missing severity field FAILS validation', () => {
    const report = {
      type: 'COMPLIANCE',
      issues: [
        {
          id: 'comp-ts-001',
          description: 'Missing type annotation',
          file: 'lib/utils.ts',
          line: 5,
          category: 'TypeScript-First',
        },
      ],
      generatedTickets: [],
    };
    const result = scanReportSchema.safeParse(report);
    expect(result.success).toBe(false);
  });

  it('parseScanReport() correctly parses a valid ComplianceReport JSON string', () => {
    const report: ComplianceReport = {
      type: 'COMPLIANCE',
      issues: [
        makeIssue({
          id: 'comp-db-001',
          severity: 'high',
          description: 'Raw SQL query bypasses Prisma',
          file: 'lib/db/raw.ts',
          line: 8,
          category: 'Database-Integrity',
        }),
      ],
      generatedTickets: [],
    };
    const parsed = parseScanReport('COMPLIANCE', JSON.stringify(report));
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('COMPLIANCE');
    expect((parsed as ComplianceReport).issues[0].category).toBe('Database-Integrity');
  });
});

// --- US3: Tests Report Validation ---

describe('TestsReport schema validation', () => {
  it('valid TestsReport with autoFixed and nonFixable arrays, type TESTS, and generatedTickets passes', () => {
    const report: TestsReport = {
      type: 'TESTS',
      autoFixed: [
        makeIssue({
          id: 'test-fix-001',
          severity: 'medium',
          description: 'Fixed outdated assertion in calculateTotal test',
          file: 'tests/unit/calc.test.ts',
          line: 25,
        }),
      ],
      nonFixable: [
        makeIssue({
          id: 'test-fail-001',
          severity: 'high',
          description: 'Integration test requires database seed data',
          file: 'tests/integration/api.test.ts',
          line: 10,
        }),
      ],
      generatedTickets: [],
    };
    const result = scanReportSchema.safeParse(report);
    expect(result.success).toBe(true);
  });

  it('TestsReport using old issues/nonFixable structure FAILS validation', () => {
    const report = {
      type: 'TESTS',
      issues: [
        {
          file: 'tests/unit/example.test.ts',
          description: 'Test fails',
          status: 'fixed',
        },
      ],
      nonFixable: [
        {
          file: 'tests/integration/api.test.ts',
          description: 'Requires infra changes',
          reason: 'Needs DB seed',
        },
      ],
      generatedTickets: [],
    };
    const result = scanReportSchema.safeParse(report);
    expect(result.success).toBe(false);
  });

  it('parseScanReport() correctly parses a valid TestsReport JSON string', () => {
    const report: TestsReport = {
      type: 'TESTS',
      autoFixed: [],
      nonFixable: [
        makeIssue({
          id: 'test-fail-001',
          severity: 'high',
          description: 'Timeout in E2E test',
          file: 'tests/e2e/login.test.ts',
          line: 50,
        }),
      ],
      generatedTickets: [],
    };
    const parsed = parseScanReport('TESTS', JSON.stringify(report));
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('TESTS');
    expect((parsed as TestsReport).autoFixed).toHaveLength(0);
    expect((parsed as TestsReport).nonFixable).toHaveLength(1);
  });
});

// --- US4: Spec Sync Report Validation ---

describe('SpecSyncReport schema validation', () => {
  it('valid SpecSyncReport with specs array containing synced and drifted entries, type SPEC_SYNC, and generatedTickets passes', () => {
    const report: SpecSyncReport = {
      type: 'SPEC_SYNC',
      specs: [
        { specPath: 'specs/specifications/endpoints.md', status: 'synced' },
        {
          specPath: 'specs/specifications/schemas.md',
          status: 'drifted',
          drift: 'Missing POST /api/health/scans endpoint documentation',
        },
      ],
      generatedTickets: [],
    };
    const result = scanReportSchema.safeParse(report);
    expect(result.success).toBe(true);
  });

  it('parseScanReport() correctly parses a valid SpecSyncReport JSON string', () => {
    const report: SpecSyncReport = {
      type: 'SPEC_SYNC',
      specs: [
        { specPath: 'specs/specifications/data-model.md', status: 'synced' },
        {
          specPath: 'specs/specifications/endpoints.md',
          status: 'drifted',
          drift: 'New /api/billing route not in spec',
        },
      ],
      generatedTickets: [],
    };
    const parsed = parseScanReport('SPEC_SYNC', JSON.stringify(report));
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('SPEC_SYNC');
    expect((parsed as SpecSyncReport).specs).toHaveLength(2);
    expect((parsed as SpecSyncReport).specs[1].status).toBe('drifted');
  });
});

// --- Cross-cutting: groupIssuesIntoTickets ---

describe('groupIssuesIntoTickets()', () => {
  it('produces correct tickets from SecurityReport (one per severity)', () => {
    const report: SecurityReport = {
      type: 'SECURITY',
      issues: [
        makeIssue({ id: 'sec-001', severity: 'high', description: 'SQL injection', file: 'lib/db.ts', line: 10, category: 'injection' }),
        makeIssue({ id: 'sec-002', severity: 'high', description: 'XSS in template', file: 'lib/render.ts', line: 5, category: 'injection' }),
        makeIssue({ id: 'sec-003', severity: 'low', description: 'Debug mode on', file: 'config.ts', line: 1, category: 'misconfiguration' }),
      ],
      generatedTickets: [],
    };
    const tickets = groupIssuesIntoTickets('SECURITY', report);
    expect(tickets).toHaveLength(2); // high (2 issues) + low (1 issue)
    expect(tickets.every((t) => t.stage === 'INBOX')).toBe(true);
    expect(tickets.every((t) => t.workflowType === 'QUICK')).toBe(true);
    const highTicket = tickets.find((t) => t.title.includes('HIGH'));
    expect(highTicket).toBeDefined();
    expect(highTicket!.title).toContain('2');
  });

  it('produces correct tickets from ComplianceReport (one per category)', () => {
    const report: ComplianceReport = {
      type: 'COMPLIANCE',
      issues: [
        makeIssue({ id: 'comp-ts-001', severity: 'medium', description: 'any type used', file: 'lib/a.ts', line: 1, category: 'TypeScript-First' }),
        makeIssue({ id: 'comp-ts-002', severity: 'medium', description: 'missing annotation', file: 'lib/b.ts', line: 2, category: 'TypeScript-First' }),
        makeIssue({ id: 'comp-sec-001', severity: 'high', description: 'hardcoded color', file: 'ui/c.tsx', line: 3, category: 'Security-First' }),
      ],
      generatedTickets: [],
    };
    const tickets = groupIssuesIntoTickets('COMPLIANCE', report);
    expect(tickets).toHaveLength(2); // TypeScript-First + Security-First
    const tsTicket = tickets.find((t) => t.title.includes('TypeScript-First'));
    expect(tsTicket).toBeDefined();
    expect(tsTicket!.title).toContain('2 violation');
  });

  it('produces correct tickets from TestsReport (one per nonFixable)', () => {
    const report: TestsReport = {
      type: 'TESTS',
      autoFixed: [
        makeIssue({ id: 'test-fix-001', severity: 'medium', description: 'Fixed assertion', file: 'tests/a.test.ts', line: 1 }),
      ],
      nonFixable: [
        makeIssue({ id: 'test-fail-001', severity: 'high', description: 'Needs DB seed', file: 'tests/b.test.ts', line: 5 }),
        makeIssue({ id: 'test-fail-002', severity: 'high', description: 'Timeout issue', file: 'tests/c.test.ts', line: 10 }),
      ],
      generatedTickets: [],
    };
    const tickets = groupIssuesIntoTickets('TESTS', report);
    expect(tickets).toHaveLength(2); // one per nonFixable
    expect(tickets[0].title).toContain('Needs DB seed');
    expect(tickets[1].title).toContain('Timeout issue');
  });
});
