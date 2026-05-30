'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Agent } from '@prisma/client';
import {
  CLAUDE_MODEL_IDS,
  CLAUDE_MODEL_LABELS,
  STAGE_MODEL_KEYS,
  STAGE_MODEL_LABELS,
  type StageModelKey,
  type ClaudeModelId,
} from '@/lib/models/claude-models';
import {
  CODEX_MODEL_IDS,
  CODEX_MODEL_LABELS,
  CODEX_STAGE_MODEL_KEYS,
  CODEX_STAGE_MODEL_LABELS,
  type CodexStageModelKey,
  type CodexModelId,
} from '@/lib/models/codex-models';
import { Loader2 } from 'lucide-react';

const PROJECT_DEFAULT_SENTINEL = 'project-default';

type ClaudeStageSelection = Record<StageModelKey, string | null>;
type CodexStageSelection = Record<CodexStageModelKey, string | null>;

function toClaudeSelection(overrides: Partial<ClaudeStageSelection>): ClaudeStageSelection {
  return {
    specifyModel: overrides.specifyModel ?? null,
    planModel: overrides.planModel ?? null,
    implementModel: overrides.implementModel ?? null,
    quickImplModel: overrides.quickImplModel ?? null,
    verifyModel: overrides.verifyModel ?? null,
  };
}

function toCodexSelection(overrides: Partial<CodexStageSelection>): CodexStageSelection {
  return {
    codexSpecifyModel: overrides.codexSpecifyModel ?? null,
    codexPlanModel: overrides.codexPlanModel ?? null,
    codexImplementModel: overrides.codexImplementModel ?? null,
    codexQuickImplModel: overrides.codexQuickImplModel ?? null,
    codexVerifyModel: overrides.codexVerifyModel ?? null,
  };
}

interface ModelOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  effectiveAgent: Agent;
  current: {
    specifyModel: string | null;
    planModel: string | null;
    implementModel: string | null;
    quickImplModel: string | null;
    verifyModel: string | null;
    codexSpecifyModel?: string | null;
    codexPlanModel?: string | null;
    codexImplementModel?: string | null;
    codexQuickImplModel?: string | null;
    codexVerifyModel?: string | null;
  };
  onSave: (input: {
    specifyModel?: string | null;
    planModel?: string | null;
    implementModel?: string | null;
    quickImplModel?: string | null;
    verifyModel?: string | null;
    codexSpecifyModel?: string | null;
    codexPlanModel?: string | null;
    codexImplementModel?: string | null;
    codexQuickImplModel?: string | null;
    codexVerifyModel?: string | null;
    resetAll?: boolean;
  }) => Promise<void>;
}

