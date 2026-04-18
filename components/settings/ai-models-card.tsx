'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Agent } from '@prisma/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  CLAUDE_MODEL_DEFAULT,
  CLAUDE_MODEL_WHITELIST,
  CLAUDE_STAGES,
  type ClaudeModelMap,
  type ClaudeStageKey,
  sanitizeClaudeModelMap,
} from '@/lib/workflows/claude-models';
import { getAgentLabel } from '@/app/lib/utils/agent-icons';

interface AIModelsCardProps {
  project: {
    id: number;
    defaultAgent: Agent;
    claudeModels: unknown;
  };
}

function modelForStage(map: ClaudeModelMap, stage: ClaudeStageKey): string {
  return map[stage] ?? CLAUDE_MODEL_DEFAULT;
}

export function AIModelsCard({ project }: AIModelsCardProps) {
  const router = useRouter();
  const [models, setModels] = useState<ClaudeModelMap>(() =>
    sanitizeClaudeModelMap(project.claudeModels)
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingStage, setPendingStage] = useState<ClaudeStageKey | null>(null);

  const isClaude = project.defaultAgent === Agent.CLAUDE;

  async function handleStageChange(stage: ClaudeStageKey, modelId: string) {
    const previous = models;
    const next: ClaudeModelMap = { ...previous, [stage]: modelId };

    // Optimistic update
    setModels(next);
    setError(null);
    setPendingStage(stage);

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claudeModels: next }),
      });

      if (!response.ok) {
        throw new Error('Failed to update model');
      }

      router.refresh();
    } catch (err) {
      setModels(previous);
      setError(
        err instanceof Error ? err.message : 'Failed to update model'
      );
    } finally {
      setPendingStage(null);
    }
  }

  return (
    <Card className="aurora-bg-subtle" data-testid="ai-models-card">
      <CardHeader>
        <CardTitle>AI Models</CardTitle>
        <CardDescription>
          Choose the Claude model used for each workflow stage. Ticket
          overrides (configured on individual tickets) take precedence.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isClaude ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid="ai-models-non-claude-message"
          >
            Using {getAgentLabel(project.defaultAgent)}&apos;s latest default
            model. Per-stage selection is only available for Claude today.
          </p>
        ) : (
          <div className="space-y-3">
            {CLAUDE_STAGES.map((stage) => {
              const currentModel = modelForStage(models, stage.key);
              return (
                <div
                  key={stage.key}
                  className="grid grid-cols-1 gap-2 rounded-md border border-border/50 bg-background/60 p-3 md:grid-cols-[180px_1fr] md:items-center"
                  data-testid={`ai-models-row-${stage.key}`}
                >
                  <div>
                    <p className="text-sm font-medium">{stage.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {stage.description}
                    </p>
                  </div>
                  <Select
                    value={currentModel}
                    onValueChange={(value) =>
                      handleStageChange(stage.key, value)
                    }
                    disabled={pendingStage === stage.key}
                  >
                    <SelectTrigger
                      className="w-full"
                      data-testid={`ai-models-select-${stage.key}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLAUDE_MODEL_WHITELIST.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{option.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
            {error && (
              <p
                className="text-sm text-red-600 dark:text-red-400"
                data-testid="ai-models-error"
              >
                {error}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
