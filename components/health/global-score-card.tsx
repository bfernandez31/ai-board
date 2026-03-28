'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getScoreThreshold, getScoreColor } from '@/lib/health/score-calculator';
import { CONTRIBUTING_MODULES } from '@/lib/health/constants';
import type { ModuleResponse } from '@/lib/health/types';

interface GlobalScoreCardProps {
  globalScore: number | null;
  modules: ModuleResponse[];
  lastScanAt: string | null;
}

function formatLastScan(lastScanAt: string | null): string {
  if (!lastScanAt) return 'No scans yet';
  const date = new Date(lastScanAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Last full scan: today';
  if (diffDays === 1) return 'Last full scan: 1 day ago';
  return `Last full scan: ${diffDays} days ago`;
}

export function GlobalScoreCard({ globalScore, modules, lastScanAt }: GlobalScoreCardProps) {
  const label = globalScore != null ? getScoreThreshold(globalScore) : null;
  const colors = globalScore != null ? getScoreColor(globalScore) : null;

  const contributingModules = CONTRIBUTING_MODULES.map((config) => {
    const moduleData = modules.find((m) => m.type === config.type);
    return {
      name: config.name,
      score: moduleData?.score ?? null,
    };
  });

  return (
    <Card className="border-ctp-mauve/15 aurora-bg-subtle">
      <CardContent className="flex flex-col items-center gap-4 p-6">
        <div className="text-center">
          <div
            className={`text-6xl font-bold ${colors?.text ?? 'text-muted-foreground'}`}
            data-testid="global-score"
          >
            {globalScore != null ? globalScore : '---'}
          </div>
          {label && (
            <div className={`mt-1 text-lg font-medium ${colors?.text ?? ''}`}>
              {label}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {contributingModules.map((mod) => {
            const modColors = mod.score != null ? getScoreColor(mod.score) : null;
            return (
              <Badge
                key={mod.name}
                variant="outline"
                className={`${modColors?.bg ?? 'bg-muted'} ${modColors?.text ?? 'text-muted-foreground'} border-0`}
              >
                {mod.name}: {mod.score != null ? mod.score : '---'}
              </Badge>
            );
          })}
        </div>

        <p className="text-sm text-muted-foreground">
          {formatLastScan(lastScanAt)}
        </p>
      </CardContent>
    </Card>
  );
}
