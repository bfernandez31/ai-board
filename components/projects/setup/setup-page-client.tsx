'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2, Rocket } from 'lucide-react';
import { queryKeys } from '@/app/lib/query-keys';
import type { OnboardingArtifactManifestEntry, ProjectSetupStateDto, ProjectSetupStatusDto } from '@/lib/onboarding/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SetupAgent = 'CLAUDE' | 'CODEX';

type SetupArtifactListProps = {
  artifacts: OnboardingArtifactManifestEntry[];
};

type SetupStatusCardProps = {
  job: ProjectSetupStatusDto;
};

type ProjectSetupPageClientProps = {
  projectId: number;
  projectName: string;
  repository: string;
};

function isActiveSetupJobStatus(status: ProjectSetupStatusDto['status']): boolean {
  return status === 'PENDING' || status === 'RUNNING';
}

function isFailedSetupJobStatus(status: ProjectSetupStatusDto['status']): boolean {
  return status === 'FAILED' || status === 'CANCELLED';
}

function getStartButtonLabel(job: ProjectSetupStatusDto | null): string {
  if (!job) {
    return 'Start onboarding';
  }

  if (isFailedSetupJobStatus(job.status)) {
    return 'Retry onboarding';
  }

  return 'Start onboarding';
}

async function fetchSetupState(projectId: number): Promise<ProjectSetupStateDto> {
  const response = await fetch(`/api/projects/${projectId}/setup`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load setup state');
  }

  return response.json();
}

async function fetchSetupStatus(projectId: number): Promise<ProjectSetupStatusDto | null> {
  const response = await fetch(`/api/projects/${projectId}/setup/status`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load setup status');
  }

  const payload = await response.json();
  return 'jobId' in payload ? payload : null;
}

async function startProjectSetup(projectId: number, selectedAgent: SetupAgent): Promise<unknown> {
  const response = await fetch(`/api/projects/${projectId}/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectedAgent }),
  });

  const payload = await response.json();
  if (!response.ok && response.status !== 409) {
    throw new Error(payload.error || 'Failed to start setup');
  }

  return payload;
}

function SetupArtifactList({ artifacts }: SetupArtifactListProps): React.JSX.Element | null {
  if (artifacts.length === 0) return null;

  return (
    <div className="space-y-2">
      {artifacts.map((artifact) => (
        <div
          key={`${artifact.path}-${artifact.kind}`}
          className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2 text-sm"
        >
          <span className="truncate text-foreground">{artifact.path}</span>
          <Badge variant="outline">{artifact.status}</Badge>
        </div>
      ))}
    </div>
  );
}

function SetupStatusCard({ job }: SetupStatusCardProps): React.JSX.Element {
  const isActive = isActiveSetupJobStatus(job.status);
  const isFailure = isFailedSetupJobStatus(job.status);

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isActive ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {!isActive && !isFailure ? <CheckCircle2 className="h-5 w-5 text-ctp-green" /> : null}
          {isFailure ? <AlertCircle className="h-5 w-5 text-destructive" /> : null}
          Setup Status
        </CardTitle>
        <CardDescription>
          Agent: {job.selectedAgent} · Status: {job.status}
          {job.elapsedSeconds != null ? ` · ${job.elapsedSeconds}s elapsed` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {job.error?.message ? (
          <Alert variant="destructive">
            <AlertTitle>Setup failed</AlertTitle>
            <AlertDescription>{job.error.message}</AlertDescription>
          </Alert>
        ) : null}

        {job.commitSha ? (
          <div className="rounded-md border border-border/70 px-3 py-2 text-sm text-muted-foreground">
            Commit: <span className="font-mono text-foreground">{job.commitSha}</span>
          </div>
        ) : null}

        <SetupArtifactList artifacts={job.artifactManifest} />
      </CardContent>
    </Card>
  );
}

export function ProjectSetupPageClient({
  projectId,
  projectName,
  repository,
}: ProjectSetupPageClientProps): React.JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedAgentOverride, setSelectedAgentOverride] = useState<SetupAgent | null>(null);

  const stateQuery = useQuery<ProjectSetupStateDto>({
    queryKey: queryKeys.projects.setup(projectId),
    queryFn: () => fetchSetupState(projectId),
    refetchOnWindowFocus: true,
  });

  const statusQuery = useQuery<ProjectSetupStatusDto | null>({
    queryKey: queryKeys.projects.setupStatus(projectId),
    queryFn: () => fetchSetupStatus(projectId),
    enabled: Boolean(stateQuery.data?.latestSetupJob),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return isActiveSetupJobStatus(data.status) ? 2000 : false;
    },
  });

  useEffect(() => {
    if (stateQuery.data?.redirectTo) {
      router.replace(stateQuery.data.redirectTo);
    }
  }, [router, stateQuery.data?.redirectTo]);

  const latestJob = statusQuery.data ?? stateQuery.data?.latestSetupJob ?? null;

  useEffect(() => {
    if (latestJob?.status === 'COMPLETED') {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.settings(projectId) });
      router.refresh();
    }
  }, [latestJob?.status, projectId, queryClient, router]);

  const selectedAgent =
    selectedAgentOverride ?? stateQuery.data?.selectedAgentDefault ?? 'CLAUDE';

  const startMutation = useMutation({
    mutationFn: () => startProjectSetup(projectId, selectedAgent),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.setup(projectId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.setupStatus(projectId) });
    },
  });

  if (stateQuery.isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (stateQuery.isError || !stateQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Setup unavailable</AlertTitle>
        <AlertDescription>Unable to load project setup state.</AlertDescription>
      </Alert>
    );
  }

  const state = stateQuery.data;
  const readiness = state.eligibleAgents.find((entry) => entry.agent === selectedAgent);
  const hasActiveJob = latestJob ? isActiveSetupJobStatus(latestJob.status) : false;
  const canStart = !startMutation.isPending && !!readiness?.ready && !hasActiveJob;

  return (
    <div className="space-y-6">
      <Card className="aurora-card">
        <CardHeader>
          <CardTitle className="text-3xl">Initialize {projectName}</CardTitle>
          <CardDescription>
            Imported repository <span className="font-medium text-foreground">{repository}</span> needs
            onboarding before the board can be used.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Agent</label>
            <Select
              value={selectedAgent}
              onValueChange={(value) => setSelectedAgentOverride(value as SetupAgent)}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CLAUDE">Claude</SelectItem>
                <SelectItem value="CODEX">Codex</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {readiness && !readiness.ready ? (
            <Alert variant="destructive">
              <AlertTitle>Credential required</AlertTitle>
              <AlertDescription>
                {readiness.verificationMessage || `${readiness.provider} is not ready for setup.`}
              </AlertDescription>
            </Alert>
          ) : null}

          {hasActiveJob ? (
            <Alert>
              <AlertTitle>Onboarding already running</AlertTitle>
              <AlertDescription>
                The latest setup job is still active. This page will keep polling until it reaches a terminal state.
              </AlertDescription>
            </Alert>
          ) : null}

          <Button onClick={() => startMutation.mutate()} disabled={!canStart}>
            {startMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-4 w-4" />
                {getStartButtonLabel(latestJob)}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {latestJob ? <SetupStatusCard job={latestJob} /> : null}

      {latestJob?.status === 'COMPLETED' ? (
        <div className="flex justify-end">
          <Button onClick={() => router.push(`/projects/${projectId}/board`)}>
            Continue to board
          </Button>
        </div>
      ) : null}
    </div>
  );
}
