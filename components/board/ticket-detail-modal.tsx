'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { isTicketAttachmentArray } from '@/app/lib/types/ticket';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import type { DocumentType } from '@/lib/validations/documentation';
import { Stage } from '@/lib/stage-transitions';
import { useComments } from '@/app/lib/hooks/queries/use-comments';
import { canEditDescriptionAndPolicy } from '@/lib/utils/field-edit-permissions';
import { useComparisonCheck } from '@/hooks/use-comparisons';
import { TicketModalHeader } from './ticket-modal-header';
import { TicketDetailsTab } from './ticket-details-tab';
import { TicketModalSecondaryTabs } from './ticket-modal-secondary-tabs';
import { TicketModalDialogs } from './ticket-modal-dialogs';
import { useTicketDetailModal } from './use-ticket-detail-modal';
import type { TicketDetailModalProps, TicketModalTab } from './ticket-detail-modal-types';

export type { TicketData, TicketJob } from './ticket-detail-modal-types';

export function TicketDetailModal({
  ticket,
  open,
  onOpenChange,
  onUpdate,
  projectId,
  initialTab = 'details',
  jobs = [],
  fullJobs = [],
}: TicketDetailModalProps) {
  const [runSettingsOpen, setRunSettingsOpen] = useState(false);
  const [docViewerOpen, setDocViewerOpen] = useState(false);
  const [docViewerType, setDocViewerType] = useState<DocumentType>('plan');
  const [activeTab, setActiveTab] = useState<TicketModalTab>(initialTab);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [comparisonViewerOpen, setComparisonViewerOpen] = useState(false);
  const [prDiffOpen, setPrDiffOpen] = useState(false);

  const {
    localTicket,
    setLocalTicket,
    isDuplicating,
    handleDuplicate,
    handleSavePolicy,
    handleSaveAgent,
    handleSaveModelOverrides,
    refreshTicketFromServer,
    titleEdit,
    descriptionEdit,
  } = useTicketDetailModal({ ticket, projectId, onUpdate, onOpenChange });

  // Fetch comment count for badge
  const { data: comments } = useComments({
    projectId,
    ticketId: ticket?.id || 0,
    enabled: open && !!ticket,
    refetchInterval: false, // Don't poll when just showing count
  });

  // Check if ticket has comparison reports
  const { data: comparisonCheck } = useComparisonCheck(
    projectId,
    ticket?.id || 0,
    open && !!ticket
  );

  // Sync activeTab with initialTab when modal opens or initialTab changes
  // This ensures the tab is correctly set even when navigating via URL params
  useEffect(() => {
    if (!open) {
      setRunSettingsOpen(false);
    }
    // Always sync activeTab with initialTab when either changes
    setActiveTab(initialTab);
  }, [open, initialTab]);

  const hasJobs = fullJobs.length > 0;

  useEffect(() => {
    if (!open) return;

    const tabKeys: Record<string, typeof activeTab> = {
      '1': 'details',
      '2': 'comments',
      '3': 'files',
      ...(hasJobs ? { '4': 'stats' } : {}),
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const tab = (e.metaKey || e.ctrlKey) ? tabKeys[e.key] : undefined;
      if (tab) {
        e.preventDefault();
        setActiveTab(tab);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, hasJobs]);

  // Completion state must come from `fullJobs` (fetched via useTicketJobs) and
  // not from the polled `jobs` prop. Since the polling optimization (947f1a81),
  // the /jobs/status endpoint only returns PENDING/RUNNING jobs, so once a
  // workflow completes the polled `jobs` array is empty and would incorrectly
  // hide the Spec/Plan/Tasks/Summary buttons.
  const completedJobs = useMemo(() => {
    if (!localTicket?.branch || fullJobs.length === 0) {
      return { specify: false, plan: false, implement: false };
    }
    const has = (cmd: string) => fullJobs.some(j => j.command === cmd && j.status === 'COMPLETED');
    return { specify: has('specify'), plan: has('plan'), implement: has('implement') };
  }, [localTicket?.branch, fullJobs]);

  const showPlanButton = localTicket?.workflowType === 'FULL' && completedJobs.plan;
  const showTasksButton = showPlanButton;
  const showSummaryButton = localTicket?.workflowType === 'FULL' && completedJobs.implement;
  // AIB-879: PR Diff viewer is available once a PR exists for review — VERIFY/SHIP.
  const currentStage = localTicket?.stage ?? ticket?.stage;
  const showPrDiffButton = currentStage === 'VERIFY' || currentStage === 'SHIP';

  // Full clone option visibility: Only for stages with branch (SPECIFY, PLAN, BUILD, VERIFY)
  const showFullClone = !!localTicket?.stage && ['SPECIFY', 'PLAN', 'BUILD', 'VERIFY'].includes(localTicket.stage);

  // Don't render content if no ticket is selected (after all hooks)
  if (!ticket) {
    return null;
  }

  // Check if description and policy can be edited based on current stage
  const isInboxStage = canEditDescriptionAndPolicy(ticket.stage as Stage);

  // AIB-148: Check if ticket is closed (read-only mode)
  const isClosedTicket = ticket.stage === 'CLOSED';

  const handleOpenDoc = (type: DocumentType) => {
    setDocViewerType(type);
    setDocViewerOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          // Focus the close button for better accessibility
          const dialog = (event.target as HTMLElement)?.closest('[role="dialog"]') ?? event.target as HTMLElement;
          const closeButton = dialog?.querySelector<HTMLElement>('button[aria-label="Close"]');
          closeButton?.focus();
        }}
        onEscapeKeyDown={(event) => {
          // Prevent modal from closing if autocomplete is open
          if (isAutocompleteOpen) {
            event.preventDefault();
            return;
          }

          if (titleEdit.isEditing) {
            event.preventDefault();
            titleEdit.cancelEdit();
            return;
          }

          if (descriptionEdit.isEditing) {
            event.preventDefault();
            descriptionEdit.cancelEdit();
          }
        }}
        className="
          flex flex-col h-screen w-screen p-4 gap-2
          !top-0 !translate-y-0
          sm:grid sm:h-auto sm:max-w-2xl sm:max-h-[90vh] sm:rounded-lg sm:px-6 sm:pt-4 sm:pb-6
          sm:!top-[50%] sm:!-translate-y-1/2
          border-ctp-mauve/15 text-foreground
          [&>button[class*=absolute]]:hidden
        "
      >
        {/* Header with editable title */}
        <TicketModalHeader
          ticket={ticket}
          localTicket={localTicket}
          isClosedTicket={isClosedTicket}
          isDuplicating={isDuplicating}
          showFullClone={showFullClone}
          titleEdit={titleEdit}
          titleInputRef={titleEdit.inputRef}
          onOpenRunSettings={() => setRunSettingsOpen(true)}
          onDuplicate={handleDuplicate}
        />

        {/* Tabs for organizing modal content */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TicketModalTab)} className="w-full flex-1 flex flex-col -mt-2 sm:mt-0 sm:block sm:flex-initial overflow-hidden">
          <TabsList className={`flex-shrink-0 grid w-full ${hasJobs ? 'grid-cols-4' : 'grid-cols-3'} mb-0 sm:mb-4`}>
            <TabsTrigger value="details" className="text-sm">
              Details
            </TabsTrigger>
            <TabsTrigger value="comments" className="text-sm relative">
              Conversation
              {comments?.comments && comments.comments.length > 0 && (
                <Badge variant="count" className="ml-2">
                  {comments.comments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="files" className="text-sm relative">
              Files
              {localTicket?.attachments && isTicketAttachmentArray(localTicket.attachments) && localTicket.attachments.length > 0 && (
                <Badge variant="count" className="ml-2">
                  {localTicket.attachments.length}
                </Badge>
              )}
            </TabsTrigger>
            {hasJobs && (
              <TabsTrigger value="stats" className="text-sm relative" data-testid="stats-tab-trigger">
                <BarChart3 className="w-4 h-4 mr-1.5" />
                Stats
                <Badge variant="count" className="ml-2">
                  {fullJobs.length}
                </Badge>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Details Tab */}
          <TicketDetailsTab
            ticket={ticket}
            localTicket={localTicket}
            projectId={projectId}
            isInboxStage={isInboxStage}
            descriptionEdit={descriptionEdit}
            descriptionInputRef={descriptionEdit.inputRef}
            completedJobs={completedJobs}
            showPlanButton={showPlanButton}
            showTasksButton={showTasksButton}
            showSummaryButton={showSummaryButton}
            showPrDiffButton={showPrDiffButton}
            comparisonCheck={comparisonCheck}
            onOpenDoc={handleOpenDoc}
            onOpenComparison={() => setComparisonViewerOpen(true)}
            onOpenPrDiff={() => setPrDiffOpen(true)}
          />

          <TicketModalSecondaryTabs
            ticket={ticket}
            localTicket={localTicket}
            projectId={projectId}
            isClosedTicket={isClosedTicket}
            hasJobs={hasJobs}
            jobs={jobs}
            fullJobs={fullJobs}
            setIsAutocompleteOpen={setIsAutocompleteOpen}
            refreshTicketFromServer={refreshTicketFromServer}
          />
        </Tabs>
      </DialogContent>

      <TicketModalDialogs
        ticket={ticket}
        open={open}
        projectId={projectId}
        jobs={jobs}
        localTicket={localTicket}
        setLocalTicket={setLocalTicket}
        onUpdate={onUpdate}
        comparisonCheck={comparisonCheck}
        handleSavePolicy={handleSavePolicy}
        handleSaveAgent={handleSaveAgent}
        handleSaveModelOverrides={handleSaveModelOverrides}
        docViewerType={docViewerType}
        docViewerOpen={docViewerOpen}
        setDocViewerOpen={setDocViewerOpen}
        runSettingsOpen={runSettingsOpen}
        setRunSettingsOpen={setRunSettingsOpen}
        prDiffOpen={prDiffOpen}
        setPrDiffOpen={setPrDiffOpen}
        comparisonViewerOpen={comparisonViewerOpen}
        setComparisonViewerOpen={setComparisonViewerOpen}
      />
    </Dialog>
  );
}
