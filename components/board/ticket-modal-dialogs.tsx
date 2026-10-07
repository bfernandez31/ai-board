'use client';

import { RunSettingsDialog } from '@/components/tickets/run-settings-dialog';
import DocumentationViewer from './documentation-viewer';
import { ComparisonViewer } from '@/components/comparison/comparison-viewer';
import { PrDiffViewer } from '@/components/ticket/pr-diff-viewer';
import { Agent } from '@prisma/client';
import { Stage } from '@/lib/stage-transitions';
import type { DocumentType } from '@/lib/validations/documentation';
import type { ComparisonCheckResult } from '@/lib/types/comparison';
import type { TicketData, TicketJob } from './ticket-detail-modal-types';
import type { UseTicketDetailModalReturn } from './use-ticket-detail-modal';

interface TicketModalDialogsProps {
  ticket: TicketData;
  open: boolean;
  projectId: number;
  jobs: TicketJob[];
  localTicket: TicketData | null;
  setLocalTicket: UseTicketDetailModalReturn['setLocalTicket'];
  onUpdate?: ((ticket: TicketData) => void) | undefined;
  comparisonCheck: ComparisonCheckResult | undefined;
  handleSavePolicy: UseTicketDetailModalReturn['handleSavePolicy'];
  handleSaveAgent: UseTicketDetailModalReturn['handleSaveAgent'];
  handleSaveModelOverrides: UseTicketDetailModalReturn['handleSaveModelOverrides'];
  docViewerType: DocumentType;
  docViewerOpen: boolean;
  setDocViewerOpen: (open: boolean) => void;
  runSettingsOpen: boolean;
  setRunSettingsOpen: (open: boolean) => void;
  prDiffOpen: boolean;
  setPrDiffOpen: (open: boolean) => void;
  comparisonViewerOpen: boolean;
  setComparisonViewerOpen: (open: boolean) => void;
}

/**
 * Portal dialogs rendered alongside {@link TicketDetailModal}: documentation
 * viewer, run settings, PR diff, and comparison viewer. Each only mounts while
 * the parent modal is open.
 */
export function TicketModalDialogs({
  ticket,
  open,
  projectId,
  jobs,
  localTicket,
  setLocalTicket,
  onUpdate,
  comparisonCheck,
  handleSavePolicy,
  handleSaveAgent,
  handleSaveModelOverrides,
  docViewerType,
  docViewerOpen,
  setDocViewerOpen,
  runSettingsOpen,
  setRunSettingsOpen,
  prDiffOpen,
  setPrDiffOpen,
  comparisonViewerOpen,
  setComparisonViewerOpen,
}: TicketModalDialogsProps) {
  return (
    <>
      {/* DocumentationViewer modal - only render when parent dialog is open */}
      {ticket && open && (
        <DocumentationViewer
          ticketId={ticket.id}
          projectId={projectId}
          ticketTitle={ticket.title}
          ticketStage={ticket.stage as Stage}
          docType={docViewerType}
          open={docViewerOpen}
          onOpenChange={setDocViewerOpen}
        />
      )}

      {/* RunSettingsDialog - consolidated per-ticket run overrides (AIB-849) */}
      {localTicket?.project && open && (
        <RunSettingsDialog
          open={runSettingsOpen}
          onOpenChange={setRunSettingsOpen}
          projectId={projectId}
          ticket={{
            id: localTicket.id,
            stage: localTicket.stage,
            version: localTicket.version,
            agent: localTicket.agent ?? null,
            clarificationPolicy: localTicket.clarificationPolicy,
            tokenSaving: localTicket.tokenSaving ?? null,
            specifyModel: localTicket.specifyModel ?? null,
            planModel: localTicket.planModel ?? null,
            implementModel: localTicket.implementModel ?? null,
            quickImplModel: localTicket.quickImplModel ?? null,
            verifyModel: localTicket.verifyModel ?? null,
            codexSpecifyModel: localTicket.codexSpecifyModel ?? null,
            codexPlanModel: localTicket.codexPlanModel ?? null,
            codexImplementModel: localTicket.codexImplementModel ?? null,
            codexQuickImplModel: localTicket.codexQuickImplModel ?? null,
            codexVerifyModel: localTicket.codexVerifyModel ?? null,
          }}
          project={{
            defaultAgent: localTicket.project.defaultAgent ?? Agent.CLAUDE,
            clarificationPolicy: localTicket.project.clarificationPolicy,
            tokenSaving: localTicket.project.tokenSaving ?? false,
          }}
          isRunActive={jobs.some(
            (j) => j.status === 'RUNNING' || j.status === 'PENDING'
          )}
          onSavePolicy={handleSavePolicy}
          onSaveAgent={handleSaveAgent}
          onSaveModels={handleSaveModelOverrides}
          onTokenSavingSaved={(tokenSaving, version) => {
            if (!localTicket) return;
            const updated = { ...localTicket, tokenSaving, version };
            setLocalTicket(updated);
            if (onUpdate) onUpdate(updated);
          }}
        />
      )}

      {/* PrDiffViewer modal - only render when parent dialog is open (AIB-879) */}
      {ticket && open && (
        <PrDiffViewer
          projectId={projectId}
          ticketId={ticket.id}
          ticketTitle={ticket.title}
          open={prDiffOpen}
          onOpenChange={setPrDiffOpen}
        />
      )}

      {/* ComparisonViewer modal - only render when parent dialog is open */}
      {ticket && open && (
        <ComparisonViewer
          projectId={projectId}
          ticketId={ticket.id}
          initialComparisonId={comparisonCheck?.latestComparisonId ?? null}
          isOpen={comparisonViewerOpen}
          onClose={() => setComparisonViewerOpen(false)}
        />
      )}
    </>
  );
}
