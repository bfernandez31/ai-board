'use client';

import { useState } from 'react';
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  RefreshCcw,
  Snowflake,
  ChevronDown,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTicketAnalysis } from '@/app/lib/hooks/queries/useTicketAnalysis';
import { useToast } from '@/hooks/use-toast';
import { AnchorCitationList } from './anchor-citation-list';
import { InboxAnalysisButton } from './inbox-analysis-button';
import type { SerializedAnchor, SerializedAnalysisDTO } from '@/lib/analysis/serialize';
import type {
  AnalysisOutput,
  Confidence,
  FrictionRisk,
  Recommendation,
} from '@/lib/analysis/output-schema';

export interface InboxAnalysisPanelProps {
  projectId: number;
  ticketId: number;
  triggerable: boolean;
}

const RECOMMENDATION_TOOLTIP =
  'QUICK runs a fast-track build that skips the formal spec/plan steps — preferred for small, low-risk changes. FULL runs the full SPECIFY → PLAN → BUILD workflow — preferred when scope, risk, or quality friction is higher.';

const FRICTION_RISK_TOOLTIP =
  'Estimated implementation difficulty, derived from how much friction similar shipped tickets (anchors) hit during build/verify.';

const CONFIDENCE_TOOLTIP =
  'How confident the recommendation is, based on how many similar shipped tickets (anchors) were found.';

const STALE_TOOLTIP =
  'The ticket description has changed since this analysis ran — re-analyze for an up-to-date signal.';

function recommendationClasses(choice: Recommendation): string {
  return choice === 'QUICK'
    ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
    : 'bg-violet-500/15 text-violet-600 border-violet-500/30';
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

function formatTimestamp(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: false });
  } catch {
    return '';
  }
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

function isSuccessOutput(
  latest: SerializedAnalysisDTO
): latest is SerializedAnalysisDTO & { output: SuccessOutput } {
  return latest.status === 'success' && latest.output !== null && 'frictionRisk' in latest.output;
}

function isColdStartOutput(
  latest: SerializedAnalysisDTO
): latest is SerializedAnalysisDTO & { output: ColdStartOutput } {
  return latest.status === 'cold_start' && latest.output !== null;
}

function ChipTooltip({
  children,
  content,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-xs text-left">{content}</TooltipContent>
    </Tooltip>
  );
}

export function InboxAnalysisPanel({
  projectId,
  ticketId,
  triggerable,
}: InboxAnalysisPanelProps) {
  const [isPending, setIsPending] = useState(false);
  const [expanded, setExpanded] = useState(false);
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
  const showCostLabel = !!data;
  const stale = !!latest?.stale && latest.status !== 'running' && triggerable;

  if (!latest && !triggerable) {
    return null;
  }

  if (!latest && triggerable) {
    return (
      <div
        className="mb-6 flex items-center justify-end"
        data-testid="inbox-analysis-panel"
      >
        <InboxAnalysisButton
          triggerable={triggerable}
          estimatedCostUsd={eligibility.estimatedCostUsd}
          rateLimit={eligibility.rateLimit}
          onTrigger={handleTrigger}
          isPending={isPending || (isLoading && !data)}
          showCost={showCostLabel}
        />
      </div>
    );
  }

  if (!latest) return null;

  const isExpandable =
    latest.status === 'success' || latest.status === 'cold_start';

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mb-6" data-testid="inbox-analysis-panel">
        {latest.status === 'running' && (
          <div
            className="flex h-8 items-center gap-2 text-xs text-muted-foreground"
            aria-busy="true"
            data-testid="analysis-running-row"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
            <span>Analyzing…</span>
          </div>
        )}

        {latest.status === 'failed' && (
          <div
            className="flex h-8 items-center gap-2 text-xs"
            role="alert"
            data-testid="analysis-failed-row"
          >
            <ChipTooltip
              content={latest.errorMessage ?? latest.errorReason ?? 'Unknown error'}
            >
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Show analysis error"
                data-testid="analysis-failed-icon"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
              </button>
            </ChipTooltip>
            <span className="text-foreground">Analysis failed</span>
            {triggerable && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleTrigger}
                disabled={isPending}
                data-testid="analysis-retry"
                aria-label="Retry analysis"
                className="h-7 gap-1.5 px-2 text-xs"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" /> Retry
              </Button>
            )}
          </div>
        )}

        {isColdStartOutput(latest) && (
          <CollapsibleRow
            expanded={expanded}
            onToggle={() => setExpanded((e) => !e)}
            isExpandable={isExpandable}
            collapsed={
              <div
                className="flex h-8 items-center gap-2 text-xs"
                data-testid="analysis-cold-start-row"
              >
                <Snowflake
                  className="h-3.5 w-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="text-foreground">
                  Cold start — not enough comparable tickets
                </span>
              </div>
            }
          >
            <div
              className="mt-2 space-y-2 rounded-md border border-border bg-card/50 p-3 text-sm"
              data-testid="analysis-cold-start"
            >
              <p className="text-muted-foreground">
                Not enough comparable shipped tickets in the same domain yet — numeric
                ranges are not shown.
              </p>
              {latest.output.scopeWarnings.length > 0 ? (
                <ul
                  className="list-disc space-y-1 pl-5 text-foreground"
                  data-testid="scope-warnings"
                >
                  {latest.output.scopeWarnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No scope warnings.</p>
              )}
            </div>
          </CollapsibleRow>
        )}

        {isSuccessOutput(latest) && (
          <CollapsibleRow
            expanded={expanded}
            onToggle={() => setExpanded((e) => !e)}
            isExpandable={isExpandable}
            collapsed={
              <SuccessRow
                latest={latest}
                stale={stale}
                triggerable={triggerable}
                onReanalyze={handleTrigger}
                isPending={isPending}
              />
            }
          >
            <SuccessExpanded latest={latest} projectId={projectId} />
          </CollapsibleRow>
        )}
      </div>
    </TooltipProvider>
  );
}

