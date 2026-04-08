'use client';

import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProjectSetupResponse } from '@/lib/project-setup/types';

interface ProjectSetupStatusProps {
  projectId: number;
  setup: ProjectSetupResponse;
}

function renderArtifactSummary(summary: unknown): React.ReactNode {
  if (!summary) {
    return null;
  }

  if (Array.isArray(summary)) {
    return (
      <ul className="list-disc pl-5 text-sm text-foreground">
        {summary.map((item, index) => (
          <li key={`${index}-${String(item)}`}>{String(item)}</li>
        ))}
      </ul>
    );
  }

  if (typeof summary === 'object') {
    return (
      <div className="space-y-3">
        {Object.entries(summary as Record<string, unknown>).map(([key, value]) => (
          <div key={key}>
            <p className="text-sm font-medium capitalize text-foreground">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </p>
            {renderArtifactSummary(value)}
          </div>
        ))}
      </div>
    );
  }

  return <p className="text-sm text-foreground">{String(summary)}</p>;
}

export function ProjectSetupStatus({
  projectId,
  setup,
}: ProjectSetupStatusProps) {
  const attempt = setup.latestAttempt;

  if (!attempt) {
    return (
      <Alert>
        <Clock3 className="h-4 w-4" />
        <AlertTitle>Setup Required</AlertTitle>
        <AlertDescription>
          Start onboarding to generate the initial AI Board project files for this repository.
        </AlertDescription>
      </Alert>
    );
  }

  if (attempt.status === 'PENDING' || attempt.status === 'RUNNING') {
    return (
      <Card className="aurora-bg-subtle">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Project setup is running
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-foreground">
            {attempt.resultMessage || 'Waiting for setup workflow updates.'}
          </p>
          <p className="text-sm text-muted-foreground">
            Elapsed time: {attempt.elapsedSeconds ?? 0}s
          </p>
        </CardContent>
      </Card>
    );
  }

  if (attempt.status === 'FAILED') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Project setup failed</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>{attempt.failureMessage || attempt.resultMessage || 'The onboarding workflow failed.'}</p>
          {attempt.failureCode ? (
            <p className="text-xs uppercase tracking-wide">{attempt.failureCode}</p>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-ctp-green" />
          Project setup completed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground">
          {attempt.resultMessage || 'The repository is ready for the board experience.'}
        </p>
        {attempt.artifactSummary ? (
          <div className="rounded-lg border border-border bg-background/70 p-3">
            <p className="mb-2 text-sm font-medium text-foreground">
              Artifact summary
            </p>
            {renderArtifactSummary(attempt.artifactSummary)}
          </div>
        ) : null}
        <Button asChild>
          <Link href={`/projects/${projectId}/board`}>
            Open Board
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
