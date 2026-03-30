'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getScoreColor } from '@/lib/quality-score';
import { DrawerStates } from './drawer-states';
import type { QualityGateModuleStatus } from '@/lib/health/types';

interface QualityGateDrawerContentProps {
  module: QualityGateModuleStatus;
}

export function QualityGateDrawerContent({ module }: QualityGateDrawerContentProps) {
  if (!module.detail) {
    return (
      <DrawerStates
        moduleType="QUALITY_GATE"
        moduleStatus={module}
        isScanning={false}
      />
    );
  }

  const { dimensions, recentTickets, trendData } = module.detail;

  return (
    <div className="space-y-6">
      {/* Dimensions Table */}
      <Card className="aurora-glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Quality Dimensions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {dimensions.map((dim) => {
              const scoreColors = dim.averageScore !== null ? getScoreColor(dim.averageScore) : null;
              return (
                <div key={dim.name} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{dim.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {dim.weight > 0 ? `${Math.round(dim.weight * 100)}%` : '—'}
                    </span>
                    {dim.averageScore !== null ? (
                      <span className={`font-medium ${scoreColors!.text}`}>
                        {dim.averageScore}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">---</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Tickets */}
      {recentTickets.length > 0 && (
        <Card className="aurora-glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Recent SHIP Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentTickets.map((ticket) => {
                const colors = getScoreColor(ticket.score);
                return (
                  <div key={ticket.ticketKey} className="flex items-center justify-between text-sm">
                    <div className="flex flex-col min-w-0 flex-1 mr-2">
                      <span className="font-mono text-xs text-muted-foreground">{ticket.ticketKey}</span>
                      <span className="text-foreground truncate">{ticket.title}</span>
                    </div>
                    <span className={`text-xs font-medium ${colors.text} ${colors.bg} rounded-md px-2 py-0.5 shrink-0`}>
                      {ticket.score} {ticket.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trend Chart */}
      {trendData.length > 0 && (
        <Card className="aurora-glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Score Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ left: 10, right: 10 }}>
                  <XAxis
                    dataKey="week"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    width={35}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                    formatter={(value) => [`${value}/100`, 'Avg Score']}
                    labelFormatter={(label) => `Week: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="averageScore"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-2))', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
