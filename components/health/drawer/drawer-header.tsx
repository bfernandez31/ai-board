'use client';

import {
  Shield,
  Scale,
  TestTubeDiagonal,
  FileCheck,
  Award,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { getScoreColor } from '@/lib/quality-score';
import { MODULE_METADATA } from '@/lib/health/types';
import type { HealthModuleType, HealthModuleStatus, ScanHistoryItemWithReport } from '@/lib/health/types';

const MODULE_ICONS: Record<HealthModuleType, LucideIcon> = {
  SECURITY: Shield,
  COMPLIANCE: Scale,
  TESTS: TestTubeDiagonal,
  SPEC_SYNC: FileCheck,
  QUALITY_GATE: Award,
  LAST_CLEAN: Sparkles,
};

interface DrawerHeaderProps {
  moduleType: HealthModuleType;
  moduleStatus: HealthModuleStatus;
  scan: ScanHistoryItemWithReport | null;
  isLoading: boolean;
}

export function DrawerHeader({ moduleType, moduleStatus, scan, isLoading }: DrawerHeaderProps) {
  const Icon = MODULE_ICONS[moduleType];
  const meta = MODULE_METADATA[moduleType];
  const score = scan?.score ?? moduleStatus.score;
  const scoreColors = score !== null ? getScoreColor(score) : null;

  const scanDate = scan?.completedAt ?? moduleStatus.lastScanDate ?? moduleStatus.lastCleanDate;
  const baseCommit = scan?.baseCommit;
  const headCommit = scan?.headCommit;

  return (
    <div className="aurora-glass rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-base">{meta.label}</h3>
          {meta.passive && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
              passive
            </span>
          )}
        </div>

        <HeaderScoreBadge isLoading={isLoading} score={score} scoreColors={scoreColors} />
      </div>

      {scanDate && (
        <p className="text-xs text-muted-foreground">
          Last scan: {new Date(scanDate).toLocaleDateString()}
        </p>
      )}

      {baseCommit && headCommit && (
        <p className="text-xs text-muted-foreground font-mono">
          {baseCommit.slice(0, 7)}..{headCommit.slice(0, 7)}
        </p>
      )}

      {scan?.issuesFound !== undefined && scan.issuesFound !== null && (
        <p className="text-xs text-muted-foreground">
          {scan.issuesFound} issue{scan.issuesFound !== 1 ? 's' : ''} found
          {scan.issuesFixed ? `, ${scan.issuesFixed} fixed` : ''}
        </p>
      )}
    </div>
  );
}

function HeaderScoreBadge({
  isLoading,
  score,
  scoreColors,
}: {
  isLoading: boolean;
  score: number | null;
  scoreColors: { text: string; bg: string } | null;
}) {
  if (isLoading) {
    return (
      <span className="text-xs text-muted-foreground bg-muted rounded-md px-2 py-0.5">...</span>
    );
  }

  if (score !== null && scoreColors) {
    return (
      <span className={`text-sm font-semibold ${scoreColors.text} ${scoreColors.bg} rounded-md px-2.5 py-0.5`}>
        {score}
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground bg-muted rounded-md px-2 py-0.5">---</span>
  );
}
