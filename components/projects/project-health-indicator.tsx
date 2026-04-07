'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type {
  ProjectHealthSubScores,
  ProjectHealthSummary,
} from '@/app/lib/types/project';
import { getScoreColor } from '@/lib/quality-score';
import { cn } from '@/lib/utils';
import { Heart } from 'lucide-react';

interface ProjectHealthIndicatorProps {
  healthSummary: ProjectHealthSummary;
}

const HEALTH_ROWS: Array<{
  key: keyof ProjectHealthSubScores;
  label: string;
}> = [
  { key: 'security', label: 'Security' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'tests', label: 'Tests' },
  { key: 'specSync', label: 'Spec Sync' },
  { key: 'qualityGate', label: 'Quality Gate' },
  { key: 'reviewQuality', label: 'Review Quality' },
];

function formatOverallLabel(healthSummary: ProjectHealthSummary): string {
  if (healthSummary.globalScore === null) {
    return 'Project health score: no data yet';
  }

  return `Project health score: ${healthSummary.globalScore}, ${healthSummary.label}`;
}

function ScoreValue({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="font-medium text-muted-foreground">—</span>;
  }

  const colors = getScoreColor(score);

  return <span className={cn('font-semibold', colors.text)}>{score}</span>;
}

export function ProjectHealthIndicator({
  healthSummary,
}: ProjectHealthIndicatorProps) {
  const handleTriggerClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={handleTriggerClick}
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            healthSummary.color.bg,
            healthSummary.globalScore === null
              ? 'border-border text-muted-foreground hover:bg-muted'
              : 'border-transparent text-foreground hover:brightness-110',
          )}
          aria-label={formatOverallLabel(healthSummary)}
          data-testid="project-health-indicator"
        >
          <Heart
            className={cn('h-4 w-4 fill-current', healthSummary.color.text)}
            aria-hidden="true"
          />
          <span
            className={cn(
              'tabular-nums',
              healthSummary.globalScore === null
                ? 'text-muted-foreground'
                : healthSummary.color.text,
            )}
          >
            {healthSummary.globalScore ?? '—'}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-64"
        align="end"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Project health
            </p>
            <p className="text-xs text-muted-foreground">
              Read-only breakdown of the latest card score.
            </p>
          </div>

          <div className="space-y-2">
            {HEALTH_ROWS.map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span className="text-muted-foreground">{label}</span>
                <ScoreValue score={healthSummary.subScores[key]} />
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
