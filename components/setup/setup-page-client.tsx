'use client';

import { useQuery } from '@tanstack/react-query';
import type { Agent } from '@prisma/client';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSetupJobPolling, type SetupJobPollResult } from '@/app/lib/hooks/useSetupJobPolling';
import { queryKeys } from '@/app/lib/query-keys';

interface SetupPageClientProps {
  projectId: number;
  projectName: string;
  initialSetupState?: SetupJobPollResult;
}

interface AgentOption {
  value: Agent;
  label: string;
  description: string;
}

interface ArtifactListProps {
  title: string;
  artifacts: Array<{ path: string; reason?: string }>;
  itemKeyPrefix: string;
}

const AGENTS: AgentOption[] = [
  {
    value: 'CLAUDE',
    label: 'Claude Code',
    description: 'Anthropic Claude agent for code generation and analysis',
  },
  {
    value: 'CODEX',
    label: 'Codex',
    description: 'OpenAI Codex agent for code generation and completion',
  },
];

function getAgentCardClass(isSelected: boolean, isDisabled: boolean): string {
  const selectionClass = isSelected
    ? 'border-ctp-mauve ring-1 ring-ctp-mauve/30'
    : 'hover:border-border/60';

  const disabledClass = isDisabled ? 'opacity-60 pointer-events-none' : '';

  return `aurora-glass cursor-pointer p-4 transition-all ${selectionClass} ${disabledClass}`.trim();
}

function getAgentIndicatorClass(isSelected: boolean): string {
  if (isSelected) {
    return 'h-4 w-4 rounded-full border-2 border-ctp-mauve flex items-center justify-center';
  }

  return 'h-4 w-4 rounded-full border-2 border-muted-foreground/40 flex items-center justify-center';
}

function getCompletionStateClasses(isPartial: boolean): string {
  if (isPartial) {
    return 'rounded-lg border border-ctp-yellow/30 bg-ctp-yellow/5 p-4';
  }

  return 'rounded-lg border border-ctp-green/30 bg-ctp-green/5 p-4';
}

function getCompletionIconClass(isPartial: boolean): string {
  return isPartial ? 'h-5 w-5 mt-0.5 text-ctp-yellow' : 'h-5 w-5 mt-0.5 text-ctp-green';
}

function getCompletionTitle(isPartial: boolean): string {
  return isPartial ? 'Setup partially completed' : 'Setup completed';
}

