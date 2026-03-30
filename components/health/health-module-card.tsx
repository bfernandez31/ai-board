'use client';

import {
  Shield,
  Scale,
  TestTubeDiagonal,
  FileCheck,
  Award,
  Sparkles,
  Loader2,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getScoreColor } from '@/lib/quality-score';
import { MODULE_METADATA } from '@/lib/health/types';
import type { HealthModuleType, HealthModuleStatus, QualityGateModuleStatus, LastCleanModuleStatus } from '@/lib/health/types';

const MODULE_ICONS: Record<HealthModuleType, LucideIcon> = {
  SECURITY: Shield,
  COMPLIANCE: Scale,
  TESTS: TestTubeDiagonal,
  SPEC_SYNC: FileCheck,
  QUALITY_GATE: Award,
  LAST_CLEAN: Sparkles,
};

type CardState = 'never_scanned' | 'scanning' | 'completed' | 'failed';

function getCardState(module: HealthModuleStatus, isScanning: boolean): CardState {
  if (isScanning) return 'scanning';
  if (module.scanStatus === 'FAILED') return 'failed';
  if (module.score !== null || module.label === 'OK') return 'completed';
  return 'never_scanned';
}

interface HealthModuleCardProps {
  moduleType: HealthModuleType;
  module: HealthModuleStatus;
  isScanning?: boolean;
  onTriggerScan?: (() => void) | undefined;
  isTriggerPending?: boolean | undefined;
  onClick?: (() => void) | undefined;
}

