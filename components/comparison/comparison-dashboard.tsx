'use client';

import { useState } from 'react';
import {
  Trophy,
  GitCompare,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Code2,
  TestTube2,
  DollarSign,
  Clock,
  Minus,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getScoreColor, getScoreThreshold } from '@/lib/quality-score';
import type { EnrichedComparison, EnrichedComparisonEntry, DecisionPoint, CompliancePrinciple } from '@/lib/types/stored-comparison';

interface ComparisonDashboardProps {
  comparison: EnrichedComparison;
}

function formatDuration(ms: number | null): string {
  if (ms == null || ms <= 0) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  return `${minutes}m ${remainingSecs}s`;
}

function formatCost(cost: number | null): string {
  if (cost == null || cost <= 0) return 'N/A';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function testRatio(entry: EnrichedComparisonEntry): string {
  if (entry.sourceFiles === 0) return 'N/A';
  return `${Math.round((entry.testFiles / entry.sourceFiles) * 100)}%`;
}

/** Find the best (lowest) value for a numeric metric across entries */
function findBest(
  entries: EnrichedComparisonEntry[],
  getValue: (e: EnrichedComparisonEntry) => number | null,
  mode: 'max' | 'min' = 'max'
): string | null {
  let bestKey: string | null = null;
  let bestVal: number | null = null;
  for (const e of entries) {
    const val = getValue(e);
    if (val == null) continue;
    if (bestVal == null || (mode === 'max' ? val > bestVal : val < bestVal)) {
      bestVal = val;
      bestKey = e.ticketKey;
    }
  }
  return bestKey;
}

/** Metric bar for visual comparison */
function MetricBar({ value, maxValue, color }: { value: number; maxValue: number; color: string }) {
  const width = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div className="w-full bg-secondary/30 rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${width}%` }} />
    </div>
  );
}

