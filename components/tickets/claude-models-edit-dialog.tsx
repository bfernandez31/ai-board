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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Agent } from '@prisma/client';
import {
  CLAUDE_MODEL_WHITELIST,
  CLAUDE_STAGES,
  sanitizeClaudeModelMap,
  getClaudeModelLabel,
  CLAUDE_MODEL_DEFAULT,
  type ClaudeModelMap,
  type ClaudeStageKey,
} from '@/lib/workflows/claude-models';
import { getAgentLabel } from '@/app/lib/utils/agent-icons';
import { Loader2 } from 'lucide-react';

const INHERIT_VALUE = '__inherit__';

interface ClaudeModelsEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  effectiveAgent: Agent;
  projectClaudeModels: unknown;
  ticketClaudeModelOverrides: unknown;
  onSave: (overrides: ClaudeModelMap | null) => Promise<void>;
}

/**
 * Per-stage Claude model override dialog. Each stage either picks a specific
 * model or inherits from the project default. Only rendered for tickets whose
 * effective agent is Claude.
 */
export function ClaudeModelsEditDialog({
  open,
  onOpenChange,
  effectiveAgent,
  projectClaudeModels,
  ticketClaudeModelOverrides,
  onSave,
}: ClaudeModelsEditDialogProps) {
  const isClaude = effectiveAgent === Agent.CLAUDE;

  const initialOverrides = React.useMemo(
    () => sanitizeClaudeModelMap(ticketClaudeModelOverrides),
    [ticketClaudeModelOverrides]
  );
  const projectDefaults = React.useMemo(
    () => sanitizeClaudeModelMap(projectClaudeModels),
    [projectClaudeModels]
  );

  const [selections, setSelections] = React.useState<ClaudeModelMap>(initialOverrides);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setSelections(initialOverrides);
      setError(null);
    }
  }, [open, initialOverrides]);

  const handleStageChange = (stage: ClaudeStageKey, value: string) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (value === INHERIT_VALUE) {
        delete next[stage];
      } else {
        next[stage] = value;
      }
      return next;
    });
  };

  const handleResetAll = () => {
    setSelections({});
  };

  const hasChanges = React.useMemo(() => {
    const a = selections;
    const b = initialOverrides;
    const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (a[k as ClaudeStageKey] !== b[k as ClaudeStageKey]) return true;
    }
    return false;
  }, [selections, initialOverrides]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const next = Object.keys(selections).length === 0 ? null : selections;
      await onSave(next);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update models');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[560px]"
        data-testid="claude-models-edit-dialog"
      >
        <DialogHeader>
          <DialogTitle>Per-stage Claude Models</DialogTitle>
          <DialogDescription>
            Override the Claude model used for each workflow stage on this
            ticket. Each stage can inherit the project default or pick its
            own model.
          </DialogDescription>
        </DialogHeader>

        {!isClaude ? (
          <div
            className="py-4 text-sm text-muted-foreground"
            data-testid="claude-models-non-claude-message"
          >
            Using {getAgentLabel(effectiveAgent)}&apos;s latest default model.
            Per-stage selection is only available for Claude today.
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {CLAUDE_STAGES.map((stage) => {
              const selected = selections[stage.key];
              const selectValue = selected ?? INHERIT_VALUE;
              const inheritedModel =
                projectDefaults[stage.key] ?? CLAUDE_MODEL_DEFAULT;

              return (
                <div
                  key={stage.key}
                  className="grid grid-cols-1 gap-2 rounded-md border border-border/50 bg-background/60 p-3 md:grid-cols-[180px_1fr] md:items-center"
                  data-testid={`claude-models-dialog-row-${stage.key}`}
                >
                  <div>
                    <p className="text-sm font-medium">{stage.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {stage.description}
                    </p>
                  </div>
                  <Select
                    value={selectValue}
                    onValueChange={(value) =>
                      handleStageChange(stage.key, value)
                    }
                    disabled={isSaving}
                  >
                    <SelectTrigger
                      className="w-full"
                      data-testid={`claude-models-dialog-select-${stage.key}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={INHERIT_VALUE}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">
                            Inherit from project default
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {getClaudeModelLabel(inheritedModel)}
                          </span>
                        </div>
                      </SelectItem>
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

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetAll}
                disabled={isSaving || Object.keys(selections).length === 0}
                data-testid="claude-models-dialog-reset-all"
              >
                Reset all to project defaults
              </Button>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
                <p
                  className="text-sm text-red-600 dark:text-red-400"
                  data-testid="claude-models-dialog-error"
                >
                  {error}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          {isClaude && (
            <Button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="flex items-center gap-2"
              data-testid="claude-models-dialog-save"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
