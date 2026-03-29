import {
  Shield,
  Scale,
  TestTubeDiagonal,
  FileCheck,
  Award,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { MODULE_METADATA, ACTIVE_SCAN_TYPES } from '@/lib/health/types';
import type { HealthModuleType, HealthModuleStatus } from '@/lib/health/types';

export const MODULE_ICONS: Record<HealthModuleType, LucideIcon> = {
  SECURITY: Shield,
  COMPLIANCE: Scale,
  TESTS: TestTubeDiagonal,
  SPEC_SYNC: FileCheck,
  QUALITY_GATE: Award,
  LAST_CLEAN: Sparkles,
};

export function getModuleLabel(type: HealthModuleType): string {
  return MODULE_METADATA[type].label;
}

export type ModuleState = 'never_scanned' | 'scanning' | 'completed' | 'failed';

export function getModuleState(module: HealthModuleStatus, isScanning: boolean): ModuleState {
  if (isScanning) return 'scanning';
  if (module.scanStatus === 'FAILED') return 'failed';
  if (module.score !== null || module.label === 'OK') return 'completed';
  return 'never_scanned';
}

export const ACTIVE_SCAN_SET = new Set<string>(ACTIVE_SCAN_TYPES);
