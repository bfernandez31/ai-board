'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  GitCompare,
  History,
  Trophy,
  XCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import {
  useComparisonCheck,
  useComparisonList,
  useComparisonReport,
} from '@/hooks/use-comparisons';
import type { ComparisonViewerProps } from './types';
import type {
  ComparisonDetail,
  ComparisonQualityScoreSummary,
  ComparisonTicketView,
} from '@/lib/types/comparison';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value: number): string {
  return value > 0 ? `$${value.toFixed(2)}` : 'N/A';
}

function formatDuration(durationMs: number): string {
  if (durationMs <= 0) return 'N/A';
  if (durationMs < 60_000) return `${Math.round(durationMs / 1000)}s`;
  return `${(durationMs / 60_000).toFixed(1)}m`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function renderQualityScore(qualityScore: ComparisonQualityScoreSummary): string {
  if (qualityScore.score == null) return 'Pending';
  return `${qualityScore.score}`;
}

function getStatusTone(status: 'pass' | 'warning' | 'fail'): string {
  if (status === 'pass') return 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30';
  if (status === 'warning') return 'bg-amber-500/15 text-amber-100 border-amber-400/30';
  return 'bg-rose-500/15 text-rose-100 border-rose-400/30';
}

interface MetricDefinition {
  key: string;
  label: string;
  getValue: (ticket: ComparisonTicketView) => number | null;
  renderValue: (ticket: ComparisonTicketView) => string;
  higherIsBetter: boolean;
}

const metricDefinitions: MetricDefinition[] = [
  {
    key: 'score',
    label: 'Comparison Score',
    getValue: (ticket) => ticket.score,
    renderValue: (ticket) => `${ticket.score}`,
    higherIsBetter: true,
  },
  {
    key: 'quality',
    label: 'Quality Score',
    getValue: (ticket) => ticket.qualityScore.score,
    renderValue: (ticket) => renderQualityScore(ticket.qualityScore),
    higherIsBetter: true,
  },
  {
    key: 'constitution',
    label: 'Constitution',
    getValue: (ticket) => ticket.constitution.overall,
    renderValue: (ticket) => `${ticket.constitution.overall}%`,
    higherIsBetter: true,
  },
  {
    key: 'testRatio',
    label: 'Test Ratio',
    getValue: (ticket) => ticket.metrics.testRatio,
    renderValue: (ticket) => formatPercent(ticket.metrics.testRatio),
    higherIsBetter: true,
  },
  {
    key: 'cost',
    label: 'Cost',
    getValue: (ticket) => (ticket.telemetry.hasData ? ticket.telemetry.costUsd : null),
    renderValue: (ticket) => formatCurrency(ticket.telemetry.costUsd),
    higherIsBetter: false,
  },
  {
    key: 'duration',
    label: 'Duration',
    getValue: (ticket) => (ticket.telemetry.hasData ? ticket.telemetry.durationMs : null),
    renderValue: (ticket) => formatDuration(ticket.telemetry.durationMs),
    higherIsBetter: false,
  },
];

function getBestTicketIds(
  tickets: ComparisonTicketView[],
  metric: MetricDefinition
): Set<number> {
  const values = tickets
    .map((ticket) => ({
      ticketId: ticket.ticketId,
      value: metric.getValue(ticket),
    }))
    .filter((entry): entry is { ticketId: number; value: number } => entry.value != null);

  if (values.length === 0) return new Set<number>();

  const bestValue = metric.higherIsBetter
    ? Math.max(...values.map((entry) => entry.value))
    : Math.min(...values.map((entry) => entry.value));

  return new Set(
    values
      .filter((entry) => entry.value === bestValue)
      .map((entry) => entry.ticketId)
  );
}

function MetricComparison({ comparison }: { comparison: ComparisonDetail }) {
  const scaleMax = useMemo(() => {
    const maxima = new Map<string, number>();
    for (const metric of metricDefinitions) {
      const values = comparison.tickets
        .map((ticket) => metric.getValue(ticket))
        .filter((value): value is number => value != null);
      maxima.set(metric.key, values.length > 0 ? Math.max(...values) : 0);
    }
    return maxima;
  }, [comparison.tickets]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">Metrics Comparison</h3>
        <p className="text-xs text-muted-foreground">Best values highlighted per metric.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {metricDefinitions.map((metric) => {
          const bestTicketIds = getBestTicketIds(comparison.tickets, metric);
          const maxValue = scaleMax.get(metric.key) ?? 0;

          return (
            <div
              key={metric.key}
              className="rounded-xl border border-border bg-card/80 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-medium text-foreground">{metric.label}</h4>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {metric.higherIsBetter ? 'Higher is better' : 'Lower is better'}
                </span>
              </div>
              <div className="space-y-3">
                {comparison.tickets.map((ticket) => {
                  const rawValue = metric.getValue(ticket);
                  const width = rawValue != null && maxValue > 0 ? (rawValue / maxValue) * 100 : 0;
                  const isBest = bestTicketIds.has(ticket.ticketId);

                  return (
                    <div key={`${metric.key}-${ticket.ticketId}`} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{ticket.ticketKey}</span>
                          {isBest && (
                            <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-100">
                              Best
                            </Badge>
                          )}
                        </div>
                        <span className="text-muted-foreground">{metric.renderValue(ticket)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary/70">
                        <div
                          className={`h-2 rounded-full ${
                            isBest ? 'bg-emerald-400' : 'bg-primary'
                          }`}
                          style={{ width: `${Math.max(width, rawValue != null ? 8 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RankingSection({ comparison }: { comparison: ComparisonDetail }) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-secondary/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4 text-primary" />
              <span>Winner</span>
            </div>
            <div className="text-3xl font-semibold text-foreground">
              {comparison.winnerTicket?.ticketKey ?? 'Pending'}
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {comparison.recommendation}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background/60 px-4 py-3 text-sm">
            <div className="text-muted-foreground">Generated</div>
            <div className="font-medium text-foreground">{formatDate(comparison.generatedAt)}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-foreground">Ranking</h3>
          <p className="text-xs text-muted-foreground">{comparison.summary}</p>
        </div>
        <div className="grid gap-3">
          {comparison.tickets.map((ticket) => {
            const isWinner = comparison.winnerTicket?.id === ticket.ticketId;
            return (
              <div
                key={ticket.ticketId}
                className={`rounded-xl border p-4 ${
                  isWinner
                    ? 'border-primary/40 bg-primary/10'
                    : 'border-border bg-card/80'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-secondary text-foreground">
                        #{ticket.rank}
                      </Badge>
                      <span className="text-lg font-semibold text-foreground">{ticket.ticketKey}</span>
                      {isWinner && (
                        <Badge className="border-primary/30 bg-primary text-primary-foreground">
                          Winner
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{ticket.verdictSummary}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{ticket.agent ?? 'Agent N/A'}</span>
                      <span>{ticket.workflowType}</span>
                      <span>{ticket.stage}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Score</div>
                    <div className="text-3xl font-semibold text-foreground">{ticket.score}</div>
                  </div>
                </div>
                {ticket.keyDifferentiators.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ticket.keyDifferentiators.map((item) => (
                      <Badge
                        key={`${ticket.ticketId}-${item}`}
                        variant="secondary"
                        className="bg-secondary/70 text-foreground"
                      >
                        {item}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DecisionPointsSection({ comparison }: { comparison: ComparisonDetail }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">Decision Points</h3>
        <p className="text-xs text-muted-foreground">Collapsible implementation trade-offs.</p>
      </div>
      <div className="space-y-3">
        {comparison.decisionPoints.map((decisionPoint, index) => (
          <Collapsible
            key={`${decisionPoint.title}-${index}`}
            className="rounded-xl border border-border bg-card/80"
            defaultOpen={index === 0}
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
              <div>
                <div className="font-medium text-foreground">{decisionPoint.title}</div>
                <div className="text-sm text-muted-foreground">{decisionPoint.verdict}</div>
              </div>
              <Badge variant="secondary" className="bg-secondary text-foreground">
                {decisionPoint.approaches.length} approaches
              </Badge>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border px-4 py-4">
              <div className="space-y-3">
                {decisionPoint.approaches.map((approach) => {
                  const ticket = comparison.tickets.find(
                    (candidate) => candidate.ticketId === approach.ticketId
                  );
                  const isBest = decisionPoint.winningTicketId === approach.ticketId;

                  return (
                    <div
                      key={`${decisionPoint.title}-${approach.ticketId}`}
                      className={`rounded-lg border p-3 ${
                        isBest
                          ? 'border-emerald-400/30 bg-emerald-500/10'
                          : 'border-border bg-background/60'
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {ticket?.ticketKey ?? `Ticket ${approach.ticketId}`}
                        </span>
                        {isBest && (
                          <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-100">
                            Best
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-foreground">{approach.approach}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{approach.rationale}</div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </section>
  );
}

function ConstitutionSection({ comparison }: { comparison: ComparisonDetail }) {
  const principleNames = Array.from(
    new Set(
      comparison.tickets.flatMap((ticket) =>
        ticket.constitution.principles.map((principle) => principle.principle)
      )
    )
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">Constitution Compliance</h3>
        <p className="text-xs text-muted-foreground">Per-principle comparison across tickets.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card/80">
        <table className="min-w-full text-sm">
          <thead className="bg-secondary/60">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-foreground">Principle</th>
              {comparison.tickets.map((ticket) => (
                <th
                  key={`constitution-head-${ticket.ticketId}`}
                  className="px-4 py-3 text-left font-medium text-foreground"
                >
                  {ticket.ticketKey}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {principleNames.map((principleName) => (
              <tr key={principleName} className="border-t border-border">
                <td className="px-4 py-3 align-top text-muted-foreground">{principleName}</td>
                {comparison.tickets.map((ticket) => {
                  const principle = ticket.constitution.principles.find(
                    (candidate) => candidate.principle === principleName
                  );

                  return (
                    <td key={`${principleName}-${ticket.ticketId}`} className="px-4 py-3 align-top">
                      {principle ? (
                        <div className="space-y-2">
                          <Badge className={getStatusTone(principle.status)}>
                            {principle.status}
                          </Badge>
                          <div className="text-sm text-muted-foreground">{principle.summary}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">N/A</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ComparisonDashboard({ comparison }: { comparison: ComparisonDetail }) {
  return (
    <div className="space-y-6">
      <RankingSection comparison={comparison} />
      <MetricComparison comparison={comparison} />
      <DecisionPointsSection comparison={comparison} />
      <ConstitutionSection comparison={comparison} />
    </div>
  );
}

export function ComparisonViewer({
  projectId,
  ticketId,
  selectedReport,
  onClose,
  isOpen,
}: ComparisonViewerProps) {
  const [reportOverride, setReportOverride] = useState<string | undefined>();
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();

  const {
    data: checkData,
    isLoading: checkLoading,
    error: checkError,
  } = useComparisonCheck(projectId, ticketId, isOpen);

  const {
    data: listData,
    isLoading: listLoading,
  } = useComparisonList(projectId, ticketId, 10, isOpen && showHistory);

  const currentReport = reportOverride ?? selectedReport ?? checkData?.latestReport ?? '';

  const {
    data: reportData,
    isLoading: reportLoading,
    error: reportError,
  } = useComparisonReport(projectId, ticketId, currentReport, isOpen && !!currentReport);

  useEffect(() => {
    if ((checkError || reportError) && isOpen) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: checkError?.message || reportError?.message || 'Failed to load comparison',
      });
    }
  }, [checkError, reportError, isOpen, toast]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setShowHistory(false);
      setReportOverride(undefined);
      onClose?.();
    }
  };

  const isLoading = checkLoading || reportLoading;
  const hasNoComparisons = checkData && !checkData.hasComparisons;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl border-border bg-background sm:max-w-[92vw]">
        <DialogHeader className="pr-12">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <GitCompare className="h-5 w-5" />
                Ticket Comparison
              </DialogTitle>
              <DialogDescription>
                Structured comparison view for ranking, metrics, implementation choices, and constitution compliance.
              </DialogDescription>
            </div>

            {reportData?.comparison && !showHistory && checkData && checkData.count > 1 && (
              <Button variant="outline" size="sm" onClick={() => setShowHistory(true)}>
                <History className="mr-2 h-4 w-4" />
                History ({checkData.count})
              </Button>
            )}

            {showHistory && (
              <Button variant="outline" size="sm" onClick={() => setShowHistory(false)}>
                Back to Comparison
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="mt-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Loading comparison...
            </div>
          )}

          {hasNoComparisons && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertTriangle className="mb-4 h-12 w-12 opacity-50" />
              <p className="text-lg font-medium text-foreground">No Comparisons Available</p>
              <p className="mt-2 text-sm">
                Use `@ai-board /compare` in a comment to generate a comparison.
              </p>
            </div>
          )}

          {(checkError || reportError) && !reportData && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <XCircle className="mb-4 h-12 w-12 opacity-50" />
              <p className="text-lg font-medium">Error Loading Comparison</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {checkError?.message || reportError?.message}
              </p>
            </div>
          )}

          {reportData?.comparison && !showHistory && (
            <ScrollArea className="h-[68vh] pr-4">
              <ComparisonDashboard comparison={reportData.comparison} />
            </ScrollArea>
          )}

          {showHistory && (
            <div className="flex h-[60vh] flex-col">
              <h3 className="mb-4 text-lg font-semibold text-foreground">Comparison History</h3>

              {listLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  Loading history...
                </div>
              ) : listData?.comparisons && listData.comparisons.length > 0 ? (
                <ScrollArea className="flex-1">
                  <div className="space-y-2">
                    {listData.comparisons.map((comparison) => (
                      <button
                        key={comparison.filename}
                        onClick={() => {
                          setReportOverride(comparison.filename);
                          setShowHistory(false);
                        }}
                        className={`w-full rounded-lg border p-4 text-left transition-colors ${
                          currentReport === comparison.filename
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-card hover:bg-secondary/50'
                        }`}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <GitCompare className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">
                            vs {comparison.comparedTickets.join(', ')}
                          </span>
                          {comparison.winnerTicketKey && (
                            <Badge className="border-primary/20 bg-primary/10 text-foreground">
                              Winner {comparison.winnerTicketKey}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(comparison.generatedAt)}
                        </div>
                        {currentReport === comparison.filename && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                            <CheckCircle className="h-3 w-3" />
                            Currently viewing
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <History className="mb-4 h-12 w-12 opacity-50" />
                  <p>No comparison history available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ComparisonViewer;
