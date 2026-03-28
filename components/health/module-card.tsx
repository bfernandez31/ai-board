'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getScoreColor, getScoreThreshold } from '@/lib/health/score-calculator';
import type { ModuleConfig } from '@/lib/health/types';
import type { ModuleResponse } from '@/lib/health/types';

interface ModuleCardProps {
  config: ModuleConfig;
  module: ModuleResponse;
  actionButton?: React.ReactNode;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ModuleCard({ config, module, actionButton }: ModuleCardProps) {
  const Icon = config.icon;
  const { status, score, summary, lastScanAt, latestScan, isPassive } = module;

  const scoreColors = score != null ? getScoreColor(score) : null;
  const scoreLabel = score != null ? getScoreThreshold(score) : null;

  return (
    <Card className="border-ctp-mauve/15 aurora-bg-subtle" data-testid={`module-card-${config.type}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-ctp-mauve" />
          <CardTitle className="text-sm font-medium">{config.name}</CardTitle>
          {isPassive && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              passive
            </Badge>
          )}
        </div>
        {score != null && (
          <Badge className={`${scoreColors?.bg ?? ''} ${scoreColors?.text ?? ''} border-0`}>
            {score} {scoreLabel}
          </Badge>
        )}
        {score == null && status !== 'scanning' && (
          <span className="text-sm text-muted-foreground">---</span>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {status === 'never_scanned' && (
          <p className="text-sm text-muted-foreground">No scan yet</p>
        )}
        {status === 'scanning' && (
          <p className="text-sm text-ctp-yellow">Scanning...</p>
        )}
        {status === 'completed' && summary && (
          <p className="text-sm text-muted-foreground">{summary}</p>
        )}
        {status === 'failed' && (
          <>
            <Badge variant="destructive" className="text-xs">Failed</Badge>
            {latestScan?.errorMessage && (
              <p className="text-xs text-muted-foreground">{latestScan.errorMessage}</p>
            )}
          </>
        )}

        {!isPassive && latestScan && (latestScan.baseCommit || latestScan.headCommit) && (
          <p className="font-mono text-xs text-muted-foreground">
            {latestScan.baseCommit?.slice(0, 7) ?? 'full'}..{latestScan.headCommit?.slice(0, 7) ?? ''}
          </p>
        )}

        <div className="flex items-center justify-between">
          {lastScanAt && (
            <p className="text-xs text-muted-foreground">{formatDate(lastScanAt)}</p>
          )}
          {actionButton}
        </div>
      </CardContent>
    </Card>
  );
}