export function ModelOverrideDialog({
  open,
  onOpenChange,
  effectiveAgent,
  current,
  onSave,
}: ModelOverrideDialogProps) {
  const [claudeSelection, setClaudeSelection] = React.useState<ClaudeStageSelection>(() =>
    toClaudeSelection(current)
  );
  const [codexSelection, setCodexSelection] = React.useState<CodexStageSelection>(() =>
    toCodexSelection(current)
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setClaudeSelection(toClaudeSelection(current));
      setCodexSelection(toCodexSelection(current));
      setError(null);
    }
    // `current` is a fresh object literal on every parent render; including it
    // in deps would wipe the user's in-progress selection each polling tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isClaude = effectiveAgent === Agent.CLAUDE;
  const isCodex = effectiveAgent === Agent.CODEX;
  const isConfigurable = isClaude || isCodex;

  const hasChanges = React.useMemo(() => {
    if (isClaude) {
      return STAGE_MODEL_KEYS.some((key) => claudeSelection[key] !== (current[key] ?? null));
    }
    if (isCodex) {
      return CODEX_STAGE_MODEL_KEYS.some(
        (key) => codexSelection[key] !== (current[key] ?? null)
      );
    }
    return false;
  }, [isClaude, isCodex, claudeSelection, codexSelection, current]);

  const handleClaudeStageChange = (stage: StageModelKey, value: string) => {
    const mapped = value === PROJECT_DEFAULT_SENTINEL ? null : (value as ClaudeModelId);
    setClaudeSelection((prev) => ({ ...prev, [stage]: mapped }));
  };

  const handleCodexStageChange = (stage: CodexStageModelKey, value: string) => {
    const mapped = value === PROJECT_DEFAULT_SENTINEL ? null : (value as CodexModelId);
    setCodexSelection((prev) => ({ ...prev, [stage]: mapped }));
  };

  const handleResetAll = () => {
    setClaudeSelection(toClaudeSelection({}));
    setCodexSelection(toCodexSelection({}));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      if (isClaude) {
        const allNull = STAGE_MODEL_KEYS.every((key) => claudeSelection[key] == null);
        if (allNull) {
          await onSave({ resetAll: true });
        } else {
          await onSave(claudeSelection);
        }
      } else if (isCodex) {
        const allNull = CODEX_STAGE_MODEL_KEYS.every((key) => codexSelection[key] == null);
        if (allNull) {
          await onSave({ resetAll: true });
        } else {
          await onSave(codexSelection);
        }
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save model overrides');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Per-stage model overrides</DialogTitle>
          <DialogDescription>
            {isCodex
              ? 'Pick a Codex model per stage or inherit the project default.'
              : 'Pick a Claude model per stage or inherit the project default.'}
          </DialogDescription>
        </DialogHeader>

        {!isConfigurable ? (
          <div
            className="rounded-md bg-muted p-3 text-sm text-muted-foreground"
            data-testid="model-override-inactive"
          >
            This ticket&apos;s effective agent is <strong>{effectiveAgent}</strong>. Per-stage model
            overrides are only used when the effective agent is Claude or Codex. Any values stored
            here are preserved but inactive until the agent is switched back.
          </div>
        ) : isClaude ? (
          <div className="space-y-3 py-2">
            {STAGE_MODEL_KEYS.map((stage) => {
              const value = claudeSelection[stage] ?? PROJECT_DEFAULT_SENTINEL;
              return (
                <div key={stage} className="flex items-center gap-3" data-testid={`row-${stage}`}>
                  <Label htmlFor={`${stage}-select`} className="w-28 text-sm">
                    {STAGE_MODEL_LABELS[stage]}
                  </Label>
                  <Select
                    value={value}
                    onValueChange={(v) => handleClaudeStageChange(stage, v)}
                    disabled={isSaving}
                  >
                    <SelectTrigger
                      id={`${stage}-select`}
                      className="flex-1"
                      data-testid={`${stage}-override-trigger`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PROJECT_DEFAULT_SENTINEL}>
                        Inherit from project default
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

            <div className="flex justify-start pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetAll}
                disabled={isSaving}
                data-testid="reset-all-overrides"
              >
                Reset all to project defaults
              </Button>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {CODEX_STAGE_MODEL_KEYS.map((stage) => {
              const value = codexSelection[stage] ?? PROJECT_DEFAULT_SENTINEL;
              return (
                <div key={stage} className="flex items-center gap-3" data-testid={`row-${stage}`}>
                  <Label htmlFor={`${stage}-select`} className="w-28 text-sm">
                    {CODEX_STAGE_MODEL_LABELS[stage]}
                  </Label>
                  <Select
                    value={value}
                    onValueChange={(v) => handleCodexStageChange(stage, v)}
                    disabled={isSaving}
                  >
                    <SelectTrigger
                      id={`${stage}-select`}
                      className="flex-1"
                      data-testid={`${stage}-override-trigger`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PROJECT_DEFAULT_SENTINEL}>
                        Inherit from project default
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

            <div className="flex justify-start pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetAll}
                disabled={isSaving}
                data-testid="reset-all-overrides"
              >
                Reset all to project defaults
              </Button>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving || !isConfigurable}
            className="flex items-center gap-2"
            data-testid="save-model-overrides"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
