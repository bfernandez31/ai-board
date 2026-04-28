'use client';

import { useState } from 'react';
import { Loader2, Shield, AlertTriangle, RefreshCw, Snowflake, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTicketAnalysis } from '@/app/lib/hooks/queries/useTicketAnalysis';
import { useToast } from '@/hooks/use-toast';
import { AnchorCitationList } from './anchor-citation-list';
import { DescriptionChangedBanner } from './description-changed-banner';
import { InboxAnalysisButton } from './inbox-analysis-button';
import type { SerializedAnchor, SerializedAnalysisDTO } from '@/lib/analysis/serialize';
import type { AnalysisOutput, FrictionRisk, Confidence } from '@/lib/analysis/output-schema';

export interface InboxAnalysisPanelProps {
  projectId: number;
  ticketId: number;
  triggerable: boolean;
}

function frictionRiskClasses(risk: FrictionRisk): string {
  switch (risk) {
    case 'low':
      return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
    case 'medium':
      return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
    case 'high':
      return 'bg-red-500/15 text-red-600 border-red-500/30';
  }
}

function confidenceClasses(confidence: Confidence): string {
  switch (confidence) {
    case 'low':
      return 'bg-zinc-500/15 text-zinc-600 border-zinc-500/30';
    case 'medium':
      return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
    case 'high':
      return 'bg-violet-500/15 text-violet-600 border-violet-500/30';
  }
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

async function postAnalysisTrigger(projectId: number, ticketId: number): Promise<Response> {
  return fetch(`/api/projects/${projectId}/tickets/${ticketId}/analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
}

interface SuccessOutput extends Omit<AnalysisOutput, 'anchors'> {
  anchors: SerializedAnchor[];
}

interface ColdStartOutput {
  scopeWarnings: AnalysisOutput['scopeWarnings'];
}

function isSuccessOutput(latest: SerializedAnalysisDTO): latest is SerializedAnalysisDTO & { output: SuccessOutput } {
  return latest.status === 'success' && latest.output !== null && 'frictionRisk' in latest.output;
}

function isColdStartOutput(latest: SerializedAnalysisDTO): latest is SerializedAnalysisDTO & { output: ColdStartOutput } {
  return latest.status === 'cold_start' && latest.output !== null;
}

export function InboxAnalysisPanel({
  projectId,
  ticketId,
  triggerable,
}: InboxAnalysisPanelProps) {
  const [isPending, setIsPending] = useState(false);
  const { data, isLoading, refetch } = useTicketAnalysis(projectId, ticketId);
  const { toast } = useToast();

  const handleTrigger = async () => {
    setIsPending(true);
    try {
      const res = await postAnalysisTrigger(projectId, ticketId);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({
          title: 'Analysis failed to start',
          description: body?.error ?? `HTTP ${res.status}`,
          variant: 'destructive',
        });
      } else {
        await refetch();
      }
    } catch (e) {
      toast({
        title: 'Analysis failed to start',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsPending(false);
    }
  };

  const latest = data?.latest ?? null;
  const eligibility = data?.eligibility ?? {
    triggerable,
    estimatedCostUsd: { lower: 0, upper: 0 },
    rateLimit: { limitPerHour: 10, remaining: 10, nextResetAt: null },
  };
  const showBanner = !!latest && latest.stale && latest.status !== 'running';

  if (isLoading && !data) {
    return <div className="mb-6" data-testid="inbox-analysis-panel" />;
  }

  return (
    <div className="mb-6 space-y-3" data-testid="inbox-analysis-panel">
      {showBanner && (
        <DescriptionChangedBanner onReanalyze={handleTrigger} disabled={isPending} />
      )}

      {triggerable && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs font-medium uppercase tracking-wider">Inbox analysis</span>
          </div>
          <InboxAnalysisButton
            triggerable={triggerable}
            estimatedCostUsd={eligibility.estimatedCostUsd}
            rateLimit={eligibility.rateLimit}
            onTrigger={handleTrigger}
            isPending={isPending}
            busy={latest?.status === 'running'}
          />
        </div>
      )}

      {!latest && !triggerable && (
        <p className="text-sm text-muted-foreground" data-testid="analysis-empty">
          No analysis available.
        </p>
      )}

      {latest?.status === 'running' && (
        <Card className="aurora-bg-card-blue border-ctp-mauve/15" aria-busy="true">
          <CardContent className="flex items-center gap-3 p-4">
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
            <span className="text-sm text-foreground">Running analysis…</span>
          </CardContent>
        </Card>
      )}

      {latest?.status === 'failed' && (
        <Card className="border-red-500/30">
          <CardContent className="flex items-start gap-3 p-4" role="alert">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" aria-hidden="true" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-foreground">Analysis failed</p>
              <p className="text-xs text-muted-foreground">
                {latest.errorMessage ?? latest.errorReason ?? 'Unknown error'}
              </p>
              {triggerable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTrigger}
                  disabled={isPending}
                  data-testid="analysis-retry"
                  aria-label="Retry analysis"
                >
                  <RefreshCw className="mr-2 h-3 w-3" aria-hidden="true" /> Retry
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {latest && isColdStartOutput(latest) && (
        <Card className="aurora-bg-card-blue border-ctp-mauve/15" data-testid="analysis-cold-start">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Snowflake className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs font-medium uppercase tracking-wider">Cold start</span>
            </div>
            <p className="text-sm text-foreground">
              Not enough comparable shipped tickets in the same domain yet — numeric ranges are not shown.
            </p>
            {latest.output.scopeWarnings.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-foreground" data-testid="scope-warnings">
                {latest.output.scopeWarnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No scope warnings.</p>
            )}
          </CardContent>
        </Card>
      )}

      {latest && isSuccessOutput(latest) && (
        <Card className="aurora-bg-card-blue border-ctp-mauve/15" data-testid="analysis-success">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-medium uppercase tracking-wider">Friction risk</span>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${frictionRiskClasses(latest.output.frictionRisk)}`}
                data-testid="friction-risk-badge"
                aria-label={`Friction risk ${latest.output.frictionRisk}`}
              >
                {latest.output.frictionRisk}
              </span>

              <span
                className={`ml-auto rounded-full border px-3 py-1 text-xs font-semibold ${confidenceClasses(latest.output.recommendation.confidence)}`}
                data-testid="confidence-badge"
                aria-label={`Recommendation confidence ${latest.output.recommendation.confidence}`}
              >
                {latest.output.recommendation.confidence} confidence
              </span>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Quality gate range</p>
              <p className="text-sm text-foreground" data-testid="quality-gate-range">
                {latest.output.qualityGateRange.lower}–{latest.output.qualityGateRange.upper} / 100
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Recommendation</p>
              <p className="text-sm font-semibold text-foreground" data-testid="recommendation-choice">
                {latest.output.recommendation.choice}
              </p>
              <p className="text-sm text-muted-foreground" data-testid="recommendation-justification">
                {latest.output.recommendation.justification}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Cost range</p>
              <p className="text-sm text-foreground" data-testid="cost-range">
                Baseline {formatUsd(latest.output.costRange.baselineLowerUsd)}–
                {formatUsd(latest.output.costRange.baselineUpperUsd)} · Marginal friction{' '}
                {formatUsd(latest.output.costRange.marginalFrictionLowerUsd)}–
                {formatUsd(latest.output.costRange.marginalFrictionUpperUsd)}
              </p>
            </div>

            {latest.output.scopeWarnings.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Scope warnings</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-foreground" data-testid="scope-warnings">
                  {latest.output.scopeWarnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Anchors</p>
              <AnchorCitationList projectId={projectId} anchors={latest.output.anchors} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
