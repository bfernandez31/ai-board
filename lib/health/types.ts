import type { HealthScanType, HealthScanStatus } from '@prisma/client';

/** All scan types including passive (non-scannable) modules */
export type HealthModuleType = HealthScanType | 'QUALITY_GATE' | 'LAST_CLEAN';

/** Active scan types that can be triggered */
export const ACTIVE_SCAN_TYPES: HealthScanType[] = [
  'SECURITY',
  'COMPLIANCE',
  'TESTS',
  'SPEC_SYNC',
];

/** All 6 module types for display */
export const ALL_MODULE_TYPES: HealthModuleType[] = [
  'SECURITY',
  'COMPLIANCE',
  'TESTS',
  'QUALITY_GATE',
  'SPEC_SYNC',
  'LAST_CLEAN',
];

/** Module display metadata */
export interface ModuleMetadata {
  key: HealthModuleType;
  label: string;
  passive: boolean;
}

export const MODULE_METADATA: Record<HealthModuleType, ModuleMetadata> = {
  SECURITY: { key: 'SECURITY', label: 'Security', passive: false },
  COMPLIANCE: { key: 'COMPLIANCE', label: 'Compliance', passive: false },
  TESTS: { key: 'TESTS', label: 'Tests', passive: false },
  SPEC_SYNC: { key: 'SPEC_SYNC', label: 'Spec Sync', passive: false },
  QUALITY_GATE: { key: 'QUALITY_GATE', label: 'Quality Gate', passive: true },
  LAST_CLEAN: { key: 'LAST_CLEAN', label: 'Last Clean', passive: true },
};

/** Module status in the health response */
export interface HealthModuleStatus {
  score: number | null;
  label: string | null;
  lastScanDate?: string | null;
  lastCleanDate?: string | null;
  scanStatus?: string | null;
  issuesFound?: number | null;
  passive?: boolean;
  jobId?: number | null;
  summary: string;
}

/** Active scan info for polling */
export interface ActiveScanInfo {
  id: number;
  scanType: HealthScanType;
  status: HealthScanStatus;
  startedAt: string | null;
}

/** Full health response shape */
export interface HealthResponse {
  globalScore: number | null;
  label: string;
  color: { text: string; bg: string; fill: string };
  modules: {
    security: HealthModuleStatus;
    compliance: HealthModuleStatus;
    tests: HealthModuleStatus;
    specSync: HealthModuleStatus;
    qualityGate: HealthModuleStatus;
    lastClean: HealthModuleStatus;
  };
  lastFullScanDate: string | null;
  activeScans: ActiveScanInfo[];
}

/** Scan record shape for history API */
export interface ScanHistoryItem {
  id: number;
  scanType: HealthScanType;
  status: HealthScanStatus;
  score: number | null;
  issuesFound: number | null;
  issuesFixed: number | null;
  baseCommit: string | null;
  headCommit: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/** Scan history response */
export interface ScanHistoryResponse {
  scans: ScanHistoryItem[];
  nextCursor: number | null;
  hasMore: boolean;
}
