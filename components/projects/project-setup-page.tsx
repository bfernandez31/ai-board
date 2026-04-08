'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectSetupStartForm } from './project-setup-start-form';
import { ProjectSetupStatus } from './project-setup-status';
import type {
  ProjectSetupResponse,
  SetupStartResponse,
} from '@/lib/project-setup/types';

interface ProjectSetupPageProps {
  projectId: number;
  projectName: string;
}

async function fetchProjectSetup(projectId: number): Promise<ProjectSetupResponse> {
  const response = await fetch(`/api/projects/${projectId}/setup`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = (await response.json()) as { error?: string };
    throw new Error(error.error || 'Failed to load project setup');
  }

  return response.json() as Promise<ProjectSetupResponse>;
}

export function ProjectSetupPage({
  projectId,
  projectName,
}: ProjectSetupPageProps) {
  const queryClient = useQueryClient();
  const queryKey = ['project-setup', projectId] as const;

  const { data, error, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchProjectSetup(projectId),
    refetchInterval: (query) => {
      const setup = query.state.data;
      const status = setup?.latestAttempt?.status;
      return status === 'PENDING' || status === 'RUNNING' ? 15000 : false;
    },
  });

  function handleStarted(response: SetupStartResponse) {
    queryClient.setQueryData<ProjectSetupResponse | undefined>(queryKey, (current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        latestAttempt: response.attempt,
      };
    });

    void queryClient.invalidateQueries({ queryKey });
  }

  if (isLoading) {
    return (
      <main className="container mx-auto max-w-4xl py-10">
        <Card className="aurora-bg-subtle">
          <CardHeader>
            <CardTitle>Loading project setup...</CardTitle>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="container mx-auto max-w-4xl py-10">
        <Alert variant="destructive">
          <AlertTitle>Unable to load project setup</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const canStartOrRetry =
    data.viewerCanManage &&
    data.setupRequired &&
    (!data.latestAttempt || data.latestAttempt.status === 'FAILED');

  return (
    <main className="container mx-auto max-w-4xl py-10">
      <div className="space-y-6">
        <Card className="aurora-bg-subtle">
          <CardHeader>
            <CardTitle>Project Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-foreground">
              Finish onboarding for <span className="font-medium">{projectName}</span> before entering the board.
            </p>
            <p className="text-sm text-muted-foreground">
              Imported repositories without synced AI Board configuration land here until onboarding has finished cleanly.
            </p>
          </CardContent>
        </Card>

        {!data.viewerCanManage ? (
          <Alert>
            <AlertTitle>Read-only status</AlertTitle>
            <AlertDescription>
              Only the project owner can start or retry setup. Members can monitor the latest status here.
            </AlertDescription>
          </Alert>
        ) : null}

        <ProjectSetupStatus projectId={projectId} setup={data} />

        {canStartOrRetry ? (
          <ProjectSetupStartForm
            projectId={projectId}
            setup={data}
            onStarted={handleStarted}
          />
        ) : null}
      </div>
    </main>
  );
}
