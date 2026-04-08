'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2, Rocket } from 'lucide-react';
import { queryKeys } from '@/app/lib/query-keys';
import type {
  OnboardingArtifactManifestEntry,
  ProjectSetupStateDto,
  ProjectSetupStatusDto,
} from '@/lib/onboarding/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function SetupArtifactList({ artifacts }: { artifacts: OnboardingArtifactManifestEntry[] }) {
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

function SetupStatusCard({ job }: { job: ProjectSetupStatusDto }) {
  const isActive = job.status === 'PENDING' || job.status === 'RUNNING';
  const isFailure = job.status === 'FAILED' || job.status === 'CANCELLED';

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
}: {
  projectId: number;
  projectName: string;
  repository: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedAgentOverride, setSelectedAgentOverride] = useState<'CLAUDE' | 'CODEX' | null>(null);

  const stateQuery = useQuery<ProjectSetupStateDto>({
    queryKey: queryKeys.projects.setup(projectId),
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/setup`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Failed to load setup state');
      }
      return response.json();
    },
    refetchOnWindowFocus: true,
  });

  const statusQuery = useQuery<ProjectSetupStatusDto | null>({
    queryKey: queryKeys.projects.setupStatus(projectId),
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/setup/status`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Failed to load setup status');
      }
      const payload = await response.json();
      return 'jobId' in payload ? payload : null;
    },
    enabled: !!stateQuery.data?.latestSetupJob,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return data.status === 'PENDING' || data.status === 'RUNNING' ? 2000 : false;
    },
  });

  useEffect(() => {
    if (stateQuery.data?.redirectTo) {
      router.replace(stateQuery.data.redirectTo);
    }
  }, [router, stateQuery.data?.redirectTo]);

  const selectedAgent =
    selectedAgentOverride ?? stateQuery.data?.selectedAgentDefault ?? 'CLAUDE';

  const startMutation = useMutation({
    mutationFn: async () => {
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
    },
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
  const latestJob = statusQuery.data ?? state.latestSetupJob;
  const readiness = state.eligibleAgents.find((entry) => entry.agent === selectedAgent);
  const canStart = !startMutation.isPending && !!readiness?.ready;

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
              onValueChange={(value) =>
                setSelectedAgentOverride(value as 'CLAUDE' | 'CODEX')
              }
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

          <Button onClick={() => startMutation.mutate()} disabled={!canStart}>
            {startMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-4 w-4" />
                Start onboarding
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
