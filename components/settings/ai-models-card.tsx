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
import {
  CODEX_MODEL_IDS,
  CODEX_MODEL_LABELS,
  CODEX_STAGE_MODEL_KEYS,
  CODEX_STAGE_MODEL_LABELS,
  CODEX_SMART_DEFAULTS,
  type CodexStageModelKey,
  type CodexModelId,
} from '@/lib/models/codex-models';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getAgentLabel } from '@/app/lib/utils/agent-icons';

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
    codexSpecifyModel: string | null;
    codexPlanModel: string | null;
    codexImplementModel: string | null;
    codexQuickImplModel: string | null;
    codexVerifyModel: string | null;
  };
}

type ClaudeModelConfigState = Record<StageModelKey, string | null>;
type CodexModelConfigState = Record<CodexStageModelKey, string | null>;

function initialClaudeState(project: AIModelsCardProps['project']): ClaudeModelConfigState {
  return {
    specifyModel: project.specifyModel,
    planModel: project.planModel,
    implementModel: project.implementModel,
    quickImplModel: project.quickImplModel,
    verifyModel: project.verifyModel,
  };
}

function initialCodexState(project: AIModelsCardProps['project']): CodexModelConfigState {
  return {
    codexSpecifyModel: project.codexSpecifyModel,
    codexPlanModel: project.codexPlanModel,
    codexImplementModel: project.codexImplementModel,
    codexQuickImplModel: project.codexQuickImplModel,
    codexVerifyModel: project.codexVerifyModel,
  };
}

export function AIModelsCard({ project }: AIModelsCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [claudeState, setClaudeState] = useState<ClaudeModelConfigState>(() => initialClaudeState(project));
  const [codexState, setCodexState] = useState<CodexModelConfigState>(() => initialCodexState(project));
  const [isUpdating, setIsUpdating] = useState(false);

  const isClaude = project.defaultAgent === Agent.CLAUDE;
  const isCodex = project.defaultAgent === Agent.CODEX;

  async function handleClaudeStageChange(stage: StageModelKey, nextValue: string | null) {
    const previous = claudeState[stage];
    setClaudeState((prev) => ({ ...prev, [stage]: nextValue }));
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
      setClaudeState((prev) => ({ ...prev, [stage]: previous }));
      toast({
        variant: 'destructive',
        title: 'Failed to update model',
        description: 'Previous selection restored. Please try again.',
      });
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleCodexStageChange(stage: CodexStageModelKey, nextValue: string | null) {
    const previous = codexState[stage];
    setCodexState((prev) => ({ ...prev, [stage]: nextValue }));
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
      setCodexState((prev) => ({ ...prev, [stage]: previous }));
      toast({
        variant: 'destructive',
        title: 'Failed to update model',
        description: 'Previous selection restored. Please try again.',
      });
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleApplySmartDefaults() {
    const previousClaude = claudeState;
    const previousCodex = codexState;
    if (isClaude) {
      setClaudeState({ ...SMART_DEFAULTS });
    } else if (isCodex) {
      setCodexState({ ...CODEX_SMART_DEFAULTS });
    }
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
      setClaudeState(previousClaude);
      setCodexState(previousCodex);
      toast({
        variant: 'destructive',
        title: 'Failed to apply smart defaults',
        description: 'Previous selections restored. Please try again.',
      });
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <Card className="aurora-bg-subtle" data-testid="ai-models-card">
      <CardHeader>
        <CardTitle>AI Models</CardTitle>
        <CardDescription>
          {isCodex
            ? 'Per-stage Codex model used by workflows. Applies when the effective agent is Codex.'
            : 'Per-stage Claude model used by workflows. Applies when the effective agent is Claude.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isClaude ? (
          <>
            <div className="space-y-3">
              {STAGE_MODEL_KEYS.map((stage) => {
                const current = claudeState[stage];
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
                        void handleClaudeStageChange(stage, mapped);
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
        ) : isCodex ? (
          <>
            <div className="space-y-3">
              {CODEX_STAGE_MODEL_KEYS.map((stage) => {
                const current = codexState[stage];
                const selectValue = current ?? FALLBACK_SENTINEL;
                return (
                  <div
                    key={stage}
                    className="flex items-center justify-between gap-4"
                    data-testid={`model-row-${stage}`}
                  >
                    <label className="text-sm font-medium w-32" htmlFor={`${stage}-select`}>
                      {CODEX_STAGE_MODEL_LABELS[stage]}
                    </label>
                    <Select
                      value={selectValue}
                      onValueChange={(value) => {
                        const mapped = value === FALLBACK_SENTINEL ? null : (value as CodexModelId);
                        void handleCodexStageChange(stage, mapped);
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
                          Use global fallback (GPT-5.5)
                        </SelectItem>
                        {CODEX_MODEL_IDS.map((modelId) => (
                          <SelectItem key={modelId} value={modelId}>
                            {CODEX_MODEL_LABELS[modelId]}
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
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="ai-models-card-inactive">
            {`Using ${getAgentLabel(project.defaultAgent)}'s latest default model. Per-stage selection is only available for Claude and Codex today.`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
