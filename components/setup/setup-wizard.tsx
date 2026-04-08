'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { AgentSelector, type AgentOption } from './agent-selector';
import { CredentialStatus, type CredentialState } from './credential-status';
import { SetupProgress } from './setup-progress';
import { SetupFileList } from './setup-file-list';
import { useSetupJob } from '@/app/hooks/use-setup-job';

type WizardState =
  | 'initial'
  | 'checking-credential'
  | 'ready'
  | 'no-credential'
  | 'dispatching'
  | 'polling'
  | 'completed'
  | 'failed';

interface SetupWizardProps {
  projectId: number;
}

export function SetupWizard({ projectId }: SetupWizardProps) {
  const router = useRouter();
  const [wizardState, setWizardState] = useState<WizardState>('initial');
  const [selectedAgent, setSelectedAgent] = useState<AgentOption>('CLAUDE');
  const [credentialState, setCredentialState] = useState<CredentialState>('loading');
  const [credentialGuidance, setCredentialGuidance] = useState<string>();
  const [dispatchError, setDispatchError] = useState<string>();

  // Poll for setup job status
  const { data: statusData } = useSetupJob(
    projectId,
    wizardState === 'polling' || wizardState === 'initial'
  );

  const checkCredential = useCallback(async (agent: AgentOption) => {
    setCredentialState('loading');
    setWizardState('checking-credential');

    try {
      const res = await fetch(
        `/api/projects/${projectId}/setup/credential-check?agent=${agent}`
      );
      const data = await res.json();

      if (data.available) {
        setCredentialState('available');
        setWizardState('ready');
      } else {
        setCredentialState('unavailable');
        setCredentialGuidance(data.guidance);
        setWizardState('no-credential');
      }
    } catch {
      setCredentialState('unavailable');
      setCredentialGuidance('Failed to check credential availability.');
      setWizardState('no-credential');
    }
  }, [projectId]);

  // Recover running state on mount (check for existing active job)
  useEffect(() => {
    if (wizardState !== 'initial' || !statusData) return;

    const job = statusData.setupJob;
    if (!job) {
      checkCredential('CLAUDE');
      return;
    }

    setSelectedAgent(job.selectedAgent as AgentOption);

    if (job.status === 'PENDING' || job.status === 'RUNNING') {
      setWizardState('polling');
    } else if (job.status === 'COMPLETED') {
      setWizardState('completed');
    } else if (job.status === 'FAILED') {
      setWizardState('failed');
    }
  }, [wizardState, statusData, checkCredential]);

  // Watch for job completion/failure during polling
  useEffect(() => {
    if (wizardState !== 'polling' || !statusData?.setupJob) return;

    const { status } = statusData.setupJob;
    if (status === 'COMPLETED') {
      setWizardState('completed');
    } else if (status === 'FAILED') {
      setWizardState('failed');
    }
  }, [wizardState, statusData]);

  const handleAgentChange = useCallback((agent: AgentOption) => {
    setSelectedAgent(agent);
    setDispatchError(undefined);
    checkCredential(agent);
  }, [checkCredential]);

  const dispatchSetup = useCallback(async (fallbackState: WizardState) => {
    setWizardState('dispatching');
    setDispatchError(undefined);

    try {
      const res = await fetch(`/api/projects/${projectId}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: selectedAgent }),
      });

      if (!res.ok) {
        const data = await res.json();
        setDispatchError(data.error || 'Failed to start setup');
        setWizardState(fallbackState);
        return;
      }

      setWizardState('polling');
    } catch {
      setDispatchError('Network error. Please try again.');
      setWizardState(fallbackState);
    }
  }, [projectId, selectedAgent]);

  const handleDispatch = useCallback(() => dispatchSetup('ready'), [dispatchSetup]);
  const handleRetry = useCallback(() => dispatchSetup('failed'), [dispatchSetup]);

  const handleGoToBoard = useCallback(() => {
    router.push(`/projects/${projectId}/board`);
  }, [router, projectId]);

  const isJobActive = wizardState === 'polling' || wizardState === 'completed' || wizardState === 'failed';
  const isDispatching = wizardState === 'dispatching';
  const canDispatch = wizardState === 'ready' && credentialState === 'available';

  return (
    <div className="space-y-6">
      {/* Agent Selection */}
      <AgentSelector
        value={selectedAgent}
        onChange={handleAgentChange}
        disabled={isJobActive || isDispatching}
      />

      {/* Credential Check */}
      {!isJobActive && !isDispatching && (
        <CredentialStatus state={credentialState} guidance={credentialGuidance} />
      )}

      {/* Dispatch Button */}
      {!isJobActive && (
        <div className="space-y-2">
          <Button
            onClick={handleDispatch}
            disabled={isDispatching || !canDispatch}
            className="w-full"
          >
            {isDispatching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting setup...
              </>
            ) : (
              'Initialize Project'
            )}
          </Button>
          {dispatchError && (
            <p className="text-sm text-destructive">{dispatchError}</p>
          )}
        </div>
      )}

      {/* Progress Display */}
      {isJobActive && statusData?.setupJob && (
        <div className="space-y-4">
          <SetupProgress
            status={statusData.setupJob.status}
            startedAt={statusData.setupJob.startedAt}
            errorMessage={statusData.setupJob.errorMessage}
            onRetry={wizardState === 'failed' ? handleRetry : undefined}
          />

          {/* File List */}
          {statusData.setupJob.completedFiles.length > 0 && (
            <SetupFileList
              files={statusData.setupJob.completedFiles}
              label={statusData.setupJob.isPartial ? 'Files committed (partial)' : 'Files committed'}
            />
          )}

          {/* Go to Board button on completion */}
          {wizardState === 'completed' && (
            <Button onClick={handleGoToBoard} className="w-full">
              Go to Project Board
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
