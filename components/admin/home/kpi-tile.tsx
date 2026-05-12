'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KpiTile as KpiTileType } from '@/app/lib/admin/home/types';
import {
  formatCountWithSpacedThousands,
  formatDelta,
  formatPercent,
  formatPriceCents,
} from '@/app/lib/admin/home/formatters';
import { KpiSparkline } from './kpi-sparkline';

function tileBgClass(id: KpiTileType['id']): string {
  switch (id) {
    case 'users':
      return 'aurora-bg-card-blue';
    case 'mau':
      return 'aurora-bg-card-mauve';
    case 'mrr':
      return 'aurora-bg-card-yellow';
    case 'paying':
      return 'aurora-bg-card-green';
  }
}

function formatValue(tile: KpiTileType): string {
  switch (tile.unit) {
    case 'cents':
      return formatPriceCents(tile.value);
    case 'percent':
      return formatPercent(tile.value);
    case 'count':
    default:
      return formatCountWithSpacedThousands(tile.value);
  }
}

interface DeltaBadgeProps {
  delta: KpiTileType['deltas'][number];
}

function DeltaBadge({ delta }: DeltaBadgeProps) {
  const isPositive = delta.value > 0;
  const isNegative = delta.value < 0;
  const goodDirection = delta.goodDirection;
  const isGood =
    (isPositive && goodDirection === 'up') || (isNegative && goodDirection === 'down');
  const isBad =
    (isNegative && goodDirection === 'up') || (isPositive && goodDirection === 'down');

  const colorClass = cn(
    'text-xs font-medium',
    isGood && 'text-foreground',
    isBad && 'text-destructive',
    !isGood && !isBad && 'text-muted-foreground'
  );

  return (
    <span className="flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">{delta.label}</span>
      <span className={colorClass}>{formatDelta(delta)}</span>
    </span>
  );
}

interface KpiTileProps {
  tile: KpiTileType;
}

export function KpiTile({ tile }: KpiTileProps) {
  return (
    <Card className={tileBgClass(tile.id)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-foreground">
          {tile.label}
        </CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${tile.label} definition`}
                className="text-muted-foreground"
              >
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">{tile.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-bold">{formatValue(tile)}</div>
        <div className="flex flex-wrap items-center gap-3">
          <DeltaBadge delta={tile.deltas[0]} />
          <DeltaBadge delta={tile.deltas[1]} />
        </div>
        <KpiSparkline data={tile.sparkline} ariaLabel={`${tile.label} sparkline`} />
      </CardContent>
    </Card>
  );
}