export function HealthModuleCard({
  moduleType,
  module,
  isScanning = false,
  onTriggerScan,
  isTriggerPending = false,
  onClick,
}: HealthModuleCardProps) {
  const Icon = MODULE_ICONS[moduleType];
  const label = MODULE_METADATA[moduleType].label;
  const isPassive = module.passive === true;
  const state = getCardState(module, isScanning);
  const scoreColors = module.score !== null ? getScoreColor(module.score) : null;

  return (
    <div
      className={`aurora-glass rounded-lg p-4 space-y-3${onClick ? ' aurora-glass-hover cursor-pointer' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium text-sm">{label}</h3>
          {isPassive && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
              passive
            </span>
          )}
        </div>
        <ScoreBadge score={module.score} label={module.label} state={state} />
      </div>

      <p className="text-sm text-muted-foreground">{module.summary}</p>

      {moduleType === 'QUALITY_GATE' && (module as QualityGateModuleStatus).ticketCount > 0 && (
        <QualityGateCardExtras module={module as QualityGateModuleStatus} />
      )}

      {moduleType === 'LAST_CLEAN' && (module as LastCleanModuleStatus).isOverdue && (
        <div className="flex items-center gap-1.5 text-xs text-ctp-yellow">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Cleanup overdue</span>
        </div>
      )}

      {moduleType === 'LAST_CLEAN' && (module as LastCleanModuleStatus).status !== 'never' && (
        <LastCleanCardExtras module={module as LastCleanModuleStatus} />
      )}

      {state === 'scanning' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Scanning...</span>
        </div>
      )}

      {state === 'failed' && (
        <div className="flex items-center gap-2 text-sm text-ctp-red">
          <AlertTriangle className="h-4 w-4" />
          <span>Failed</span>
        </div>
      )}

      {!isPassive && (
        <div className="pt-1">
          <ScanButton state={state} onTriggerScan={onTriggerScan} isTriggerPending={isTriggerPending} />
        </div>
      )}

      {module.lastScanDate && (
        <p className="text-[11px] text-muted-foreground">
          Last scan: {new Date(module.lastScanDate).toLocaleDateString()}
        </p>
      )}
      {module.lastCleanDate && (
        <p className="text-[11px] text-muted-foreground">
          Last cleanup: {new Date(module.lastCleanDate).toLocaleDateString()}
        </p>
      )}

      {scoreColors && state === 'completed' && (
        <div className={`h-1 rounded-full ${scoreColors.fill}`} />
      )}
    </div>
  );
}

const BUTTON_LABELS: Record<CardState, string> = {
  never_scanned: 'Run first scan',
  completed: 'Re-run scan',
  failed: 'Retry',
  scanning: '',
};

function ScanButton({
  state,
  onTriggerScan,
  isTriggerPending,
}: {
  state: CardState;
  onTriggerScan?: (() => void) | undefined;
  isTriggerPending: boolean;
}) {
  if (state === 'scanning') {
    return (
      <Button size="sm" variant="outline" className="w-full text-xs" disabled onClick={(e) => e.stopPropagation()}>
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Scanning...
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="w-full text-xs"
      onClick={(e) => { e.stopPropagation(); onTriggerScan?.(); }}
      disabled={isTriggerPending}
    >
      {BUTTON_LABELS[state]}
    </Button>
  );
}

function ScoreBadge({
  score,
  label,
  state,
}: {
  score: number | null;
  label: string | null;
  state: CardState;
}) {
  if (state === 'failed') {
    return (
      <span className="text-xs font-medium text-ctp-red bg-ctp-red/10 rounded-md px-2 py-0.5">
        Failed
      </span>
    );
  }

  if (state === 'scanning') {
    return (
      <span className="text-xs font-medium text-muted-foreground bg-muted rounded-md px-2 py-0.5">
        ...
      </span>
    );
  }

  if (score !== null) {
    const colors = getScoreColor(score);
    return (
      <span className={`text-xs font-medium ${colors.text} ${colors.bg} rounded-md px-2 py-0.5`}>
        {score}
      </span>
    );
  }

  if (label === 'OK') {
    return (
      <span className="text-xs font-medium text-ctp-green bg-ctp-green/10 rounded-md px-2 py-0.5">
        OK
      </span>
    );
  }

  if (label === 'Overdue') {
    return (
      <span className="text-xs font-medium text-ctp-yellow bg-ctp-yellow/10 rounded-md px-2 py-0.5">
        Overdue
      </span>
    );
  }

  return (
    <span className="text-xs font-medium text-muted-foreground bg-muted rounded-md px-2 py-0.5">
      ---
    </span>
  );
}

function TrendIndicator({ trend }: { trend: QualityGateModuleStatus['trend'] }) {
  if (trend.type === 'no_data' || trend.type === 'new') {
    return <span className="text-xs text-muted-foreground">N/A</span>;
  }
  if (trend.type === 'improvement') {
    return <span className="text-xs text-ctp-green">↑ +{trend.delta}</span>;
  }
  if (trend.type === 'regression') {
    return <span className="text-xs text-ctp-red">↓ {trend.delta}</span>;
  }
  return <span className="text-xs text-muted-foreground">→ 0</span>;
}

function QualityGateCardExtras({ module }: { module: QualityGateModuleStatus }) {
  const { distribution, trend } = module;
  const total = distribution.excellent + distribution.good + distribution.fair + distribution.poor;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Trend</span>
        <TrendIndicator trend={trend} />
      </div>
      {total > 0 && (
        <div className="space-y-1">
          <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
            {distribution.excellent > 0 && (
              <div className="bg-ctp-green" style={{ flex: distribution.excellent }} />
            )}
            {distribution.good > 0 && (
              <div className="bg-ctp-blue" style={{ flex: distribution.good }} />
            )}
            {distribution.fair > 0 && (
              <div className="bg-ctp-yellow" style={{ flex: distribution.fair }} />
            )}
            {distribution.poor > 0 && (
              <div className="bg-ctp-red" style={{ flex: distribution.poor }} />
            )}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{distribution.excellent}E</span>
            <span>{distribution.good}G</span>
            <span>{distribution.fair}F</span>
            <span>{distribution.poor}P</span>
          </div>
        </div>
      )}
    </div>
  );
}

function LastCleanCardExtras({ module }: { module: LastCleanModuleStatus }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      {module.filesCleaned > 0 && <span>{module.filesCleaned} files</span>}
      {module.remainingIssues > 0 && <span>{module.remainingIssues} remaining</span>}
    </div>
  );
}
