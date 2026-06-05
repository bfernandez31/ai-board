'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Settings2, Loader2 } from 'lucide-react';
import { Agent, ClarificationPolicy } from '@prisma/client';
import { AgentIcon } from '@/components/ui/agent-icon';
import { getAgentLabel } from '@/app/lib/utils/agent-icons';
import { getPolicyLabel } from '@/app/lib/utils/policy-icons';
import { PolicyEditDialog } from '@/components/tickets/policy-edit-dialog';
import { AgentEditDialog } from '@/components/tickets/agent-edit-dialog';
import { ModelOverrideDialog } from '@/components/tickets/model-override-dialog';

const STAGE_MODEL_FIELDS = [
  'specifyModel',
  'planModel',
  'implementModel',
  'quickImplModel',
  'verifyModel',
  'codexSpecifyModel',
  'codexPlanModel',
  'codexImplementModel',
  'codexQuickImplModel',
  'codexVerifyModel',
] as const;

type ModelFields = {
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

type ModelSaveInput = Partial<ModelFields> & { resetAll?: boolean };

const TOKEN_SAVING_INHERIT = 'inherit';
const TOKEN_SAVING_ON = 'on';
const TOKEN_SAVING_OFF = 'off';

/** Map a ticket override (`true`/`false`/`null`) to its Select value. */
function tokenSavingToSelectValue(tokenSaving: boolean | null): string {
  if (tokenSaving === null) return TOKEN_SAVING_INHERIT;
  return tokenSaving ? TOKEN_SAVING_ON : TOKEN_SAVING_OFF;
}

/** Map a Select value back to a ticket override (`null` = inherit/clear). */
function selectValueToTokenSaving(value: string): boolean | null {
  if (value === TOKEN_SAVING_INHERIT) return null;
  return value === TOKEN_SAVING_ON;
}

export interface RunSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  ticket: {
    id: number;
    stage: string;
    version: number;
    agent: Agent | null;
    clarificationPolicy: ClarificationPolicy | null;
    tokenSaving: boolean | null;
  } & ModelFields;
  project: {
    defaultAgent: Agent;
    clarificationPolicy: ClarificationPolicy;
    tokenSaving: boolean;
  };
  /** True while a RUNNING/PENDING job exists — disables the token-saving control (FR-013). */
  isRunActive?: boolean;
  onSavePolicy: (policy: ClarificationPolicy | null) => Promise<void>;
  onSaveAgent: (agent: Agent | null) => Promise<void>;
  onSaveModels: (input: ModelSaveInput) => Promise<void>;
  /** Called after the token-saving override persists (to update the parent ticket). */
  onTokenSavingSaved: (tokenSaving: boolean | null, version: number) => void;
}

/**
 * RunSettingsDialog (AIB-849, US3)
 *
 * A single consolidated dialog hosting all per-ticket run overrides as four
 * sections: Agent, Models (per stage), Clarification policy, and Token saving.
 * Agent and Policy keep their INBOX-only edit rule; Models keep per-stage rules;
 * Token saving is editable at any stage unless a run is active. Each section
 * persists through its own endpoint via the existing dialogs / the token-saving
 * route — existing validation and permissions are unchanged (FR-011/FR-012/FR-016).
 */
