'use client';

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PeakContextDistribution, PeakContextJob } from '@/lib/analytics/types';
import { getContextWindow } from '@/lib/telemetry/context-window';
import { getScoreThreshold } from '@/lib/quality-score';

type CommandFilter = 'all' | string;
type WorkflowFilter = 'all' | 'FULL' | 'QUICK';
type QualityBucket = 'all' | 'poor' | 'fair' | 'good' | 'excellent';

type BucketKey = '<20%' | '20-40%' | '40-60%' | '60-80%' | '80-95%' | '≥95%' | 'unknown';

const BUCKET_ORDER: BucketKey[] = [
  '<20%',
  '20-40%',
  '40-60%',
  '60-80%',
  '80-95%',
  '≥95%',
  'unknown',
];

// Static fill classes per bucket — no dynamic class construction (CLAUDE.md).
const BUCKET_FILLS: Record<BucketKey, string> = {
  '<20%': 'hsl(var(--chart-1))',
  '20-40%': 'hsl(var(--chart-1))',
  '40-60%': 'hsl(var(--chart-1))',
  '60-80%': 'hsl(var(--chart-2))',
  '80-95%': 'hsl(var(--chart-3))',
  '≥95%': 'hsl(var(--chart-3))',
  'unknown': 'hsl(var(--muted-foreground))',
};

function bucketFor(job: PeakContextJob): BucketKey {
  if (job.peakContextTokens == null) {
    return 'unknown';
  }
  const window = getContextWindow(job.model);
  if (window == null || window <= 0) {
    return 'unknown';
  }
  const ratio = job.peakContextTokens / window;
  if (ratio < 0.2) return '<20%';
  if (ratio < 0.4) return '20-40%';
  if (ratio < 0.6) return '40-60%';
  if (ratio < 0.8) return '60-80%';
  if (ratio < 0.95) return '80-95%';
  return '≥95%';
}

function qualityToBucket(score: number | null): QualityBucket | null {
  if (score == null) return null;
  const label = getScoreThreshold(score);
  if (label === 'Excellent') return 'excellent';
  if (label === 'Good') return 'good';
  if (label === 'Fair') return 'fair';
  return 'poor';
}

interface PeakContextDistributionChartProps {
  data: PeakContextDistribution;
}

export function PeakContextDistributionChart({ data }: PeakContextDistributionChartProps) {
  const [command, setCommand] = useState<CommandFilter>('all');
  const [workflowType, setWorkflowType] = useState<WorkflowFilter>('all');
  const [qualityBucket, setQualityBucket] = useState<QualityBucket>('all');

  const commandOptions = useMemo(() => {
    return Array.from(new Set(data.jobs.map((job) => job.command))).sort();
  }, [data.jobs]);

  const filteredJobs = useMemo(() => {
    return data.jobs.filter((job) => {
      if (command !== 'all' && job.command !== command) return false;
      if (workflowType !== 'all' && job.workflowType !== workflowType) return false;
      if (qualityBucket !== 'all') {
        const bucket = qualityToBucket(job.qualityScore);
        if (bucket !== qualityBucket) return false;
      }
      return true;
    });
  }, [data.jobs, command, workflowType, qualityBucket]);

  const chartData = useMemo(() => {
    const counts = new Map<BucketKey, number>(BUCKET_ORDER.map((b) => [b, 0]));
    for (const job of filteredJobs) {
      const bucket = bucketFor(job);
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    return BUCKET_ORDER.map((bucket) => ({
      bucket,
      count: counts.get(bucket) ?? 0,
      fill: BUCKET_FILLS[bucket],
    }));
  }, [filteredJobs]);

  const renderEmpty = (message: string) => (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="text-base text-foreground">Peak Context Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          {message}
        </div>
      </CardContent>
    </Card>
  );

  if (!data.hasData) {
    return renderEmpty('No per-turn data for this selection yet');
  }

  if (filteredJobs.length === 0) {
    return renderEmpty('No matching jobs');
  }

  if (filteredJobs.every((job) => job.peakContextTokens == null)) {
    return renderEmpty('No per-turn data for this selection yet');
  }

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="text-base text-foreground">Peak Context Distribution</CardTitle>
        <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-3">
          <Select value={command} onValueChange={(value) => setCommand(value)}>
            <SelectTrigger data-testid="peak-context-command-filter">
              <SelectValue placeholder="Command" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All commands</SelectItem>
              {commandOptions.map((cmd) => (
                <SelectItem key={cmd} value={cmd}>
                  {cmd}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={workflowType}
            onValueChange={(value) => setWorkflowType(value as WorkflowFilter)}
          >
            <SelectTrigger data-testid="peak-context-workflow-filter">
              <SelectValue placeholder="Workflow" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All workflows</SelectItem>
              <SelectItem value="FULL">Full</SelectItem>
              <SelectItem value="QUICK">Quick</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={qualityBucket}
            onValueChange={(value) => setQualityBucket(value as QualityBucket)}
          >
            <SelectTrigger data-testid="peak-context-quality-filter">
              <SelectValue placeholder="Quality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All quality</SelectItem>
              <SelectItem value="poor">Poor</SelectItem>
              <SelectItem value="fair">Fair</SelectItem>
              <SelectItem value="good">Good</SelectItem>
              <SelectItem value="excellent">Excellent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 10, right: 10 }}>
              <XAxis
                dataKey="bucket"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                allowDecimals={false}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                width={40}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0];
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="font-medium">{item?.payload?.bucket}</p>
                      <p className="text-sm text-muted-foreground">
                        {item?.value as number} job{item?.value === 1 ? '' : 's'}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
