'use client';

import { Award, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useQualityGateDetails } from '@/app/lib/hooks/useQualityGateDetails';
import { getScoreColor, getScoreThreshold } from '@/lib/quality-score';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface QualityGateDrawerProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function QualityGateDrawer({ projectId, isOpen, onClose }: QualityGateDrawerProps) {
  const { data, isLoading } = useQualityGateDetails(projectId, isOpen);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="sr-only">Quality Gate Details</SheetTitle>
          <SheetDescription className="sr-only">
            Detailed quality gate data for the project
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-2">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Award className="h-6 w-6 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">Quality Gate</h2>
              <p className="text-xs text-muted-foreground">30-day quality score analysis</p>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && data && data.averageScore === null && (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <p className="text-sm text-muted-foreground">No data yet</p>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Quality Gate data will appear once tickets with quality scores reach SHIP stage.
              </p>
            </div>
          )}

          {!isLoading && data && data.averageScore !== null && (
            <>
              {/* Score Summary */}
              <div className="aurora-glass rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${getScoreColor(data.averageScore).text}`}>
                      {data.averageScore}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-md ${getScoreColor(data.averageScore).text} ${getScoreColor(data.averageScore).bg}`}>
                      {getScoreThreshold(data.averageScore)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.ticketCount} ticket{data.ticketCount !== 1 ? 's' : ''} evaluated
                  </p>
                </div>
                {data.trend && (
                  <TrendBadge trend={data.trend} trendDelta={data.trendDelta} />
                )}
              </div>

              {/* Dimension Breakdown */}
              {data.dimensions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Dimension Breakdown</h3>
                  <div className="space-y-2">
                    {data.dimensions.map((dim) => (
                      <div key={dim.name} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-28 shrink-0">{dim.name}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          {dim.averageScore !== null && (
                            <div
                              className={`h-full rounded-full ${getScoreColor(dim.averageScore).fill}`}
                              style={{ width: `${dim.averageScore}%` }}
                            />
                          )}
                        </div>
                        <span className="text-xs font-medium w-8 text-right">
                          {dim.averageScore ?? '—'}
                        </span>
                        <span className="text-[10px] text-muted-foreground w-10 text-right">
                          {(dim.weight * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Distribution */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Threshold Distribution</h3>
                <div className="grid grid-cols-4 gap-2">
                  <DistributionBadge label="Excellent" count={data.distribution.excellent} color="text-ctp-green" bg="bg-ctp-green/10" />
                  <DistributionBadge label="Good" count={data.distribution.good} color="text-ctp-blue" bg="bg-ctp-blue/10" />
                  <DistributionBadge label="Fair" count={data.distribution.fair} color="text-ctp-yellow" bg="bg-ctp-yellow/10" />
                  <DistributionBadge label="Poor" count={data.distribution.poor} color="text-ctp-red" bg="bg-ctp-red/10" />
                </div>
              </div>

              {/* Trend Chart */}
              {data.trendData.length > 1 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Score Trend</h3>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.trendData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v: string) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          className="text-[10px]"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          className="text-[10px]"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <Tooltip
                          labelFormatter={(v) => new Date(String(v)).toLocaleDateString()}
                          formatter={(value) => [`${value}`, 'Score']}
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary) / 0.1)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Recent Tickets */}
              {data.recentTickets.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Recent Tickets</h3>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {data.recentTickets.map((ticket) => {
                      const colors = getScoreColor(ticket.score);
                      return (
                        <div key={ticket.ticketKey} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-medium">{ticket.ticketKey}</span>
                            <p className="text-xs text-muted-foreground truncate">{ticket.title}</p>
                          </div>
                          <span className={`text-xs font-medium ${colors.text} ${colors.bg} rounded-md px-2 py-0.5 ml-2 shrink-0`}>
                            {ticket.score}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TrendBadge({ trend, trendDelta }: { trend: 'up' | 'down' | 'stable'; trendDelta: number | null }) {
  const config = {
    up: { icon: TrendingUp, color: 'text-ctp-green', bg: 'bg-ctp-green/10' },
    down: { icon: TrendingDown, color: 'text-ctp-red', bg: 'bg-ctp-red/10' },
    stable: { icon: Minus, color: 'text-muted-foreground', bg: 'bg-muted' },
  };
  const { icon: Icon, color, bg } = config[trend];
  const delta = trendDelta !== null && trendDelta !== 0
    ? `${trendDelta > 0 ? '+' : ''}${trendDelta}`
    : '';

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${color} ${bg}`}>
      <Icon className="h-4 w-4" />
      {delta && <span className="text-xs font-medium">{delta}</span>}
    </div>
  );
}

function DistributionBadge({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <div className={`text-center rounded-md p-2 ${bg}`}>
      <span className={`text-lg font-bold ${color}`}>{count}</span>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
