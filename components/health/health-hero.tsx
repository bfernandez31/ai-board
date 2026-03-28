'use client';

import { getScoreLabel, getScoreColorConfig } from '@/lib/health/score-calculator';
import { HealthSubScoreBadge } from './health-sub-score-badge';
import type { HealthResponse } from '@/lib/health/types';

interface HealthHeroProps {
  globalScore: number | null;
  modules: HealthResponse['modules'];
  lastFullScanDate: string | null;
}

function formatTimeSince(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function HealthHero({ globalScore, modules, lastFullScanDate }: HealthHeroProps) {
  const label = getScoreLabel(globalScore);
  const color = getScoreColorConfig(globalScore);
  const displayScore = globalScore !== null ? globalScore.toString() : '---';

  return (
    <div className="aurora-bg-section rounded-xl p-6 space-y-4">
      <div className="flex flex-col items-center gap-3">
        <div className={`aurora-glow-score rounded-full w-24 h-24 flex items-center justify-center ${color.bg}`}>
          <span className={`text-4xl font-bold ${color.text}`}>
            {displayScore}
          </span>
        </div>
        <div className="text-center">
          <p className={`text-lg font-semibold ${color.text}`}>{label}</p>
          <p className="text-sm text-muted-foreground">
            Last full scan: {formatTimeSince(lastFullScanDate)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <HealthSubScoreBadge label="Security" score={modules.security.score} />
        <HealthSubScoreBadge label="Compliance" score={modules.compliance.score} />
        <HealthSubScoreBadge label="Tests" score={modules.tests.score} />
        <HealthSubScoreBadge label="Spec Sync" score={modules.specSync.score} />
        <HealthSubScoreBadge label="Quality Gate" score={modules.qualityGate.score} />
      </div>
    </div>
  );
}
