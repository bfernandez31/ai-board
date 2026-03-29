'use client';

import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getScoreColor } from '@/lib/quality-score';
import { MODULE_ICONS, getModuleLabel, getModuleState } from './shared';
import type { ModuleState } from './shared';
import type { HealthModuleType, HealthModuleStatus } from '@/lib/health/types';

interface HealthModuleCardProps {
  moduleType: HealthModuleType;
  module: HealthModuleStatus;
  isScanning?: boolean;
  onTriggerScan?: (() => void) | undefined;
  isTriggerPending?: boolean | undefined;
  onClick?: () => void;
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
  const label = getModuleLabel(moduleType);
  const isPassive = module.passive === true;
  const state = getModuleState(module, isScanning);
  const scoreColors = module.score !== null ? getScoreColor(module.score) : null;

  return (
    <div className="aurora-glass aurora-glass-hover rounded-lg p-4 space-y-3 cursor-pointer" onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}>
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

const BUTTON_LABELS: Record<ModuleState, string> = {
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
  state: ModuleState;
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
  state: ModuleState;
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

  return (
    <span className="text-xs font-medium text-muted-foreground bg-muted rounded-md px-2 py-0.5">
      ---
    </span>
  );
}
