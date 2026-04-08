'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Agent } from '@prisma/client';
import { Loader2, CheckCircle2, XCircle, ArrowRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AgentIcon } from '@/components/ui/agent-icon';
import { getAgentLabel, getAgentDescription } from '@/app/lib/utils/agent-icons';
import { useSetupPolling } from '@/app/lib/hooks/useSetupPolling';
import { queryKeys } from '@/app/lib/query-keys';

const AGENT_PROVIDER_MAP: Record<string, string> = {
  CLAUDE: 'ANTHROPIC',
  CODEX: 'OPENAI',
};

interface SetupPageClientProps {
  projectId: number;
  projectName: string;
  isOwner: boolean;
}

export function SetupPageClient({ projectId, projectName, isOwner }: SetupPageClientProps) {
  const [selectedAgent, setSelectedAgent] = useState<Agent>(Agent.CLAUDE);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const { setupState, latestJob, isPolling } = useSetupPolling(projectId);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Fetch credentials to check if selected agent's provider has a credential
  const { data: credentialsData } = useQuery({
    queryKey: queryKeys.credentials.all,
    queryFn: async () => {
      const response = await fetch('/api/credentials');
      if (!response.ok) return { credentials: [] };
      return response.json();
    },
    staleTime: 30_000,
  });

  const hasCredential = useMemo(() => {
    if (!credentialsData?.credentials) return false;
    const requiredProvider = AGENT_PROVIDER_MAP[selectedAgent];
    return credentialsData.credentials.some(
      (c: { provider: string }) => c.provider === requiredProvider
    );
  }, [credentialsData, selectedAgent]);

  // Elapsed time counter during IN_PROGRESS
  useEffect(() => {
    if (setupState !== 'IN_PROGRESS' || !latestJob?.startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const startTime = new Date(latestJob.startedAt).getTime();
    const updateElapsed = () => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [setupState, latestJob?.startedAt]);

  async function handleDispatch() {
    setIsDispatching(true);
    setDispatchError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: selectedAgent }),
      });

      if (!response.ok) {
        const data = await response.json();
        setDispatchError(data.error || 'Failed to start setup');
        return;
      }
    } catch {
      setDispatchError('Network error. Please try again.');
    } finally {
      setIsDispatching(false);
    }
  }

  // Success state
  if (setupState === 'CONFIGURED' || setupState === 'COMPLETED') {
    return (
      <main className="container mx-auto py-10 max-w-2xl">
        <Card className="aurora-bg-subtle">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <h2 className="text-2xl font-bold">Setup Complete</h2>
              <p className="text-muted-foreground">
                {projectName} has been configured and is ready to use.
              </p>
              <Link href={`/projects/${projectId}/board`}>
                <Button>
                  Go to Board
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Error state
  if (setupState === 'FAILED') {
    return (
      <main className="container mx-auto py-10 max-w-2xl">
        <Card className="aurora-bg-subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Setup Failed
            </CardTitle>
            <CardDescription>
              An error occurred during project setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestJob?.logs && (
              <pre className="rounded-md bg-muted p-4 text-sm overflow-x-auto whitespace-pre-wrap">
                {latestJob.logs}
              </pre>
            )}
            <Button onClick={handleDispatch} disabled={isDispatching || !isOwner}>
              {isDispatching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                'Retry'
              )}
            </Button>
            {dispatchError && (
              <p className="text-sm text-destructive">{dispatchError}</p>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  // In-progress state
  if (setupState === 'IN_PROGRESS') {
    return (
      <main className="container mx-auto py-10 max-w-2xl">
        <Card className="aurora-bg-subtle">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <h2 className="text-2xl font-bold">Setting Up {projectName}</h2>
              <p className="text-muted-foreground">
                {latestJob?.status === 'PENDING' ? 'Waiting for workflow to start...' : 'Configuring your project...'}
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                Elapsed: {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Default: NEEDS_SETUP — agent selection + dispatch
  return (
    <main className="container mx-auto py-10 max-w-2xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project Setup</h1>
          <p className="text-muted-foreground mt-2">
            Configure {projectName} for AI-powered development.
          </p>
        </div>

        <Card className="aurora-bg-subtle">
          <CardHeader>
            <CardTitle>Select AI Agent</CardTitle>
            <CardDescription>
              Choose which AI agent will manage this project.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {Object.values(Agent).map((agent) => (
                <button
                  key={agent}
                  type="button"
                  onClick={() => setSelectedAgent(agent)}
                  className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                    selectedAgent === agent
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <AgentIcon agent={agent} size={24} />
                  <div>
                    <p className="font-medium">{getAgentLabel(agent)}</p>
                    <p className="text-sm text-muted-foreground">
                      {getAgentDescription(agent)}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {!hasCredential && credentialsData && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  No {AGENT_PROVIDER_MAP[selectedAgent] === 'ANTHROPIC' ? 'Anthropic' : 'OpenAI'} credential configured.
                  Add your key in{' '}
                  <Link href={`/projects/${projectId}/settings`} className="underline text-foreground">
                    Settings → AI Credentials
                  </Link>.
                </p>
              </div>
            )}

            {dispatchError && (
              <p className="text-sm text-destructive">{dispatchError}</p>
            )}

            <Button
              onClick={handleDispatch}
              disabled={isDispatching || !isOwner || isPolling || !hasCredential}
              className="w-full"
            >
              {isDispatching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                'Initialize Project'
              )}
            </Button>

            {!isOwner && (
              <p className="text-sm text-muted-foreground text-center">
                Only the project owner can initialize setup.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
