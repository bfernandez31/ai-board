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
  Play,
  TrendingUp,
  TrendingDown,
  Minus,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getScoreColor } from '@/lib/quality-score';
import { MODULE_METADATA } from '@/lib/health/types';
import type { HealthModuleType, HealthModuleStatus } from '@/lib/health/types';

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
      className={`aurora-glass rounded-lg p-4 space-y-3${onClick ? ' aurora-glass-hover cursor-pointer' : ''}${module.stalenessStatus === 'warning' ? ' border-l-2 border-ctp-yellow' : ''}${module.stalenessStatus === 'alert' ? ' border-l-2 border-ctp-red' : ''}${module.stalenessStatus === 'ok' ? ' border-l-2 border-ctp-green' : ''}`}
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

      {module.trend && (
        <TrendIndicator trend={module.trend} trendDelta={module.trendDelta ?? null} />
      )}

      {module.distribution && module.ticketCount !== undefined && module.ticketCount > 0 && (
        <DistributionBar distribution={module.distribution} />
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
        <div className="pt-1 flex justify-center">
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

      {module.filesCleaned !== undefined && module.filesCleaned !== null && (
        <p className="text-[11px] text-muted-foreground">
          {module.filesCleaned} file{module.filesCleaned !== 1 ? 's' : ''} cleaned
        </p>
      )}

      {scoreColors && state === 'completed' && (
        <div className={`h-1 rounded-full ${scoreColors.fill}`} />
      )}
    </div>
  );
}

const BUTTON_LABELS: Record<CardState, string> = {
  never_scanned: 'Run scan',
  completed: 'Re-run',
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
      <Button size="sm" className="rounded-full px-4 py-1.5 text-xs mx-auto" disabled onClick={(e) => e.stopPropagation()}>
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Scanning...
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      className="rounded-full px-4 py-1.5 text-xs mx-auto"
      onClick={(e) => { e.stopPropagation(); onTriggerScan?.(); }}
      disabled={isTriggerPending}
    >
      <Play className="h-3 w-3 mr-1 fill-current" />
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

  return (
    <span className="text-xs font-medium text-muted-foreground bg-muted rounded-md px-2 py-0.5">
      ---
    </span>
  );
}

function TrendIndicator({
  trend,
  trendDelta,
}: {
  trend: 'up' | 'down' | 'stable';
  trendDelta: number | null;
}) {
  const config = {
    up: { icon: TrendingUp, color: 'text-ctp-green', label: 'Improving' },
    down: { icon: TrendingDown, color: 'text-ctp-red', label: 'Declining' },
    stable: { icon: Minus, color: 'text-muted-foreground', label: 'Stable' },
  };

  const { icon: TrendIcon, color, label } = config[trend];
  const deltaText = trendDelta !== null && trendDelta !== 0
    ? ` (${trendDelta > 0 ? '+' : ''}${trendDelta})`
    : '';

  return (
    <div className={`flex items-center gap-1.5 text-xs ${color}`}>
      <TrendIcon className="h-3.5 w-3.5" />
      <span>{label}{deltaText}</span>
    </div>
  );
}

function DistributionBar({
  distribution,
}: {
  distribution: { excellent: number; good: number; fair: number; poor: number };
}) {
  const total = distribution.excellent + distribution.good + distribution.fair + distribution.poor;
  if (total === 0) return null;

  const segments = [
    { count: distribution.excellent, color: 'bg-ctp-green', label: 'Excellent' },
    { count: distribution.good, color: 'bg-ctp-blue', label: 'Good' },
    { count: distribution.fair, color: 'bg-ctp-yellow', label: 'Fair' },
    { count: distribution.poor, color: 'bg-ctp-red', label: 'Poor' },
  ].filter((s) => s.count > 0);

  return (
    <div className="space-y-1">
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        {segments.map((s) => (
          <div
            key={s.label}
            className={`${s.color} rounded-full`}
            style={{ width: `${(s.count / total) * 100}%` }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <div className="flex gap-2 text-[10px] text-muted-foreground">
        {segments.map((s) => (
          <span key={s.label}>{s.count} {s.label}</span>
        ))}
      </div>
    </div>
  );
}
