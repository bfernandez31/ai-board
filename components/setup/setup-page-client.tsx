'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle, CheckCircle2, ArrowRight, RefreshCw, SkipForward, FileText, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { queryKeys } from '@/app/lib/query-keys';
import { useSetupJobPolling } from '@/app/lib/hooks/useSetupJobPolling';
import { useSpecGenPolling } from '@/app/lib/hooks/useSpecGenPolling';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Agent, SpecDepth } from '@prisma/client';

interface SetupPageClientProps {
  projectId: number;
  projectName: string;
  showStep2?: boolean;
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
];

const DEPTH_OPTIONS: { value: SpecDepth; label: string; description: string; time: string }[] = [
  {
    value: 'QUICK',
    label: 'Quick',
    description: 'Single overview document covering project purpose and structure',
    time: '~5 min',
  },
  {
    value: 'STANDARD',
    label: 'Standard',
    description: 'Architecture, API endpoints, and data model documentation',
    time: '~10 min',
  },
  {
    value: 'COMPREHENSIVE',
    label: 'Comprehensive',
    description: 'Full functional specs, technical specs, and cross-references',
    time: '~20 min',
  },
];

export function SetupPageClient({ projectId, projectName, showStep2 = false }: SetupPageClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedAgent, setSelectedAgent] = useState<Agent>('CLAUDE');
  const [isDispatching, setIsDispatching] = useState(false);

  // Step 2 state
  const [selectedDepth, setSelectedDepth] = useState<SpecDepth>('STANDARD');
  const [documentationUrl, setDocumentationUrl] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const { job, configSyncedAt, isPolling } = useSetupJobPolling(projectId);
  const { job: specGenJob, specsGeneratedAt } = useSpecGenPolling(projectId);

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

  const handleGenerateSpecs = useCallback(async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/spec-generation/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: selectedAgent,
          depth: selectedDepth,
          documentationUrl: documentationUrl || undefined,
          additionalContext: additionalContext || undefined,
        }),
      });

      if (response.ok) {
        router.push(`/projects/${projectId}/board`);
      } else {
        const data = await response.json();
        toast({
          title: 'Failed to generate specs',
          description: data.error || 'An unexpected error occurred.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Failed to generate specs',
        description: 'Could not connect to the server.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [projectId, selectedAgent, selectedDepth, documentationUrl, additionalContext, router, toast]);

  const handleSkip = useCallback(() => {
    router.push(`/projects/${projectId}/board`);
  }, [router, projectId]);

  const initButtonDisabled = isDispatching || isJobActive || !hasCredential;

  // Redirect to board when spec gen completes (Step 2 polling)
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    if (redirecting) return;
    // Step 1 complete + spec gen completed → redirect
    if (specsGeneratedAt || specGenJob?.status === 'COMPLETED') {
      setRedirecting(true);
      router.push(`/projects/${projectId}/board`);
      return;
    }
    // Step 1 just completed but showStep2 is false (coming from polling) → transition to Step 2
    if (configSyncedAt && !showStep2) {
      // Config just synced; reload to get server-rendered Step 2
      router.refresh();
    }
  }, [configSyncedAt, specsGeneratedAt, specGenJob?.status, redirecting, router, projectId, showStep2]);

  if (specsGeneratedAt || specGenJob?.status === 'COMPLETED') {
    return (
      <div className="aurora-bg-section rounded-lg border border-border p-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-ctp-green mx-auto mb-3" />
        <p className="text-foreground font-medium">Setup complete! Redirecting to board...</p>
      </div>
    );
  }

  if (showStep2) {
    const isSpecGenActive = specGenJob?.status === 'PENDING' || specGenJob?.status === 'RUNNING';
    const isSpecGenFailed = specGenJob?.status === 'FAILED';

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Generate Specs for {projectName}
          </h1>
          <p className="text-muted-foreground mt-2">
            AI will analyze your codebase and generate project specifications.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 justify-center text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-ctp-green" />
            <span>Step 1: Init</span>
          </div>
          <div className="h-px w-6 bg-border" />
          <div className="flex items-center gap-1.5 text-foreground font-medium">
            <FileText className="h-4 w-4 text-ctp-mauve" />
            <span>Step 2: Generate Specs</span>
          </div>
        </div>

        {/* Depth Picker */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Spec Depth</label>
          <div className="grid gap-3">
            {DEPTH_OPTIONS.map((option) => (
              <Card
                key={option.value}
                className={`aurora-glass cursor-pointer p-4 transition-all ${
                  selectedDepth === option.value
                    ? 'border-ctp-mauve ring-1 ring-ctp-mauve/30'
                    : 'hover:border-border/60'
                } ${isSpecGenActive ? 'opacity-60 pointer-events-none' : ''}`}
                onClick={() => !isSpecGenActive && setSelectedDepth(option.value)}
                role="radio"
                aria-checked={selectedDepth === option.value}
                tabIndex={0}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                      selectedDepth === option.value
                        ? 'border-ctp-mauve'
                        : 'border-muted-foreground/40'
                    }`}
                  >
                    {selectedDepth === option.value && (
                      <div className="h-2 w-2 rounded-full bg-ctp-mauve" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">{option.label}</p>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {option.time}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Documentation URL */}
        <div className="space-y-2">
          <label htmlFor="doc-url" className="text-sm font-medium text-foreground">
            Documentation URL <span className="text-muted-foreground">(optional)</span>
          </label>
          <Input
            id="doc-url"
            type="url"
            placeholder="https://docs.example.com"
            value={documentationUrl}
            onChange={(e) => setDocumentationUrl(e.target.value)}
            disabled={isSpecGenActive}
          />
        </div>

        {/* Additional Context */}
        <div className="space-y-2">
          <label htmlFor="context" className="text-sm font-medium text-foreground">
            Additional Context <span className="text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="context"
            placeholder="Any additional context about the project..."
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            disabled={isSpecGenActive}
            rows={3}
          />
        </div>

        {/* Active job status */}
        {isSpecGenActive && specGenJob && (
          <div className="aurora-bg-section rounded-lg border border-border p-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-ctp-sapphire mx-auto mb-3" />
            <p className="text-foreground font-medium">
              {specGenJob.status === 'PENDING' ? 'Starting spec generation...' : 'Generating specs...'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              This may take a moment. You can leave and come back.
            </p>
          </div>
        )}

        {/* Failed state */}
        {isSpecGenFailed && specGenJob && (
          <div className="rounded-lg border border-ctp-red/30 bg-ctp-red/5 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-ctp-red mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Spec generation failed</p>
                {specGenJob.errorMessage && (
                  <p className="text-sm text-muted-foreground mt-1">{specGenJob.errorMessage}</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={handleGenerateSpecs}
                  disabled={isGenerating}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!isSpecGenActive && !isSpecGenFailed && (
          <div className="flex gap-3">
            <Button
              className="flex-1 aurora-btn-mauve"
              size="lg"
              onClick={handleGenerateSpecs}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Specs
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleSkip}
            >
              <SkipForward className="h-4 w-4 mr-2" />
              Skip for now
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (configSyncedAt) {
    return (
      <div className="aurora-bg-section rounded-lg border border-border p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-ctp-sapphire mx-auto mb-3" />
        <p className="text-foreground font-medium">Loading Step 2...</p>
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
