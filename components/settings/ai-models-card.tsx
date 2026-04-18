'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Agent } from '@prisma/client';
import {
  CLAUDE_MODEL_IDS,
  CLAUDE_MODEL_LABELS,
  STAGE_MODEL_KEYS,
  STAGE_MODEL_LABELS,
  SMART_DEFAULTS,
  type StageModelKey,
  type ClaudeModelId,
} from '@/lib/models/claude-models';
import { useRouter } from 'next/navigation';

const FALLBACK_SENTINEL = 'fallback-default';

interface AIModelsCardProps {
  project: {
    id: number;
    defaultAgent: Agent;
    specifyModel: string | null;
    planModel: string | null;
    implementModel: string | null;
    quickImplModel: string | null;
    verifyModel: string | null;
  };
}

type ModelConfigState = Record<StageModelKey, string | null>;

function initialState(project: AIModelsCardProps['project']): ModelConfigState {
  return {
    specifyModel: project.specifyModel,
    planModel: project.planModel,
    implementModel: project.implementModel,
    quickImplModel: project.quickImplModel,
    verifyModel: project.verifyModel,
  };
}

export function AIModelsCard({ project }: AIModelsCardProps) {
  const router = useRouter();
  const [state, setState] = useState<ModelConfigState>(() => initialState(project));
  const [isUpdating, setIsUpdating] = useState(false);

  const isClaude = project.defaultAgent === Agent.CLAUDE;

  async function handleStageChange(stage: StageModelKey, nextValue: string | null) {
    const previous = state[stage];
    setState((prev) => ({ ...prev, [stage]: nextValue }));
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [stage]: nextValue }),
      });
      if (!response.ok) {
        throw new Error('Failed to update model');
      }
      router.refresh();
    } catch (error) {
      console.error('Error updating model:', error);
      setState((prev) => ({ ...prev, [stage]: previous }));
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleApplySmartDefaults() {
    const previous = state;
    setState({ ...SMART_DEFAULTS });
    setIsUpdating(true);
    try {
      const response = await fetch(
        `/api/projects/${project.id}/model-config/apply-smart-defaults`,
        { method: 'POST' }
      );
      if (!response.ok) {
        throw new Error('Failed to apply smart defaults');
      }
      router.refresh();
    } catch (error) {
      console.error('Error applying smart defaults:', error);
      setState(previous);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <Card className="aurora-bg-subtle" data-testid="ai-models-card">
      <CardHeader>
        <CardTitle>AI Models</CardTitle>
        <CardDescription>
          Per-stage Claude model used by workflows. Applies when the effective agent is Claude.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isClaude ? (
          <p className="text-sm text-muted-foreground" data-testid="ai-models-card-inactive">
            Per-stage models apply only when the project&apos;s default agent is Claude. This
            configuration is stored but dormant for the current agent.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {STAGE_MODEL_KEYS.map((stage) => {
                const current = state[stage];
                const selectValue = current ?? FALLBACK_SENTINEL;
                return (
                  <div
                    key={stage}
                    className="flex items-center justify-between gap-4"
                    data-testid={`model-row-${stage}`}
                  >
                    <label className="text-sm font-medium w-32" htmlFor={`${stage}-select`}>
                      {STAGE_MODEL_LABELS[stage]}
                    </label>
                    <Select
                      value={selectValue}
                      onValueChange={(value) => {
                        const mapped = value === FALLBACK_SENTINEL ? null : (value as ClaudeModelId);
                        void handleStageChange(stage, mapped);
                      }}
                      disabled={isUpdating}
                    >
                      <SelectTrigger
                        id={`${stage}-select`}
                        className="flex-1"
                        data-testid={`${stage}-trigger`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={FALLBACK_SENTINEL}>
                          Use global fallback (Claude Opus 4.7)
                        </SelectItem>
                        {CLAUDE_MODEL_IDS.map((modelId) => (
                          <SelectItem key={modelId} value={modelId}>
                            {CLAUDE_MODEL_LABELS[modelId]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleApplySmartDefaults()}
                disabled={isUpdating}
                data-testid="apply-smart-defaults"
              >
                Apply smart defaults
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
