'use client';

import * as React from 'react';
import { Agent, ClarificationPolicy, TokenSavingOverride } from '@prisma/client';
import { Loader2 } from 'lucide-react';
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
import { AgentIcon } from '@/components/ui/agent-icon';
import { getAgentDescription, getAgentLabel } from '@/app/lib/utils/agent-icons';
import { getPolicyDescription, getPolicyIcon, getPolicyLabel } from '@/app/lib/utils/policy-icons';
import {
  CLAUDE_MODEL_IDS,
  CLAUDE_MODEL_LABELS,
  STAGE_MODEL_KEYS,
  STAGE_MODEL_LABELS,
  type ClaudeModelId,
  type StageModelKey,
} from '@/lib/models/claude-models';
import {
  CODEX_MODEL_IDS,
  CODEX_MODEL_LABELS,
  CODEX_STAGE_MODEL_KEYS,
  CODEX_STAGE_MODEL_LABELS,
  type CodexModelId,
  type CodexStageModelKey,
} from '@/lib/models/codex-models';

const INHERIT = 'project-default';

type ClaudeStageSelection = Record<StageModelKey, string | null>;
type CodexStageSelection = Record<CodexStageModelKey, string | null>;

export interface RunSettingsModelState {
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
}

export interface RunSettingsPatch {
  agent?: Agent | null;
  clarificationPolicy?: ClarificationPolicy | null;
  tokenSavingOverride?: TokenSavingOverride | null;
}

export interface RunSettingsModelPatch extends Partial<RunSettingsModelState> {
  resetAll?: boolean;
}

interface RunSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAgent: Agent | null;
  projectDefaultAgent: Agent;
  currentPolicy: ClarificationPolicy | null;
  projectDefaultPolicy: ClarificationPolicy;
  tokenSavingOverride: TokenSavingOverride | null;
  tokenSavingProjectDefault: boolean;
  tokenSavingEffectiveEnabled: boolean;
  editable: boolean;
  effectiveAgent: Agent;
  currentModels: RunSettingsModelState;
  onSaveRunSettings: (input: RunSettingsPatch) => Promise<void>;
  onSaveModelOverrides: (input: RunSettingsModelPatch) => Promise<void>;
}

function toClaudeSelection(current: RunSettingsModelState): ClaudeStageSelection {
  return {
    specifyModel: current.specifyModel ?? null,
    planModel: current.planModel ?? null,
    implementModel: current.implementModel ?? null,
    quickImplModel: current.quickImplModel ?? null,
    verifyModel: current.verifyModel ?? null,
  };
}

function toCodexSelection(current: RunSettingsModelState): CodexStageSelection {
  return {
    codexSpecifyModel: current.codexSpecifyModel ?? null,
    codexPlanModel: current.codexPlanModel ?? null,
    codexImplementModel: current.codexImplementModel ?? null,
    codexQuickImplModel: current.codexQuickImplModel ?? null,
    codexVerifyModel: current.codexVerifyModel ?? null,
  };
}

function hasSelectedModelChanges(
  effectiveAgent: Agent,
  claudeSelection: ClaudeStageSelection,
  codexSelection: CodexStageSelection,
  currentModels: RunSettingsModelState
): boolean {
  if (effectiveAgent === Agent.CLAUDE) {
    return STAGE_MODEL_KEYS.some(
      (key) => claudeSelection[key] !== (currentModels[key] ?? null)
    );
  }

  if (effectiveAgent === Agent.CODEX) {
    return CODEX_STAGE_MODEL_KEYS.some(
      (key) => codexSelection[key] !== (currentModels[key] ?? null)
    );
  }

  return false;
}

function selectedAgentValue(value: string): Agent | null {
  return value === INHERIT ? null : (value as Agent);
}

function selectedPolicyValue(value: string): ClarificationPolicy | null {
  return value === INHERIT ? null : (value as ClarificationPolicy);
}

function selectedTokenSavingValue(value: string): TokenSavingOverride | null {
  return value === INHERIT ? null : (value as TokenSavingOverride);
}

