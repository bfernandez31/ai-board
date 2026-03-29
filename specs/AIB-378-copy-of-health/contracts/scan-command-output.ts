/**
 * Contract: Health Scan Command Output
 *
 * Defines the JSON structure each health scan command MUST produce on stdout.
 * The health-scan.yml workflow parses this output and transforms it into
 * the ScanReport types defined in lib/health/types.ts.
 *
 * Commands: health-security, health-compliance, health-tests, health-spec-sync
 */

// --- Shared base output (all commands) ---

export interface ScanCommandOutput {
  /** Health score 0-100 (100 = no issues found) */
  score: number;
  /** Total number of issues detected */
  issuesFound: number;
  /** Number of issues auto-fixed (0 for non-test scans) */
  issuesFixed: number;
  /** Scan-specific report payload */
  report: SecurityReportPayload | ComplianceReportPayload | TestsReportPayload | SpecSyncReportPayload;
  /** Tokens consumed during scan (0 if unknown) */
  tokensUsed: number;
  /** Cost in USD (0 if unknown) */
  costUsd: number;
}

// --- Security ---

export interface SecurityIssue {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  file: string;
  line: number;
  description: string;
  category: string;
}

export interface SecurityReportPayload {
  issues: SecurityIssue[];
  summary: string;
}

// --- Compliance ---

export interface ComplianceIssue {
  category: string;
  file: string;
  line: number;
  description: string;
}

export interface ComplianceReportPayload {
  issues: ComplianceIssue[];
  summary: string;
}

// --- Tests ---

export interface TestIssueFixed {
  file: string;
  description: string;
  status: 'fixed';
}

export interface TestIssueNonFixable {
  file: string;
  description: string;
  reason: string;
}

export interface TestsReportPayload {
  issues: TestIssueFixed[];
  nonFixable: TestIssueNonFixable[];
  summary: string;
}

// --- Spec Sync ---

export interface SpecSyncEntry {
  specPath: string;
  status: 'synced' | 'drifted';
  drift?: string;
}

export interface SpecSyncReportPayload {
  specs: SpecSyncEntry[];
  summary: string;
}

// --- Workflow integration ---

/** Static command mapping (must match lib/health/scan-commands.ts) */
export const SCAN_COMMAND_MAP = {
  SECURITY: 'health-security',
  COMPLIANCE: 'health-compliance',
  TESTS: 'health-tests',
  SPEC_SYNC: 'health-spec-sync',
} as const;

/** Valid scan types */
export type ScanType = keyof typeof SCAN_COMMAND_MAP;

/** Score calculation rules per scan type */
export const SCORE_RULES = {
  SECURITY: 'score = 100 - (HIGH*15 + MEDIUM*5 + LOW*1), floor 0',
  COMPLIANCE: 'score = 100 - (fail*20 + partial*5) per principle, floor 0',
  TESTS: 'score = (passed / total) * 100, adjusted for auto-fixed',
  SPEC_SYNC: 'score = (synced / total) * 100',
} as const;
