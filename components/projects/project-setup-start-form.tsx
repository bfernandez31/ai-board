'use client';

import { useState } from 'react';
import { Agent } from '@prisma/client';
import { AgentIcon } from '@/components/ui/agent-icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getAgentDescription, getAgentLabel } from '@/app/lib/utils/agent-icons';
import type {
  ProjectSetupResponse,
  SetupStartResponse,
} from '@/lib/project-setup/types';

interface ProjectSetupStartFormProps {
  projectId: number;
  setup: ProjectSetupResponse;
  onStarted: (response: SetupStartResponse) => void;
}

export function ProjectSetupStartForm({
  projectId,
  setup,
  onStarted,
}: ProjectSetupStartFormProps) {
  const initialAgent =
    setup.selectedAgentOptions.find(
      (agent) => setup.credentialReadiness[agent].ready
    ) ?? setup.selectedAgentOptions[0];

  const [selectedAgent, setSelectedAgent] = useState<Agent>(
    initialAgent ?? Agent.CLAUDE
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const readiness = setup.credentialReadiness[selectedAgent];

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/setup/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedAgent }),
      });

      const data = (await response.json()) as
        | SetupStartResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          'error' in data ? data.error || 'Failed to start project setup' : 'Failed to start project setup'
        );
      }

      onStarted(data as SetupStartResponse);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to start project setup'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle>
          {setup.latestAttempt?.status === 'FAILED'
            ? 'Retry Project Setup'
            : 'Start Project Setup'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Choose the agent that should create the initial AI Board project files.
          </p>
          <Select
            value={selectedAgent}
            onValueChange={(value) => setSelectedAgent(value as Agent)}
            disabled={isSubmitting}
          >
            <SelectTrigger data-testid="project-setup-agent-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {setup.selectedAgentOptions.map((agent) => (
                <SelectItem key={agent} value={agent}>
                  <div className="flex items-center gap-2">
                    <AgentIcon agent={agent} size={16} />
                    <div className="flex flex-col">
                      <span className="font-medium">{getAgentLabel(agent)}</span>
                      <span className="text-xs text-muted-foreground">
                        {getAgentDescription(agent)}
                      </span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border bg-background/70 p-3">
          <p className="text-sm font-medium text-foreground">
            {getAgentLabel(selectedAgent)} credential
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Provider: {readiness.provider}
          </p>
          <p className="mt-2 text-sm text-foreground">{readiness.message}</p>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !readiness.ready}
          data-testid="project-setup-start-button"
        >
          {setup.latestAttempt?.status === 'FAILED'
            ? 'Retry Setup'
            : 'Start Setup'}
        </Button>
      </CardContent>
    </Card>
  );
}