export function RunSettingsDialog({
  open,
  onOpenChange,
  projectId,
  ticket,
  project,
  isRunActive = false,
  onSavePolicy,
  onSaveAgent,
  onSaveModels,
  onTokenSavingSaved,
}: RunSettingsDialogProps) {
  const [agentEditOpen, setAgentEditOpen] = React.useState(false);
  const [policyEditOpen, setPolicyEditOpen] = React.useState(false);
  const [modelOverrideOpen, setModelOverrideOpen] = React.useState(false);
  const [tokenSavingSaving, setTokenSavingSaving] = React.useState(false);
  const [tokenSavingError, setTokenSavingError] = React.useState<string | null>(null);

  const isInboxStage = ticket.stage === 'INBOX';
  const effectiveAgent = ticket.agent ?? project.defaultAgent;
  const isAgentOverride = ticket.agent != null;
  const effectivePolicy = ticket.clarificationPolicy ?? project.clarificationPolicy;
  const isPolicyOverride = ticket.clarificationPolicy != null;
  const overriddenModelCount = STAGE_MODEL_FIELDS.filter((k) => ticket[k] != null).length;

  // Optimistic local select value: reflects the new choice immediately and
  // reverts on failure (constitution: optimistic updates required for mutations).
  const [tokenSavingValue, setTokenSavingValue] = React.useState(
    tokenSavingToSelectValue(ticket.tokenSaving)
  );

  // Re-sync when the ticket override changes upstream (e.g. external refresh).
  React.useEffect(() => {
    setTokenSavingValue(tokenSavingToSelectValue(ticket.tokenSaving));
  }, [ticket.tokenSaving]);

  async function handleTokenSavingChange(value: string) {
    const next = selectValueToTokenSaving(value);
    const previousValue = tokenSavingValue;
    setTokenSavingValue(value); // optimistic
    setTokenSavingSaving(true);
    setTokenSavingError(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticket.id}/token-saving`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokenSaving: next, version: ticket.version }),
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setTokenSavingValue(previousValue); // revert
        setTokenSavingError(
          body?.code === 'ACTIVE_RUN'
            ? 'Cannot change token saving while a run is in progress'
            : body?.error || 'Failed to update token saving'
        );
        return;
      }
      const data = await response.json();
      onTokenSavingSaved(data.tokenSaving ?? null, data.version);
    } catch {
      setTokenSavingValue(previousValue); // revert
      setTokenSavingError('Failed to update token saving');
    } finally {
      setTokenSavingSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="aurora-dialog sm:max-w-lg" data-testid="run-settings-dialog">
          <DialogHeader>
            <DialogTitle>Run settings</DialogTitle>
            <DialogDescription>
              Per-ticket overrides for this ticket&apos;s runs. Unset values inherit the
              project default.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Agent */}
            <div
              className="flex items-center justify-between gap-3"
              data-testid="run-settings-section-agent"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">Agent</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <AgentIcon agent={effectiveAgent} size={14} />
                  {getAgentLabel(effectiveAgent)}
                  {isAgentOverride ? (
                    <span data-testid="agent-override-indicator">(override)</span>
                  ) : (
                    <span data-testid="agent-inherited-indicator">(inherited)</span>
                  )}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAgentEditOpen(true)}
                disabled={!isInboxStage}
                data-testid="run-settings-edit-agent"
              >
                <Settings2 className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
            </div>

            {/* Models (per stage) */}
            <div
              className="flex items-center justify-between gap-3"
              data-testid="run-settings-section-models"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">Models (per stage)</span>
                <span className="text-xs text-muted-foreground">
                  {overriddenModelCount > 0
                    ? `${overriddenModelCount} stage override${overriddenModelCount > 1 ? 's' : ''}`
                    : 'Inherited from project'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModelOverrideOpen(true)}
                data-testid="run-settings-edit-models"
              >
                <Settings2 className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
            </div>

            {/* Clarification policy */}
            <div
              className="flex items-center justify-between gap-3"
              data-testid="run-settings-section-policy"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">Clarification policy</span>
                <span className="text-xs text-muted-foreground">
                  {getPolicyLabel(effectivePolicy)}{' '}
                  {isPolicyOverride ? (
                    <span data-testid="policy-override-indicator">(override)</span>
                  ) : (
                    <span data-testid="policy-inherited-indicator">(inherited)</span>
                  )}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPolicyEditOpen(true)}
                disabled={!isInboxStage}
                data-testid="run-settings-edit-policy"
              >
                <Settings2 className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
            </div>

            {/* Token saving */}
            <div
              className="flex items-center justify-between gap-3"
              data-testid="run-settings-section-token-saving"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">Token saving</span>
                <span className="text-xs text-muted-foreground">
                  Project default: {project.tokenSaving ? 'ON' : 'OFF'}
                  {ticket.tokenSaving !== null ? ' (override)' : ' (inherited)'}
                </span>
                {tokenSavingError && (
                  <span className="text-xs text-destructive" data-testid="token-saving-error">
                    {tokenSavingError}
                  </span>
                )}
              </div>
              <Select
                value={tokenSavingValue}
                onValueChange={handleTokenSavingChange}
                disabled={isRunActive || tokenSavingSaving}
              >
                <SelectTrigger className="w-[150px]" data-testid="token-saving-select">
                  {tokenSavingSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <SelectValue />
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TOKEN_SAVING_INHERIT}>Inherit</SelectItem>
                  <SelectItem value={TOKEN_SAVING_ON}>Force ON</SelectItem>
                  <SelectItem value={TOKEN_SAVING_OFF}>Force OFF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Composed standalone dialogs — reused verbatim so their validation/permissions are unchanged */}
      <AgentEditDialog
        open={agentEditOpen}
        onOpenChange={setAgentEditOpen}
        currentAgent={ticket.agent}
        projectDefaultAgent={project.defaultAgent}
        onSave={onSaveAgent}
      />
      <PolicyEditDialog
        open={policyEditOpen}
        onOpenChange={setPolicyEditOpen}
        currentPolicy={ticket.clarificationPolicy}
        projectDefaultPolicy={project.clarificationPolicy}
        onSave={onSavePolicy}
      />
      <ModelOverrideDialog
        open={modelOverrideOpen}
        onOpenChange={setModelOverrideOpen}
        effectiveAgent={effectiveAgent}
        current={{
          specifyModel: ticket.specifyModel,
          planModel: ticket.planModel,
          implementModel: ticket.implementModel,
          quickImplModel: ticket.quickImplModel,
          verifyModel: ticket.verifyModel,
          codexSpecifyModel: ticket.codexSpecifyModel,
          codexPlanModel: ticket.codexPlanModel,
          codexImplementModel: ticket.codexImplementModel,
          codexQuickImplModel: ticket.codexQuickImplModel,
          codexVerifyModel: ticket.codexVerifyModel,
        }}
        onSave={onSaveModels}
      />
    </>
  );
}