function CollapsibleRow({
  collapsed,
  children,
  expanded,
  onToggle,
  isExpandable,
}: {
  collapsed: React.ReactNode;
  children: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  isExpandable: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{collapsed}</div>
        {isExpandable && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse analysis details' : 'Expand analysis details'}
            data-testid="analysis-expand-toggle"
            className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>
      {expanded && isExpandable && (
        <div data-testid="analysis-expanded">{children}</div>
      )}
    </div>
  );
}

function SuccessRow({
  latest,
  stale,
  triggerable,
  onReanalyze,
  isPending,
}: {
  latest: SerializedAnalysisDTO & { output: SuccessOutput };
  stale: boolean;
  triggerable: boolean;
  onReanalyze: () => void;
  isPending: boolean;
}) {
  const { recommendation, frictionRisk } = latest.output;
  const endedAt = latest.endedAt;
  const relative = formatRelative(endedAt);
  const cost = latest.telemetry.costUsd;
  const metaTooltip = (
    <div className="space-y-0.5">
      <div>{formatTimestamp(endedAt)}</div>
      <div className="text-primary-foreground/80">
        {cost !== null ? `Cost: ${formatUsd(cost)}` : 'Cost: n/a'}
      </div>
    </div>
  );

  return (
    <div
      className="flex h-8 items-center gap-2 text-xs"
      data-testid="analysis-success-row"
    >
      {stale && (
        <ChipTooltip content={STALE_TOOLTIP}>
          <span
            data-testid="analysis-stale-indicator"
            className="inline-flex items-center text-amber-500"
            aria-label="Analysis is out of date"
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </ChipTooltip>
      )}

      <ChipTooltip content={RECOMMENDATION_TOOLTIP}>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${recommendationClasses(recommendation.choice)}`}
          data-testid="recommendation-chip"
          aria-label={`Recommendation ${recommendation.choice}`}
          tabIndex={0}
        >
          {recommendation.choice}
        </span>
      </ChipTooltip>

      <ChipTooltip content={FRICTION_RISK_TOOLTIP}>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${frictionRiskClasses(frictionRisk)}`}
          data-testid="friction-risk-badge"
          aria-label={`Friction risk ${frictionRisk}`}
          tabIndex={0}
        >
          {frictionRisk} friction
        </span>
      </ChipTooltip>

      <ChipTooltip content={CONFIDENCE_TOOLTIP}>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${confidenceClasses(recommendation.confidence)}`}
          data-testid="confidence-badge"
          aria-label={`Recommendation confidence ${recommendation.confidence}`}
          tabIndex={0}
        >
          {recommendation.confidence} confidence
        </span>
      </ChipTooltip>

      {relative && (
        <ChipTooltip content={metaTooltip}>
          <span
            className="ml-2 text-muted-foreground"
            data-testid="analysis-meta"
            tabIndex={0}
          >
            analyzed {relative} ago
          </span>
        </ChipTooltip>
      )}

      {stale && triggerable && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onReanalyze}
          disabled={isPending}
          data-testid="reanalyze-button"
          aria-label="Re-analyze ticket"
          className="ml-auto h-7 gap-1.5 px-2 text-xs"
        >
          <RefreshCcw className="h-3 w-3" aria-hidden="true" />
          Re-analyze
        </Button>
      )}
    </div>
  );
}

function SuccessExpanded({
  latest,
  projectId,
}: {
  latest: SerializedAnalysisDTO & { output: SuccessOutput };
  projectId: number;
}) {
  const { recommendation, qualityGateRange, costRange, scopeWarnings, anchors } = latest.output;

  return (
    <div
      className="mt-2 space-y-3 rounded-md border border-border bg-card/50 p-3 text-sm"
      data-testid="analysis-success"
    >
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Recommendation
        </p>
        <p className="text-sm font-semibold text-foreground" data-testid="recommendation-choice">
          {recommendation.choice}
        </p>
        <p className="text-sm text-muted-foreground" data-testid="recommendation-justification">
          {recommendation.justification}
        </p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Quality gate range
        </p>
        <p className="text-foreground" data-testid="quality-gate-range">
          {qualityGateRange.lower}–{qualityGateRange.upper} / 100
        </p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Cost range</p>
        <p className="text-foreground" data-testid="cost-range">
          Baseline {formatUsd(costRange.baselineLowerUsd)}–
          {formatUsd(costRange.baselineUpperUsd)} · Marginal friction{' '}
          {formatUsd(costRange.marginalFrictionLowerUsd)}–
          {formatUsd(costRange.marginalFrictionUpperUsd)}
        </p>
      </div>

      {scopeWarnings.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Scope warnings
          </p>
          <ul
            className="list-disc space-y-1 pl-5 text-foreground"
            data-testid="scope-warnings"
          >
            {scopeWarnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Anchors</p>
        <AnchorCitationList projectId={projectId} anchors={anchors} />
      </div>
    </div>
  );
}