export function RunSettingsDialog({
  open,
  onOpenChange,
  currentAgent,
  projectDefaultAgent,
  currentPolicy,
  projectDefaultPolicy,
  tokenSavingOverride,
  tokenSavingProjectDefault,
  tokenSavingEffectiveEnabled,
  editable,
  effectiveAgent,
  currentModels,
  onSaveRunSettings,
  onSaveModelOverrides,
}: RunSettingsDialogProps): React.ReactElement {
  const [selectedAgent, setSelectedAgent] = React.useState(currentAgent ?? INHERIT);
  const [selectedPolicy, setSelectedPolicy] = React.useState(currentPolicy ?? INHERIT);
  const [selectedTokenSaving, setSelectedTokenSaving] = React.useState(tokenSavingOverride ?? INHERIT);
  const [claudeSelection, setClaudeSelection] = React.useState<ClaudeStageSelection>(() =>
    toClaudeSelection(currentModels)
  );
  const [codexSelection, setCodexSelection] = React.useState<CodexStageSelection>(() =>
    toCodexSelection(currentModels)
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setSelectedAgent(currentAgent ?? INHERIT);
    setSelectedPolicy(currentPolicy ?? INHERIT);
    setSelectedTokenSaving(tokenSavingOverride ?? INHERIT);
    setClaudeSelection(toClaudeSelection(currentModels));
    setCodexSelection(toCodexSelection(currentModels));
    setError(null);
    // `currentModels` is rebuilt by the parent every render; reset only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isClaude = effectiveAgent === Agent.CLAUDE;
  const isCodex = effectiveAgent === Agent.CODEX;
  const modelsEditable = editable && (isClaude || isCodex);

  const hasRunSettingsChanges =
    selectedAgent !== (currentAgent ?? INHERIT) ||
    selectedPolicy !== (currentPolicy ?? INHERIT) ||
    selectedTokenSaving !== (tokenSavingOverride ?? INHERIT);

  const hasModelChanges = hasSelectedModelChanges(
    effectiveAgent,
    claudeSelection,
    codexSelection,
    currentModels
  );

  const hasChanges = hasRunSettingsChanges || hasModelChanges;

  async function handleSave(): Promise<void> {
    if (!editable || !hasChanges) return;
    setIsSaving(true);
    setError(null);

    try {
      if (hasRunSettingsChanges) {
        await onSaveRunSettings({
          ...(selectedAgent !== (currentAgent ?? INHERIT) && {
            agent: selectedAgentValue(selectedAgent),
          }),
          ...(selectedPolicy !== (currentPolicy ?? INHERIT) && {
            clarificationPolicy: selectedPolicyValue(selectedPolicy),
          }),
          ...(selectedTokenSaving !== (tokenSavingOverride ?? INHERIT) && {
            tokenSavingOverride: selectedTokenSavingValue(selectedTokenSaving),
          }),
        });
      }

      if (hasModelChanges) {
        if (isClaude) {
          const allNull = STAGE_MODEL_KEYS.every((key) => claudeSelection[key] == null);
          await onSaveModelOverrides(allNull ? { resetAll: true } : claudeSelection);
        } else if (isCodex) {
          const allNull = CODEX_STAGE_MODEL_KEYS.every((key) => codexSelection[key] == null);
          await onSaveModelOverrides(allNull ? { resetAll: true } : codexSelection);
        }
      }

      onOpenChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save run settings');
    } finally {
      setIsSaving(false);
    }
  }

  let modelControls: React.ReactNode;
  if (!isClaude && !isCodex) {
    modelControls = (
      <p className="text-sm text-muted-foreground">
        Model overrides are inactive for {effectiveAgent}.
      </p>
    );
  } else if (isClaude) {
    modelControls = STAGE_MODEL_KEYS.map((stage) => (
      <div key={stage} className="grid gap-2 sm:grid-cols-[120px_1fr] sm:items-center">
        <Label htmlFor={`run-settings-${stage}`}>{STAGE_MODEL_LABELS[stage]}</Label>
        <Select
          value={claudeSelection[stage] ?? INHERIT}
          onValueChange={(value) =>
            setClaudeSelection((current) => ({
              ...current,
              [stage]: value === INHERIT ? null : (value as ClaudeModelId),
            }))
          }
          disabled={!modelsEditable || isSaving}
        >
          <SelectTrigger id={`run-settings-${stage}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={INHERIT}>Inherit from project default</SelectItem>
            {CLAUDE_MODEL_IDS.map((model) => (
              <SelectItem key={model} value={model}>
                {CLAUDE_MODEL_LABELS[model]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ));
  } else {
    modelControls = CODEX_STAGE_MODEL_KEYS.map((stage) => (
      <div key={stage} className="grid gap-2 sm:grid-cols-[120px_1fr] sm:items-center">
        <Label htmlFor={`run-settings-${stage}`}>{CODEX_STAGE_MODEL_LABELS[stage]}</Label>
        <Select
          value={codexSelection[stage] ?? INHERIT}
          onValueChange={(value) =>
            setCodexSelection((current) => ({
              ...current,
              [stage]: value === INHERIT ? null : (value as CodexModelId),
            }))
          }
          disabled={!modelsEditable || isSaving}
        >
          <SelectTrigger id={`run-settings-${stage}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={INHERIT}>Inherit from project default</SelectItem>
            {CODEX_MODEL_IDS.map((model) => (
              <SelectItem key={model} value={model}>
                {CODEX_MODEL_LABELS[model]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Run settings</DialogTitle>
          <DialogDescription>
            Configure this ticket&apos;s inherited and overridden run settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!editable && (
            <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
              Read-only
            </div>
          )}

          <section className="rounded-md border border-border p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Agent</h3>
            <Label htmlFor="run-settings-agent">Override</Label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent} disabled={!editable || isSaving}>
              <SelectTrigger id="run-settings-agent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={INHERIT}>
                  <span className="inline-flex items-center gap-1.5">
                    <AgentIcon agent={projectDefaultAgent} size={14} />
                    Inherit {getAgentLabel(projectDefaultAgent)}
                  </span>
                </SelectItem>
                {Object.values(Agent).map((agent) => (
                  <SelectItem key={agent} value={agent}>
                    {getAgentLabel(agent)} - {getAgentDescription(agent)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section className="rounded-md border border-border p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Clarification policy</h3>
            <Label htmlFor="run-settings-policy">Override</Label>
            <Select value={selectedPolicy} onValueChange={setSelectedPolicy} disabled={!editable || isSaving}>
              <SelectTrigger id="run-settings-policy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={INHERIT}>
                  Inherit {getPolicyIcon(projectDefaultPolicy)} {getPolicyLabel(projectDefaultPolicy)}
                </SelectItem>
                {[ClarificationPolicy.AUTO, ClarificationPolicy.CONSERVATIVE, ClarificationPolicy.PRAGMATIC].map((policy) => (
                  <SelectItem key={policy} value={policy}>
                    {getPolicyIcon(policy)} {getPolicyLabel(policy)} - {getPolicyDescription(policy)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section className="rounded-md border border-border p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Token saving</h3>
              <span className="text-sm text-muted-foreground">
                Effective: {tokenSavingEffectiveEnabled ? 'On' : 'Off'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Project default: {tokenSavingProjectDefault ? 'On' : 'Off'}
            </p>
            <Label htmlFor="run-settings-token-saving">Override</Label>
            <Select
              value={selectedTokenSaving}
              onValueChange={setSelectedTokenSaving}
              disabled={!editable || isSaving}
            >
              <SelectTrigger id="run-settings-token-saving">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={INHERIT}>Inherit project default</SelectItem>
                <SelectItem value={TokenSavingOverride.FORCE_ON}>Force on</SelectItem>
                <SelectItem value={TokenSavingOverride.FORCE_OFF}>Force off</SelectItem>
              </SelectContent>
            </Select>
          </section>

          <section className="rounded-md border border-border p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Models</h3>
            {modelControls}
          </section>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!editable || !hasChanges || isSaving}
            data-testid="run-settings-save"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
