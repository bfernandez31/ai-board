'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle, CheckCircle2, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { queryKeys } from '@/app/lib/query-keys';
import { useSetupJobPolling } from '@/app/lib/hooks/useSetupJobPolling';
import { useToast } from '@/hooks/use-toast';
import type { Agent } from '@prisma/client';

interface SetupPageClientProps {
  projectId: number;
  projectName: string;
}

const AGENTS: { value: Agent; label: string; description: string }[] = [
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
  {
    value: 'MISTRAL',
    label: 'Mistral',
    description: 'Mistral vibe agent for code generation and reasoning',
  },
  {
    value: 'GEMINI',
    label: 'Gemini',
    description: 'Google Gemini CLI agent for code generation and analysis',
  },
];

export function SetupPageClient({ projectId, projectName }: SetupPageClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedAgent, setSelectedAgent] = useState<Agent>('CLAUDE');
  const [isDispatching, setIsDispatching] = useState(false);

  const { job, configSyncedAt, isPolling } = useSetupJobPolling(projectId);

  // Credential check query
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

  const handleDispatch = useCallback(async () => {
    setIsDispatching(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/setup/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: selectedAgent }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast({
          title: 'Failed to initialize project',
          description: data.error || 'An unexpected error occurred. Please try again.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Failed to initialize project',
        description: 'Could not connect to the server. Please check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDispatching(false);
    }
  }, [projectId, selectedAgent, toast]);

  const initButtonDisabled = isDispatching || isJobActive || !hasCredential;

  // Redirect to board when config is synced
  const [redirecting, setRedirecting] = useState(false);
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
            className={`aurora-glass cursor-pointer p-4 transition-all ${
              selectedAgent === agent.value
                ? 'border-ctp-mauve ring-1 ring-ctp-mauve/30'
                : 'hover:border-border/60'
            } ${isJobActive ? 'opacity-60 pointer-events-none' : ''}`}
            onClick={() => !isJobActive && setSelectedAgent(agent.value)}
            role="radio"
            aria-checked={selectedAgent === agent.value}
            tabIndex={0}
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                  selectedAgent === agent.value
                    ? 'border-ctp-mauve'
                    : 'border-muted-foreground/40'
                }`}
              >
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
              {job.errorMessage && (
                <p className="text-sm text-muted-foreground mt-1">{job.errorMessage}</p>
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

      {/* Initialize Button */}
      {!isJobActive && !isJobFailed && (
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
      {isPolling && !isJobActive && (
        <p className="text-xs text-muted-foreground text-center">Checking status...</p>
      )}
    </div>
  );
}
