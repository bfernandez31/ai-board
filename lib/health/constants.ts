import { Shield, FileCheck, TestTube2, GitCompareArrows, BadgeCheck, Sparkles } from 'lucide-react';
import type { ModuleConfig } from './types';

export const HEALTH_MODULES: ModuleConfig[] = [
  { type: 'SECURITY', name: 'Security', icon: Shield, isPassive: false },
  { type: 'COMPLIANCE', name: 'Compliance', icon: FileCheck, isPassive: false },
  { type: 'TESTS', name: 'Tests', icon: TestTube2, isPassive: false },
  { type: 'QUALITY_GATE', name: 'Quality Gate', icon: BadgeCheck, isPassive: true },
  { type: 'SPEC_SYNC', name: 'Spec Sync', icon: GitCompareArrows, isPassive: false },
  { type: 'LAST_CLEAN', name: 'Last Clean', icon: Sparkles, isPassive: true },
];

export const CONTRIBUTING_MODULES = HEALTH_MODULES.filter((m) => !m.isPassive);
