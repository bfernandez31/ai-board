'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ClarificationPolicy, Agent } from '@prisma/client';
import { PolicyEditDialog } from '@/components/tickets/policy-edit-dialog';
import { AgentEditDialog } from '@/components/tickets/agent-edit-dialog';
import { ModelOverrideDialog } from '@/components/tickets/model-override-dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface RunSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isInboxStage: boolean;
  currentPolicy: ClarificationPolicy | null;
  projectDefaultPolicy: ClarificationPolicy;
  onSavePolicy: (policy: ClarificationPolicy | null) => Promise<void>;
  currentAgent: Agent | null;
  projectDefaultAgent: Agent | null;
  onSaveAgent: (agent: Agent | null) => Promise<void>;
  effectiveAgent: Agent;
  currentModels: {
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
  onSaveModels: (input: {
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
  currentTokenSaving: boolean | null;
  projectDefaultTokenSaving: boolean;
  onSaveTokenSaving: (tokenSaving: boolean | null) => Promise<void>;
}

type TokenSavingSelection = 'project-default' | 'true' | 'false';

export function RunSettingsDialog({
  open,
  onOpenChange,
  isInboxStage,
  currentPolicy,
  projectDefaultPolicy,
  onSavePolicy,
  currentAgent,
  projectDefaultAgent,
  onSaveAgent,
  effectiveAgent,
  currentModels,
  onSaveModels,
  currentTokenSaving,
  projectDefaultTokenSaving,
  onSaveTokenSaving,
}: RunSettingsDialogProps) {
  const [policySubOpen, setPolicySubOpen] = React.useState(false);
  const [agentSubOpen, setAgentSubOpen] = React.useState(false);
  const [modelSubOpen, setModelSubOpen] = React.useState(false);

  const [tokenSavingSelection, setTokenSavingSelection] = React.useState<TokenSavingSelection>(
    currentTokenSaving === null ? 'project-default' : currentTokenSaving ? 'true' : 'false'
  );
  const [isSavingTokenSaving, setIsSavingTokenSaving] = React.useState(false);
  const [tokenSavingError, setTokenSavingError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setTokenSavingSelection(
        currentTokenSaving === null ? 'project-default' : currentTokenSaving ? 'true' : 'false'
      );
      setTokenSavingError(null);
    }
  }, [open, currentTokenSaving]);

  const tokenSavingHasChanges = React.useMemo(() => {
    const currentAsSelection: TokenSavingSelection =
      currentTokenSaving === null ? 'project-default' : currentTokenSaving ? 'true' : 'false';
    return tokenSavingSelection !== currentAsSelection;
  }, [tokenSavingSelection, currentTokenSaving]);

  const handleSaveTokenSaving = async () => {
    setIsSavingTokenSaving(true);
    setTokenSavingError(null);
    try {
      const value = tokenSavingSelection === 'project-default' ? null :
        tokenSavingSelection === 'true';
      await onSaveTokenSaving(value);
      onOpenChange(false);
    } catch {
      setTokenSavingError('Failed to save token saving setting');
    } finally {
      setIsSavingTokenSaving(false);
    }
  };

  const effectiveTokenSavingLabel = currentTokenSaving === null
    ? `${projectDefaultTokenSaving ? 'ON' : 'OFF'} (project default)`
    : `${currentTokenSaving ? 'ON' : 'OFF'} (override)`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] aurora-bg-subtle">
          <DialogHeader>
            <DialogTitle>Run Settings</DialogTitle>
            <DialogDescription>
              Per-ticket overrides for agent execution. Settings inherit from the project unless overridden.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="agent" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="agent">Agent</TabsTrigger>
              <TabsTrigger value="models">Models</TabsTrigger>
              <TabsTrigger value="policy">Policy</TabsTrigger>
              <TabsTrigger value="token-saving">Token Saving</TabsTrigger>
            </TabsList>

            <TabsContent value="agent" className="space-y-4 mt-4">
              <div className="rounded-md border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Agent</Label>
                  <span className="text-xs text-muted-foreground">
                    {currentAgent ? `${currentAgent} (override)` : `${projectDefaultAgent ?? 'CLAUDE'} (project default)`}
                  </span>
                </div>
                {!isInboxStage && (
                  <p className="text-xs text-muted-foreground">Agent can only be changed for INBOX tickets.</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAgentSubOpen(true)}
                  disabled={!isInboxStage}
                >
                  {isInboxStage ? 'Change agent' : 'View agent'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="models" className="space-y-4 mt-4">
              <div className="rounded-md border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Per-Stage Models</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Override the model used for each workflow stage.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModelSubOpen(true)}
                >
                  Configure models
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="policy" className="space-y-4 mt-4">
              <div className="rounded-md border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Clarification Policy</Label>
                  <span className="text-xs text-muted-foreground">
                    {currentPolicy ? `${currentPolicy} (override)` : `${projectDefaultPolicy} (project default)`}
                  </span>
                </div>
                {!isInboxStage && (
                  <p className="text-xs text-muted-foreground">Policy can only be changed for INBOX tickets.</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPolicySubOpen(true)}
                  disabled={!isInboxStage}
                >
                  {isInboxStage ? 'Change policy' : 'View policy'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="token-saving" className="space-y-4 mt-4">
              <div className="rounded-md border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Token Saving</Label>
                  <span className="text-xs text-muted-foreground">{effectiveTokenSavingLabel}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Compresses large command outputs during Claude runs to reduce token consumption.
                </p>
                <Select
                  value={tokenSavingSelection}
                  onValueChange={(v) => setTokenSavingSelection(v as TokenSavingSelection)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project-default">
                      Use project default ({projectDefaultTokenSaving ? 'ON' : 'OFF'})
                    </SelectItem>
                    <SelectItem value="true">Force ON</SelectItem>
                    <SelectItem value="false">Force OFF</SelectItem>
                  </SelectContent>
                </Select>
                {tokenSavingError && (
                  <div className="text-xs text-destructive bg-destructive/10 rounded-md p-2">{tokenSavingError}</div>
                )}
                <Button
                  onClick={handleSaveTokenSaving}
                  disabled={!tokenSavingHasChanges || isSavingTokenSaving}
                  size="sm"
                >
                  {isSavingTokenSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {projectDefaultAgent && (
        <AgentEditDialog
          open={agentSubOpen}
          onOpenChange={setAgentSubOpen}
          currentAgent={currentAgent}
          projectDefaultAgent={projectDefaultAgent}
          onSave={async (agent) => {
            await onSaveAgent(agent);
            setAgentSubOpen(false);
          }}
        />
      )}

      <PolicyEditDialog
        open={policySubOpen}
        onOpenChange={setPolicySubOpen}
        currentPolicy={currentPolicy}
        projectDefaultPolicy={projectDefaultPolicy}
        onSave={async (policy) => {
          await onSavePolicy(policy);
          setPolicySubOpen(false);
        }}
      />

      {projectDefaultAgent && (
        <ModelOverrideDialog
          open={modelSubOpen}
          onOpenChange={setModelSubOpen}
          effectiveAgent={effectiveAgent}
          current={currentModels}
          onSave={async (input) => {
            await onSaveModels(input);
            setModelSubOpen(false);
          }}
        />
      )}
    </>
  );
}