function ArtifactList({ title, artifacts, itemKeyPrefix }: ArtifactListProps): React.JSX.Element | null {
  if (artifacts.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1 text-sm text-foreground">
        {artifacts.map((artifact) => (
          <li key={`${itemKeyPrefix}-${artifact.path}`}>
            {artifact.path}
            {artifact.reason ? ` (${artifact.reason})` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SetupPageClient({
  projectId,
  projectName,
  initialSetupState,
}: SetupPageClientProps): React.JSX.Element {
  const router = useRouter();
  const [selectedAgent, setSelectedAgent] = useState<Agent>('CLAUDE');
  const [isDispatching, setIsDispatching] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const { job, configSyncedAt, isPolling } = useSetupJobPolling(projectId, 2000, initialSetupState);

  const { data: credentialData } = useQuery({
    queryKey: queryKeys.projects.credentialCheck(projectId, selectedAgent),
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/setup/credential-check?agent=${selectedAgent}`,
        { cache: 'no-store' }
      );
      if (!response.ok) throw new Error('Failed to check credential');
      return response.json() as Promise<{
        hasCredential: boolean;
        provider: string;
        settingsUrl?: string;
      }>;
    },
  });

  const hasCredential = credentialData?.hasCredential ?? false;

  const isJobActive = job?.status === 'PENDING' || job?.status === 'RUNNING';
  const isJobFailed = job?.status === 'FAILED';
  const isJobCompleted = job?.status === 'COMPLETED';

  const artifactSummary = job?.artifactSummary;
  const createdArtifacts = artifactSummary?.created ?? [];
  const preservedArtifacts = artifactSummary?.preserved ?? [];
  const missingArtifacts = artifactSummary?.missing ?? [];

  const showInitializeButton = !isJobActive && !isJobFailed && !isJobCompleted;
  const showPollingIndicator = isPolling && !isJobActive;

  async function handleDispatch(): Promise<void> {
    setIsDispatching(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/setup/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: selectedAgent }),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('[setup] Dispatch failed:', data.error);
      }
    } catch (error) {
      console.error('[setup] Dispatch error:', error);
    } finally {
      setIsDispatching(false);
    }
  }

  const initButtonDisabled = isDispatching || isJobActive || !hasCredential;

  useEffect(() => {
    if (configSyncedAt && !redirecting) {
      setRedirecting(true);
      router.push(`/projects/${projectId}/board`);
    }
  }, [configSyncedAt, redirecting, router, projectId]);

  if (configSyncedAt) {
    return (
      <div className="aurora-bg-section rounded-lg border border-border p-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-ctp-green mx-auto mb-3" />
        <p className="text-foreground font-medium">Setup complete! Redirecting to board...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Set Up {projectName}
        </h1>
        <p className="text-muted-foreground mt-2">
          Choose your AI agent to initialize the project configuration.
        </p>
      </div>

      {/* Agent Selection */}
      <div className="grid gap-3">
        {AGENTS.map((agent) => (
          <Card
            key={agent.value}
            className={getAgentCardClass(selectedAgent === agent.value, isJobActive)}
            onClick={() => !isJobActive && setSelectedAgent(agent.value)}
            role="radio"
            aria-checked={selectedAgent === agent.value}
            tabIndex={0}
          >
            <div className="flex items-center gap-3">
              <div className={getAgentIndicatorClass(selectedAgent === agent.value)}>
                {selectedAgent === agent.value && (
                  <div className="h-2 w-2 rounded-full bg-ctp-mauve" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">{agent.label}</p>
                <p className="text-sm text-muted-foreground">{agent.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Credential Warning */}
      {!hasCredential && credentialData && (
        <div className="rounded-lg border border-ctp-yellow/30 bg-ctp-yellow/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-ctp-yellow mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Missing {credentialData.provider} credential
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Add your {credentialData.provider} API key in{' '}
                <a
                  href={credentialData.settingsUrl}
                  className="text-ctp-sapphire underline underline-offset-2"
                >
                  Settings
                </a>{' '}
                to continue.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status Display */}
      {isJobActive && job && (
        <div className="aurora-bg-section rounded-lg border border-border p-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-ctp-sapphire mx-auto mb-3" />
          <p className="text-foreground font-medium">
            {job.status === 'PENDING' ? 'Starting setup...' : 'Running setup...'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            This may take a moment. You can leave and come back.
          </p>
        </div>
      )}

      {/* Failed State */}
      {isJobFailed && job && (
        <div className="rounded-lg border border-ctp-red/30 bg-ctp-red/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-ctp-red mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Setup failed</p>
              {job.errorCode && (
                <p className="text-xs text-muted-foreground mt-1">Failure category: {job.errorCode}</p>
              )}
              {job.errorMessage && (
                <p className="text-sm text-muted-foreground mt-1">{job.errorMessage}</p>
              )}
              {job.logs && (
                <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{job.logs}</p>
              )}
              {job.commitSha && (
                <p className="text-xs text-muted-foreground mt-2">Commit: {job.commitSha}</p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleDispatch}
                disabled={isDispatching}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Completed / Partial State */}
      {isJobCompleted && job && !configSyncedAt && (
        <div className={getCompletionStateClasses(job.partial)}>
          <div className="flex items-start gap-3">
            <CheckCircle2 className={getCompletionIconClass(job.partial)} />
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">{getCompletionTitle(job.partial)}</p>
                {job.commitSha && (
                  <p className="text-xs text-muted-foreground mt-1">Commit: {job.commitSha}</p>
                )}
                {job.partial && artifactSummary?.partialReason && (
                  <p className="text-sm text-muted-foreground mt-1">{artifactSummary.partialReason}</p>
                )}
              </div>

              <ArtifactList title="Created" artifacts={createdArtifacts} itemKeyPrefix="created" />
              <ArtifactList title="Preserved" artifacts={preservedArtifacts} itemKeyPrefix="preserved" />
              <ArtifactList title="Missing" artifacts={missingArtifacts} itemKeyPrefix="missing" />
            </div>
          </div>
        </div>
      )}

      {/* Initialize Button */}
      {showInitializeButton && (
        <Button
          className="w-full aurora-btn-mauve"
          size="lg"
          onClick={handleDispatch}
          disabled={initButtonDisabled}
        >
          {isDispatching ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Initializing...
            </>
          ) : (
            <>
              Initialize Project
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      )}

      {/* Polling indicator */}
      {showPollingIndicator && (
        <p className="text-xs text-muted-foreground text-center">Checking status...</p>
      )}
    </div>
  );
}
