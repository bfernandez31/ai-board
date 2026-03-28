import type { HealthScanType, HealthScanStatus } from '@prisma/client';
import type { LucideIcon } from 'lucide-react';

export interface ModuleConfig {
  type: string;
  name: string;
  icon: LucideIcon;
  isPassive: boolean;
}

export type ModuleStatus = 'idle' | 'scanning' | 'completed' | 'failed' | 'never_scanned';

export interface LatestScanInfo {
  id: number;
  status: HealthScanStatus;
  baseCommit: string | null;
  headCommit: string | null;
  issuesFound: number;
  issuesFixed: number;
  errorMessage: string | null;
}

export interface ModuleResponse {
  type: string;
  name: string;
  score: number | null;
  status: ModuleStatus;
  isPassive: boolean;
  lastScanAt: string | null;
  summary: string | null;
  latestScan: LatestScanInfo | null;
}

export interface HealthScoreResponse {
  globalScore: number | null;
  globalLabel: string | null;
  modules: ModuleResponse[];
  lastScanAt: string | null;
}

export interface HealthScanResponse {
  id: number;
  projectId: number;
  scanType: HealthScanType;
  status: HealthScanStatus;
  score: number | null;
  issuesFound: number;
  issuesFixed: number;
  baseCommit: string | null;
  headCommit: string | null;
  ticketsCreated: number;
  errorMessage: string | null;
  durationMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ScanHistoryResponse {
  scans: HealthScanResponse[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface TriggerScanResponse {
  scan: HealthScanResponse;
}