/** Ranking section showing tickets ranked by score */
function RankingSection({ entries, winnerKey }: { entries: EnrichedComparisonEntry[]; winnerKey: string | null }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm text-muted-foreground uppercase tracking-wider font-bold flex items-center gap-2">
        <Trophy className="w-4 h-4" />
        Ranking
      </h3>
      <div className="space-y-2">
        {entries.map((entry) => {
          const isWinner = entry.ticketKey === winnerKey;
          const colors = getScoreColor(entry.score);
          const threshold = getScoreThreshold(entry.score);

          return (
            <Card
              key={entry.ticketKey}
              className={`border ${isWinner ? 'border-ctp-green bg-ctp-green/5' : 'border-border bg-card'}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg font-bold text-muted-foreground w-6 text-center shrink-0">
                      {entry.rank}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">
                          {entry.ticketKey}
                        </span>
                        {isWinner && (
                          <Badge className="bg-ctp-green/20 text-ctp-green border-ctp-green/30 text-xs">
                            Winner
                          </Badge>
                        )}
                        {entry.workflowType && (
                          <Badge variant="outline" className="text-xs">
                            {entry.workflowType}
                          </Badge>
                        )}
                        {entry.agent && (
                          <Badge variant="outline" className="text-xs">
                            {entry.agent}
                          </Badge>
                        )}
                      </div>
                      {entry.title && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {entry.title}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {entry.keyDifferentiator}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className={`text-2xl font-bold ${colors.text}`}>
                        {entry.score}
                      </span>
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.text} ${colors.bg}`}>
                      {threshold}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/** Metrics comparison section */
function MetricsSection({ entries }: { entries: EnrichedComparisonEntry[] }) {
  const maxLines = Math.max(...entries.map((e) => e.linesAdded + e.linesRemoved), 1);
  const maxFiles = Math.max(...entries.map((e) => e.sourceFiles), 1);
  const bestTestRatio = findBest(entries, (e) => e.sourceFiles > 0 ? e.testFiles / e.sourceFiles : null);
  const bestCost = findBest(entries, (e) => e.costUsd, 'min');

  return (
    <div className="space-y-3">
      <h3 className="text-sm text-muted-foreground uppercase tracking-wider font-bold flex items-center gap-2">
        <Code2 className="w-4 h-4" />
        Code Metrics
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Ticket</th>
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Lines Changed</th>
              <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                <span className="inline-flex items-center gap-1"><Code2 className="w-3 h-3" />Source</span>
              </th>
              <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                <span className="inline-flex items-center gap-1"><TestTube2 className="w-3 h-3" />Tests</span>
              </th>
              <th className="text-center py-2 px-3 text-muted-foreground font-medium">Test Ratio</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">
                <span className="inline-flex items-center gap-1"><DollarSign className="w-3 h-3" />Cost</span>
              </th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">
                <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />Duration</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isBestTest = entry.ticketKey === bestTestRatio;
              const isBestCost = entry.ticketKey === bestCost;

              return (
                <tr key={entry.ticketKey} className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium text-foreground">{entry.ticketKey}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <span className="text-ctp-green text-xs">+{entry.linesAdded}</span>
                      <span className="text-ctp-red text-xs">-{entry.linesRemoved}</span>
                      <MetricBar
                        value={entry.linesAdded + entry.linesRemoved}
                        maxValue={maxLines}
                        color="bg-ctp-blue"
                      />
                    </div>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span>{entry.sourceFiles}</span>
                      <MetricBar value={entry.sourceFiles} maxValue={maxFiles} color="bg-ctp-lavender" />
                    </div>
                  </td>
                  <td className="py-2 px-3 text-center">{entry.testFiles}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={isBestTest ? 'text-ctp-green font-semibold' : ''}>
                      {testRatio(entry)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className={isBestCost ? 'text-ctp-green font-semibold' : 'text-muted-foreground'}>
                      {formatCost(entry.costUsd)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-muted-foreground">
                    {formatDuration(entry.durationMs)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {entries.some((e) => e.qualityScore != null) && (
        <div className="mt-3">
          <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">Quality Scores</h4>
          <div className="flex gap-3 flex-wrap">
            {entries.map((entry) => {
              if (entry.qualityScore == null) {
                return (
                  <div key={entry.ticketKey} className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{entry.ticketKey}:</span>
                    <span className="text-muted-foreground italic">Pending</span>
                  </div>
                );
              }
              const colors = getScoreColor(entry.qualityScore);
              return (
                <div key={entry.ticketKey} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{entry.ticketKey}:</span>
                  <span className={`font-bold ${colors.text}`}>{entry.qualityScore}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Decision points section */
function DecisionPointsSection({ entries }: { entries: EnrichedComparisonEntry[] }) {
  // Collect all decision points from all entries
  const allDecisionPoints: DecisionPoint[] = [];
  for (const entry of entries) {
    if (entry.decisionPoints) {
      for (const dp of entry.decisionPoints) {
        if (!allDecisionPoints.find((d) => d.name === dp.name)) {
          allDecisionPoints.push(dp);
        }
      }
    }
  }

  if (allDecisionPoints.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm text-muted-foreground uppercase tracking-wider font-bold flex items-center gap-2">
        <GitCompare className="w-4 h-4" />
        Implementation Choices
      </h3>
      <div className="space-y-2">
        {allDecisionPoints.map((dp) => (
          <DecisionPointCard key={dp.name} decisionPoint={dp} entries={entries} />
        ))}
      </div>
    </div>
  );
}

function DecisionPointCard({ decisionPoint, entries }: { decisionPoint: DecisionPoint; entries: EnrichedComparisonEntry[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full text-left">
        <Card className="border-border bg-card hover:bg-secondary/50 transition-colors">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <span className="font-medium text-foreground text-sm">{decisionPoint.name}</span>
              </div>
              <Badge variant="outline" className="text-xs text-ctp-green border-ctp-green/30">
                Best: {decisionPoint.bestTicket}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 mt-1 space-y-1">
          {entries.map((entry) => {
            const approach = decisionPoint.approaches[entry.ticketKey];
            const isBest = entry.ticketKey === decisionPoint.bestTicket;
            return (
              <div
                key={entry.ticketKey}
                className={`text-sm rounded-md border px-3 py-2 ${
                  isBest ? 'border-ctp-green/30 bg-ctp-green/5' : 'border-border bg-card'
                }`}
              >
                <span className={`font-medium ${isBest ? 'text-ctp-green' : 'text-foreground'}`}>
                  {entry.ticketKey}:
                </span>{' '}
                <span className="text-muted-foreground">{approach || 'N/A'}</span>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground italic px-3 py-1">
            {decisionPoint.verdict}
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Constitution compliance section */
function ComplianceSection({ entries }: { entries: EnrichedComparisonEntry[] }) {
  // Collect all principle names across all entries
  const allPrinciples = new Map<string, { section: string; name: string }>();
  for (const entry of entries) {
    if (entry.compliancePrinciples) {
      for (const p of entry.compliancePrinciples) {
        if (!allPrinciples.has(p.section)) {
          allPrinciples.set(p.section, { section: p.section, name: p.name });
        }
      }
    }
  }

  if (allPrinciples.size === 0) return null;

  const principles = Array.from(allPrinciples.values());

  return (
    <div className="space-y-3">
      <h3 className="text-sm text-muted-foreground uppercase tracking-wider font-bold flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" />
        Constitution Compliance
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Principle</th>
              {entries.map((entry) => (
                <th key={entry.ticketKey} className="text-center py-2 px-3 text-muted-foreground font-medium">
                  {entry.ticketKey}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {principles.map((principle) => (
              <tr key={principle.section} className="border-b border-border/50">
                <td className="py-2 px-3 text-foreground">
                  <span className="text-muted-foreground text-xs mr-1">{principle.section}.</span>
                  {principle.name}
                </td>
                {entries.map((entry) => {
                  const ep = entry.compliancePrinciples?.find((p: CompliancePrinciple) => p.section === principle.section);
                  if (!ep) {
                    return (
                      <td key={entry.ticketKey} className="text-center py-2 px-3">
                        <Minus className="w-4 h-4 text-muted-foreground mx-auto" />
                      </td>
                    );
                  }
                  return (
                    <td key={entry.ticketKey} className="text-center py-2 px-3">
                      {ep.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-ctp-green mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-ctp-red mx-auto" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Overall compliance row */}
            <tr className="border-t border-border">
              <td className="py-2 px-3 font-semibold text-foreground">Overall</td>
              {entries.map((entry) => {
                const score = entry.complianceScore;
                if (score == null) {
                  return (
                    <td key={entry.ticketKey} className="text-center py-2 px-3 text-muted-foreground">
                      N/A
                    </td>
                  );
                }
                const colors = getScoreColor(score);
                return (
                  <td key={entry.ticketKey} className="text-center py-2 px-3">
                    <span className={`font-bold ${colors.text}`}>{score}%</span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Main comparison dashboard component */
export function ComparisonDashboard({ comparison }: ComparisonDashboardProps) {
  return (
    <ScrollArea className="h-[65vh] pr-4">
      <div className="space-y-6 pb-4">
        {/* Recommendation */}
        {comparison.recommendation && (
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-foreground">{comparison.recommendation}</p>
          </div>
        )}

        {/* Ranking */}
        <RankingSection
          entries={comparison.entries}
          winnerKey={comparison.winnerTicketKey}
        />

        {/* Metrics */}
        <MetricsSection entries={comparison.entries} />

        {/* Decision Points */}
        <DecisionPointsSection entries={comparison.entries} />

        {/* Constitution Compliance */}
        <ComplianceSection entries={comparison.entries} />
      </div>
    </ScrollArea>
  );
}
