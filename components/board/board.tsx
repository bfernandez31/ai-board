'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import type { CollisionDetection } from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { StageColumn } from './stage-column';
import { DragOverlay } from './drag-overlay';
import { OfflineIndicator } from './offline-indicator';
import { TicketDetailModal } from './ticket-detail-modal';
import { QuickImplModal } from './quick-impl-modal';
import { RollbackVerifyModal } from './rollback-verify-modal';
import { RollbackConfirmationModal } from './rollback-confirmation-modal';
import { TrashZone } from './trash-zone';
import { CloseZone } from './close-zone';
import { DeleteConfirmationModal } from './delete-confirmation-modal';
import { CloseConfirmationModal } from './close-confirmation-modal';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { Stage, isValidTransition, getAllStages, getValidRollbackTargets } from '@/lib/stage-transitions';
import { TicketWithVersion } from '@/lib/types';
import {
  updateTicketStageOptimistically,
  revertTicketStage,
} from '@/lib/optimistic-updates';
import { useToast } from '@/hooks/use-toast';
import { useJobPolling } from '@/app/lib/hooks/useJobPolling';
import { useTicketsByStage, useTicketByKey } from '@/app/lib/hooks/queries/useTickets';
import { useTicketJobs } from '@/app/lib/hooks/queries/useTicketJobs';
import { queryKeys } from '@/app/lib/query-keys';
import { Job, ClarificationPolicy } from '@prisma/client';
import { isTicketAttachmentArray } from '@/app/lib/types/ticket';
import type { DualJobState } from '@/lib/types/job-types';
import { getWorkflowJob, getAIBoardJob, getDeployJob } from '@/lib/utils/job-filtering';
import {
  canRollbackToInbox,
  canRollbackToPlan,
  canRollbackSpecifyToInbox,
  canRollbackPlanToSpecify,
  canRollbackBuildToPlan,
  canRollbackVerifyToBuild,
} from '@/app/lib/workflows/rollback-validator';
import { isTicketDeletable, getDeletionBlockReason } from '@/lib/utils/trash-zone-eligibility';
import { useDeleteTicket } from '@/lib/hooks/mutations/useDeleteTicket';
import { useHoverCapability } from '@/lib/hooks/use-hover-capability';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';
import { NewTicketModal } from './new-ticket-modal';
import { KeyboardShortcutsDialog } from './keyboard-shortcuts-dialog';
import { ShortcutsHelpButton } from './shortcuts-help-button';
import { RetroSpecBanner } from './retro-spec-banner';
import { RetroSpecBadge } from './retro-spec-badge';
import { RetroSpecModal } from './retro-spec-modal';
import { useRetroSpecPolling } from '@/app/lib/hooks/useRetroSpecPolling';

/**
 * Convert TicketWithVersion to TicketDetailModal-compatible format
 * Handles JsonValue attachments conversion
 */
function convertTicketForModal(ticket: TicketWithVersion | null) {
  if (!ticket) return null;

  const attachments = isTicketAttachmentArray(ticket.attachments)
    ? ticket.attachments
    : null;

  return {
    ...ticket,
    attachments,
  };
}

const STAGE_BY_NUMBER: Record<number, string> = {
  1: 'INBOX', 2: 'SPECIFY', 3: 'PLAN',
  4: 'BUILD', 5: 'VERIFY', 6: 'SHIP',
};

interface BoardProps {
  ticketsByStage: Record<Stage, TicketWithVersion[]>;
  projectId: number;
  initialJobs?: Map<number, Job[]>; // Array of jobs per ticket for dual job display
  hasSpecs?: boolean;
  defaultAgent?: import('@prisma/client').Agent;
}

/** Default merge: apply server response fields to optimistic ticket */
function mergeTransitionFields(serverData: Record<string, unknown>, current: TicketWithVersion): TicketWithVersion {
  const data = serverData as Partial<TicketWithVersion>;
  return {
    ...current,
    stage: data.stage || current.stage,
    version: data.version || current.version,
    branch: data.branch !== undefined ? data.branch : current.branch,
    workflowType: data.workflowType || current.workflowType,
    updatedAt: data.updatedAt || current.updatedAt,
  };
}

export function Board({
  ticketsByStage: initialTicketsByStage,
  projectId,
  initialJobs = new Map(),
  hasSpecs = false,
  defaultAgent = 'CLAUDE',
}: BoardProps) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Seed the TanStack Query cache with server-fetched data to avoid loading state
  React.useEffect(() => {
    queryClient.setQueryData(
      queryKeys.projects.tickets(projectId),
      Object.values(initialTicketsByStage).flat()
    );
  }, [projectId, initialTicketsByStage, queryClient]);

  // T008: Seed ticket jobs cache with server data for immediate reactivity
  React.useEffect(() => {
    for (const [ticketId, jobs] of initialJobs.entries()) {
      if (jobs.length > 0) {
        queryClient.setQueryData(
          queryKeys.projects.ticketJobs(projectId, ticketId),
          jobs
        );
      }
    }
  }, [projectId, initialJobs, queryClient]);

  // Fetch tickets using TanStack Query (automatically updates on cache invalidation)
  const { data: ticketsByStage = initialTicketsByStage } = useTicketsByStage(projectId);

  // T030: Job polling integration for real-time job status updates
  const { jobs: polledJobs } = useJobPolling(projectId, 2000);

  // AIB-585: Retro-spec polling for banner/badge state
  const { isGenerating: isRetroSpecGenerating, isCompleted: isRetroSpecCompleted, isFailed: isRetroSpecFailed } = useRetroSpecPolling(projectId, 2000, !hasSpecs);
  const [isRetroSpecModalOpen, setIsRetroSpecModalOpen] = useState(false);
  const isBannerDismissed = typeof window !== 'undefined' && (() => { try { return localStorage.getItem(`retro-spec-banner-dismissed-${projectId}`) === 'true'; } catch { return false; } })();
  const handleRetroSpecSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.retroSpecJob(projectId) });
  }, [queryClient, projectId]);

  const [activeTicket, setActiveTicket] = useState<TicketWithVersion | null>(
    null
  );
  // Store only the ID to ensure we always get the latest ticket data from cache
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<'details' | 'comments' | 'files'>('details');
  const isOnline = useOnlineStatus();
  const { toast } = useToast();

  // Drag state for visual feedback (T019)
  const [isDragging, setIsDragging] = useState(false);
  const [dragSource, setDragSource] = useState<Stage | null>(null);
  const [draggedTicketHasJob, setDraggedTicketHasJob] = useState(false);

  // Pending transition for quick-impl modal (T035)
  const [pendingTransition, setPendingTransition] = useState<{
    ticket: TicketWithVersion;
    targetStage: Stage;
  } | null>(null);

  // Pending transition for verify rollback modal (AIB-75)
  const [pendingVerifyRollback, setPendingVerifyRollback] = useState<{
    ticket: TicketWithVersion;
    targetStage: Stage;
  } | null>(null);

  // Pending rollback for new extended rollback transitions (AIB-512)
  const [pendingRollback, setPendingRollback] = useState<{
    ticket: TicketWithVersion;
    targetStage: Stage;
  } | null>(null);

  // Valid rollback targets during drag (AIB-512)
  const [validRollbackTargets, setValidRollbackTargets] = useState<Stage[]>([]);

  // Delete confirmation state (T023)
  const [ticketToDelete, setTicketToDelete] = useState<TicketWithVersion | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Close confirmation state (AIB-148)
  const [pendingCloseTransition, setPendingCloseTransition] = useState<{
    ticket: TicketWithVersion;
  } | null>(null);
  const [isClosingTicket, setIsClosingTicket] = useState(false);

  // AIB-156: State for pending ticket key lookup (for closed tickets not in board state)
  const [pendingTicketKey, setPendingTicketKey] = useState<string | null>(null);
  // Ref to track last processed ticket key (prevents infinite loop due to async router.replace)
  const lastProcessedTicketRef = useRef<string | null>(null);

  // Delete mutation hook (T019)
  const deleteTicketMutation = useDeleteTicket(projectId);

  // AIB-299: Keyboard shortcuts state
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('shortcuts-hint-dismissed') !== 'true';
    } catch { return false; }
  });
  const hasHover = useHoverCapability();

  const isAnyModalOpen = isModalOpen || isNewTicketModalOpen || isShortcutsHelpOpen || deleteModalOpen || !!pendingTransition || !!pendingVerifyRollback || !!pendingRollback || !!pendingCloseTransition || isRetroSpecModalOpen;

  const handleShortcutsHelpChange = useCallback((open: boolean) => {
    setIsShortcutsHelpOpen(open);
    if (!open) {
      try { localStorage.setItem('shortcuts-hint-dismissed', 'true'); } catch {}
    }
  }, []);

  const handleNewTicketShortcut = useCallback(() => setIsNewTicketModalOpen(true), []);
  const handleFocusSearchShortcut = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-command-palette'));
  }, []);
  const handleColumnNavShortcut = useCallback((columnIndex: number) => {
    const stage = STAGE_BY_NUMBER[columnIndex];
    if (stage) {
      document.querySelector<HTMLElement>(`[data-column="${stage}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }
  }, []);
  const handleToggleHelpShortcut = useCallback(() => {
    handleShortcutsHelpChange(!isShortcutsHelpOpen);
  }, [handleShortcutsHelpChange, isShortcutsHelpOpen]);

  useKeyboardShortcuts({
    enabled: hasHover && !isAnyModalOpen,
    onNewTicket: handleNewTicketShortcut,
    onFocusSearch: handleFocusSearchShortcut,
    onColumnNav: handleColumnNavShortcut,
    onToggleHelp: handleToggleHelpShortcut,
  });

  // Separate listener for ? key when help dialog is open (fix: help dialog blocks useKeyboardShortcuts)
  useEffect(() => {
    if (!isShortcutsHelpOpen) return;

    function handleHelpClose(event: KeyboardEvent) {
      if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        handleShortcutsHelpChange(false);
      }
    }

    document.addEventListener('keydown', handleHelpClose);
    return () => document.removeEventListener('keydown', handleHelpClose);
  }, [isShortcutsHelpOpen, handleShortcutsHelpChange]);

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8, // Prevent accidental drags with mouse
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300, // Long-press duration for deliberate drag on touch devices
        tolerance: 8, // Tighter tolerance: cancel drag activation if finger moves >8px during long-press
      },
    })
  );

  // Custom collision detection: require pointer to be physically inside
  // trash-zone / close-zone (pointerWithin), but use closestCenter for columns.
  // This prevents accidental drops on action zones when dragging near screen edges.
  const collisionDetection: CollisionDetection = useCallback((...args) => {
    const pointerCollisions = pointerWithin(...args);
    const actionZoneHit = pointerCollisions.find(
      (c) => c.id === 'trash-zone' || c.id === 'close-zone'
    );
    if (actionZoneHit) return [actionZoneHit];
    return closestCenter(...args);
  }, []);

  // Get all tickets as a flat array for updates
  const allTickets = useMemo(() => {
    return Object.values(ticketsByStage).flat();
  }, [ticketsByStage]);

  // AIB-156: Fetch ticket by key for closed tickets not in board state
  const { data: fetchedTicket, isSuccess: fetchedTicketSuccess, isError: fetchedTicketError } = useTicketByKey(
    projectId,
    pendingTicketKey,
    !!pendingTicketKey
  );

  // Derive the selected ticket from allTickets to get the latest data
  // This ensures we always show fresh data (e.g., branch) after cache invalidation
  // AIB-156: Includes fallback to fetchedTicket for closed tickets not in board state
  const selectedTicket = useMemo(() => {
    if (!selectedTicketId) return null;
    // First check board tickets
    const boardTicket = allTickets.find(t => t.id === selectedTicketId);
    if (boardTicket) return boardTicket;
    // Fallback to fetched ticket (for closed tickets)
    if (fetchedTicket && fetchedTicket.id === selectedTicketId) {
      return fetchedTicket;
    }
    return null;
  }, [selectedTicketId, allTickets, fetchedTicket]);

  // T007: Fetch ticket jobs with telemetry for modal Stats tab
  // Only enabled when modal is open to avoid unnecessary requests
  const { data: selectedTicketJobs = [] } = useTicketJobs(
    projectId,
    selectedTicketId,
    isModalOpen
  );

  // Find the ticket with active preview URL (for single-preview warning)
  const activePreviewTicket = useMemo(() => {
    const ticketWithPreview = allTickets.find(t => t.previewUrl !== null && t.previewUrl !== undefined);
    return ticketWithPreview ? { ticketKey: ticketWithPreview.ticketKey } : null;
  }, [allTickets]);

  // AIB-80 + AIB-156: Parse URL params to auto-open modal with specific tab
  // Format: ?ticket=AIB-123&modal=open&tab=comments#comment-123
  // AIB-156: Handles both board tickets and closed tickets not in board state
  useEffect(() => {
    if (!searchParams) return;

    const shouldOpenModal = searchParams.get('modal') === 'open';
    const tabParam = searchParams.get('tab');
    const ticketKey = searchParams.get('ticket');

    if (!shouldOpenModal || !ticketKey) return;

    // Prevent re-processing same ticket (ref guards against async router.replace timing)
    if (lastProcessedTicketRef.current === ticketKey) return;

    // Parse tab parameter
    const initialTab =
      tabParam === 'comments' || tabParam === 'files' ? tabParam : 'details';

    // First check if ticket is in board state
    const ticket = allTickets.find(t => t.ticketKey === ticketKey);

    if (ticket) {
      // Ticket found in board - open modal directly
      lastProcessedTicketRef.current = ticketKey;
      router.replace(pathname, { scroll: false });
      setSelectedTicketId(ticket.id);
      setModalInitialTab(initialTab);
      setIsModalOpen(true);
    } else {
      // AIB-156: Ticket not in board state (likely closed) - trigger fetch
      lastProcessedTicketRef.current = ticketKey;
      router.replace(pathname, { scroll: false });
      setPendingTicketKey(ticketKey);
      setModalInitialTab(initialTab);
    }
  }, [searchParams, allTickets, router, pathname]);

  // AIB-156: Handle fetched ticket for closed tickets not in board state
  useEffect(() => {
    if (!pendingTicketKey) return;
    // Don't re-trigger if modal already open with this ticket
    if (isModalOpen && selectedTicketId === fetchedTicket?.id) return;

    // Wait for query to complete (success or error)
    if (!fetchedTicketSuccess && !fetchedTicketError) return;

    if (fetchedTicketSuccess && fetchedTicket) {
      // Ticket found - open modal (URL already cleared by first useEffect)
      // Note: Don't clear pendingTicketKey here - selectedTicket needs fetchedTicket
      // It will be cleared when modal closes via handleModalClose
      setSelectedTicketId(fetchedTicket.id);
      setIsModalOpen(true);
    } else if (fetchedTicketSuccess && fetchedTicket === null) {
      // Ticket not found (404) - clean up without opening modal
      setPendingTicketKey(null);
    } else if (fetchedTicketError) {
      // Query failed - clean up
      console.error('Failed to fetch ticket by key:', pendingTicketKey);
      setPendingTicketKey(null);
    }
  }, [fetchedTicket, fetchedTicketSuccess, fetchedTicketError, pendingTicketKey, isModalOpen, selectedTicketId]);

  // T030: Get dual job state for a ticket (workflow + AI-BOARD + deploy jobs)
  // Merges polled job updates with initial job data for real-time status display
  // - workflow: Latest workflow job (specify, plan, implement, quick-impl, verify)
  // - aiBoard: Latest AI-BOARD job matching current stage (comment-specify, comment-plan, etc.)
  // - deployJob: Latest deploy preview job (deploy-preview command)
  // Polling integration:
  // - Initial render: Uses initialJobs from server-side data
  // - Subsequent renders: Merges polled status updates with initial job data
  // - Creates minimal Job objects for new jobs created during session
  const getTicketJobs = useCallback(
    (ticketId: number): DualJobState => {
      // Get initial jobs array for this ticket
      const ticketInitialJobs = initialJobs.get(ticketId) || [];

      // Get all polled jobs for this ticket
      const ticketPolledJobs = polledJobs.filter(job => job.ticketId === ticketId);

      // Helper: find quality score from latest COMPLETED verify job
      const getLatestQualityScore = (jobs: Job[]): number | null => {
        const verifyJob = jobs
          .filter((j) => j.command === 'verify' && j.status === 'COMPLETED' && j.qualityScore != null)
          .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
        return verifyJob?.qualityScore ?? null;
      };

      // If no jobs at all, return null state
      if (ticketInitialJobs.length === 0 && ticketPolledJobs.length === 0) {
        return { workflow: null, aiBoard: null, deployJob: null, qualityScore: null };
      }

      // If no polled jobs yet, use initial jobs (first render)
      if (ticketPolledJobs.length === 0) {
        const ticket = allTickets.find(t => t.id === ticketId);
        return {
          workflow: ticket ? getWorkflowJob(ticketInitialJobs, ticket.stage) : null,
          aiBoard: ticket ? getAIBoardJob(ticketInitialJobs, ticket.stage) : null,
          deployJob: getDeployJob(ticketInitialJobs),
          qualityScore: getLatestQualityScore(ticketInitialJobs),
        };
      }

      // Merge polled status updates with initial job data
      const fullJobs: Job[] = ticketPolledJobs.map(polledJob => {
        // Find matching initial job by ID
        const matchingInitialJob = ticketInitialJobs.find(j => j.id === polledJob.id);

        if (matchingInitialJob) {
          // Update status from polling but keep other fields from initial
          return {
            ...matchingInitialJob,
            status: polledJob.status,
            command: polledJob.command, // Update command in case it changed
            updatedAt: new Date(polledJob.updatedAt),
          } as Job;
        }

        // Fallback: create minimal Job object from polled data (for new jobs created during session)
        return {
          id: polledJob.id,
          ticketId: polledJob.ticketId,
          projectId,
          status: polledJob.status,
          command: polledJob.command,
          startedAt: new Date(polledJob.updatedAt),
          completedAt: null,
          branch: null,
          commitSha: null,
          logs: null,
          createdAt: new Date(polledJob.updatedAt),
          updatedAt: new Date(polledJob.updatedAt),
        } as Job;
      });

      // Find the ticket to get current stage for AI-BOARD filtering
      const ticket = allTickets.find(t => t.id === ticketId);

      // Use filtering functions to get workflow, AI-BOARD, and deploy jobs
      return {
        workflow: ticket ? getWorkflowJob(fullJobs, ticket.stage) : null,
        aiBoard: ticket ? getAIBoardJob(fullJobs, ticket.stage) : null,
        deployJob: getDeployJob(fullJobs),
        qualityScore: getLatestQualityScore(fullJobs),
      };
    },
    [polledJobs, initialJobs, projectId, allTickets]
  );

  // Find the ticket with active deployment (PENDING or RUNNING deploy job)
  // Used to disable deploy buttons on other tickets during deployment
  const activeDeploymentTicket = useMemo(() => {
    // Get all unique ticket IDs from both sources
    const ticketIds = new Set([
      ...allTickets.map(t => t.id),
      ...Array.from(initialJobs.keys())
    ]);

    // Check each ticket for active deployment using merged job data
    for (const ticketId of ticketIds) {
      const jobs = getTicketJobs(ticketId);
      const deployJob = jobs.deployJob;

      if (deployJob && (deployJob.status === 'PENDING' || deployJob.status === 'RUNNING')) {
        return ticketId;
      }
    }

    return null;
  }, [allTickets, initialJobs, getTicketJobs]);

  // Handle drag start (T020 - Add drag state)
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const ticket = event.active.data.current?.ticket as TicketWithVersion;
    if (ticket) {
      setActiveTicket(ticket);
      setIsDragging(true);
      setDragSource(ticket.stage);

      // Check if ticket has a non-completed workflow job
      // Blocks all normal transitions (FAILED/CANCELLED jobs can only rollback to INBOX)
      // AI-BOARD jobs don't block transitions, only workflow jobs do
      const jobs = getTicketJobs(ticket.id);
      const hasActiveWorkflowJob = jobs.workflow && jobs.workflow.status !== 'COMPLETED';
      setDraggedTicketHasJob(!!hasActiveWorkflowJob);

      // Compute valid rollback targets (AIB-512)
      const lastJobStatus = jobs.workflow?.status ?? null;
      const targets = getValidRollbackTargets(
        ticket.stage,
        ticket.workflowType as 'QUICK' | 'FULL' | 'CLEAN',
        lastJobStatus
      );
      setValidRollbackTargets(targets);
    }
  }, [getTicketJobs]);

  // Shared transition helper: optimistic update → API call → merge/rollback
  const performTransition = useCallback(
    async (
      ticket: TicketWithVersion,
      targetStage: Stage,
      config: {
        mergeServerData?: (serverData: Record<string, unknown>, current: TicketWithVersion) => TicketWithVersion;
        onApiError?: (error: { error?: string; message?: string }, status: number) => void;
        successToast: { title: string; description: string };
        networkErrorToast: { title: string; description: string };
      }
    ) => {
      const originalStage = ticket.stage;
      const originalVersion = ticket.version;

      const updatedTickets = updateTicketStageOptimistically(
        allTickets, ticket.id, targetStage
      );
      queryClient.setQueryData(queryKeys.projects.tickets(projectId), updatedTickets);

      const revert = () => {
        const reverted = revertTicketStage(updatedTickets, ticket.id, originalStage, originalVersion);
        queryClient.setQueryData(queryKeys.projects.tickets(projectId), reverted);
      };

      try {
        const response = await fetch(
          `/api/projects/${projectId}/tickets/${ticket.id}/transition`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetStage }),
          }
        );

        if (!response.ok) {
          const error = (await response.json()) as { error?: string; message?: string };
          revert();
          if (config.onApiError) {
            config.onApiError(error, response.status);
          } else {
            toast({
              variant: 'destructive',
              title: 'Failed to update ticket',
              description: error.error || error.message || 'An error occurred.',
            });
          }
          return;
        }

        const serverData = await response.json();
        const merge = config.mergeServerData ?? mergeTransitionFields;
        const finalTickets = updatedTickets.map((t) =>
          t.id === ticket.id ? merge(serverData, t) : t
        );
        queryClient.setQueryData(queryKeys.projects.tickets(projectId), finalTickets);
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.jobsStatus(projectId) });
        toast(config.successToast);
      } catch (err) {
        console.error('Transition error:', err);
        revert();
        toast({ variant: 'destructive', ...config.networkErrorToast });
      }
    },
    [allTickets, projectId, queryClient, toast]
  );

  // Handle drag end with API call
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTicket(null);
      setIsDragging(false);
      setDragSource(null);
      setDraggedTicketHasJob(false);
      setValidRollbackTargets([]);

      const { active, over } = event;

      if (!over || !isOnline) return;

      const ticket = active.data.current?.ticket as TicketWithVersion;

      // T022: Check if dropped on trash zone
      if (over.id === 'trash-zone') {
        // Open delete confirmation modal
        setTicketToDelete(ticket);
        setDeleteModalOpen(true);
        return;
      }

      // AIB-148: Check if dropped on close zone
      if (over.id === 'close-zone') {
        // Only VERIFY tickets can be closed
        if (ticket.stage === Stage.VERIFY) {
          setPendingCloseTransition({ ticket });
        }
        return;
      }

      const targetStage = over.data.current?.stage as Stage;

      if (!ticket || !targetStage || ticket.stage === targetStage) return;

      // Validate transition (pass workflowType for rollback validation)
      if (!isValidTransition(ticket.stage, targetStage, ticket.workflowType)) {
        toast({
          variant: 'destructive',
          title: 'Invalid stage transition',
          description: `Cannot move from ${ticket.stage} to ${targetStage}. Tickets must progress sequentially.`,
        });
        return;
      }

      // T036: Detect INBOX → BUILD and show quick-impl modal
      if (ticket.stage === Stage.INBOX && targetStage === Stage.BUILD) {
        setPendingTransition({ ticket, targetStage });
        return;
      }

      // AIB-75: Detect VERIFY → PLAN and show rollback modal
      if (ticket.stage === Stage.VERIFY && targetStage === Stage.PLAN) {
        setPendingVerifyRollback({ ticket, targetStage });
        return;
      }

      // AIB-512: Detect new rollback transitions and show confirmation modal
      const isNewRollback =
        (ticket.stage === Stage.SPECIFY && targetStage === Stage.INBOX) ||
        (ticket.stage === Stage.PLAN && targetStage === Stage.SPECIFY) ||
        (ticket.stage === Stage.BUILD && targetStage === Stage.PLAN) ||
        (ticket.stage === Stage.VERIFY && targetStage === Stage.BUILD);
      if (isNewRollback) {
        setPendingRollback({ ticket, targetStage });
        return;
      }

      // AIB-148: Detect VERIFY → CLOSED and show close confirmation modal
      if (ticket.stage === Stage.VERIFY && targetStage === Stage.CLOSED) {
        setPendingCloseTransition({ ticket });
        return;
      }

      await performTransition(ticket, targetStage, {
        onApiError: (error, status) => {
          if (status === 423) {
            toast({
              variant: 'destructive',
              title: 'Transition blocked',
              description: 'Project cleanup is in progress. Please wait for it to complete. You can still update ticket descriptions, documents, and preview deployments.',
            });
          } else if (status === 409) {
            toast({
              variant: 'destructive',
              title: 'Ticket modified by another user',
              description: 'Please refresh the page and try again.',
            });
          } else if (status === 500 && error.error) {
            toast({
              variant: 'destructive',
              title: 'Cannot move ticket',
              description: error.error,
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'Failed to update ticket',
              description: error.error || error.message || 'An error occurred while updating the ticket.',
            });
          }
        },
        successToast: {
          title: 'Ticket updated',
          description: `Moved to ${targetStage}`,
        },
        networkErrorToast: {
          title: 'Network error',
          description: 'Could not update ticket. Please check your connection.',
        },
      });
    },
    [isOnline, toast, performTransition]
  );

  // Handle drag cancel - resets all drag state when touch is interrupted
  // This prevents the UI from getting stuck in drag mode on mobile
  // (e.g., when the browser cancels the touch due to scroll conflicts)
  const handleDragCancel = useCallback(() => {
    setActiveTicket(null);
    setIsDragging(false);
    setDragSource(null);
    setDraggedTicketHasJob(false);
    setValidRollbackTargets([]);
  }, []);

  // Handle ticket click to open modal
  const handleTicketClick = useCallback((ticket: TicketWithVersion) => {
    setSelectedTicketId(ticket.id);
    setIsModalOpen(true);
    // Open conversation tab for tickets in VERIFY stage
    setModalInitialTab(ticket.stage === 'VERIFY' ? 'comments' : 'details');
  }, []);

  // Handle modal close
  const handleModalClose = useCallback((open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setSelectedTicketId(null);
      // Reset ref to allow re-opening same ticket via search
      lastProcessedTicketRef.current = null;
      // Clear pending ticket key (keeps useTicketByKey query enabled until modal closes)
      setPendingTicketKey(null);
    }
  }, []);

  // Handle ticket update from modal
  type UpdatedModalTicket = {
    id: number;
    ticketNumber?: number;
    ticketKey?: string;
    title: string;
    description: string | null;
    stage: Stage | string;
    version: number;
    projectId: number;
    branch: string | null;
    autoMode: boolean;
    clarificationPolicy: ClarificationPolicy | null;
    agent?: import('@prisma/client').Agent | null;
    workflowType: 'FULL' | 'QUICK' | 'CLEAN';
    attachments?: import('@/app/lib/types/ticket').TicketAttachment[] | null;
    createdAt: string | Date;
    updatedAt: string | Date;
  };

  const handleTicketUpdate = useCallback(
    (updatedTicket?: UpdatedModalTicket) => {
      if (!updatedTicket) {
        return;
      }

      // Find existing ticket to preserve fields not in update
      const existingTicket = allTickets.find(t => t.id === updatedTicket.id);

      const normalizedTicket: TicketWithVersion = {
        id: updatedTicket.id,
        // Preserve ticketNumber and ticketKey (from update or fallback to existing)
        ticketNumber: updatedTicket.ticketNumber ?? existingTicket?.ticketNumber ?? 0,
        ticketKey: updatedTicket.ticketKey ?? existingTicket?.ticketKey ?? '',
        title: updatedTicket.title,
        description: updatedTicket.description,
        stage: updatedTicket.stage as Stage,
        version: updatedTicket.version,
        projectId: updatedTicket.projectId,
        branch: updatedTicket.branch,
        autoMode: updatedTicket.autoMode,
        clarificationPolicy: updatedTicket.clarificationPolicy,
        agent: updatedTicket.agent ?? existingTicket?.agent ?? null,
        // Preserve workflowType from existing ticket if not in update (defensive)
        workflowType: updatedTicket.workflowType || existingTicket?.workflowType || 'FULL',
        // Preserve attachments from existing ticket or use empty array
        attachments: (updatedTicket.attachments ?? existingTicket?.attachments ?? []) as import('@prisma/client').Prisma.JsonValue,
        createdAt:
          updatedTicket.createdAt instanceof Date
            ? updatedTicket.createdAt.toISOString()
            : updatedTicket.createdAt,
        updatedAt:
          updatedTicket.updatedAt instanceof Date
            ? updatedTicket.updatedAt.toISOString()
            : updatedTicket.updatedAt,
      };

      const ticketExists = allTickets.some(
        (ticket) => ticket.id === normalizedTicket.id
      );
      const updatedTickets = ticketExists
        ? allTickets.map((ticket) =>
            ticket.id === normalizedTicket.id ? normalizedTicket : ticket
          )
        : [...allTickets, normalizedTicket];

      queryClient.setQueryData(
        queryKeys.projects.tickets(projectId),
        updatedTickets
      );
      // No need to setSelectedTicketId - selectedTicket is derived from allTickets
      // which will update automatically when the cache is updated
    },
    [allTickets, projectId, queryClient]
  );

  // T037: Handle quick-impl confirmation
  const handleQuickImplConfirm = useCallback(async () => {
    if (!pendingTransition) return;

    const { ticket, targetStage } = pendingTransition;
    setPendingTransition(null);

    await performTransition(ticket, targetStage, {
      successToast: {
        title: 'Quick implementation started',
        description: `Workflow dispatched for ticket ${ticket.ticketKey}`,
      },
      networkErrorToast: {
        title: 'Network error',
        description: 'Could not start workflow. Please check your connection.',
      },
    });
  }, [pendingTransition, performTransition]);

  // T038: Handle quick-impl cancellation
  const handleQuickImplCancel = useCallback(() => {
    setPendingTransition(null);
  }, []);

  // AIB-75: Handle VERIFY to PLAN rollback confirmation
  const handleVerifyRollbackConfirm = useCallback(async () => {
    if (!pendingVerifyRollback) return;

    const { ticket, targetStage } = pendingVerifyRollback;
    setPendingVerifyRollback(null);

    await performTransition(ticket, targetStage, {
      mergeServerData: (serverData, current): TicketWithVersion => {
        const data = serverData as Partial<TicketWithVersion>;
        return {
          ...current,
          stage: data.stage || current.stage,
          version: data.version || current.version,
          previewUrl: data.previewUrl ?? current.previewUrl ?? null,
          updatedAt: data.updatedAt || current.updatedAt,
        };
      },
      onApiError: (error) => {
        toast({
          variant: 'destructive',
          title: 'Failed to rollback to PLAN',
          description: error.error || 'An error occurred while rolling back the ticket.',
        });
      },
      successToast: {
        title: 'Ticket rolled back to PLAN',
        description: `${ticket.ticketKey} has been moved to PLAN stage. Preview URL cleared.`,
      },
      networkErrorToast: {
        title: 'Network error',
        description: 'Could not rollback ticket. Please check your connection.',
      },
    });
  }, [pendingVerifyRollback, performTransition, toast]);

  // AIB-75: Handle VERIFY to PLAN rollback cancellation
  const handleVerifyRollbackCancel = useCallback(() => {
    setPendingVerifyRollback(null);
  }, []);

  // AIB-512: Rollback confirmation messages (French per codebase convention)
  const ROLLBACK_MESSAGES: Record<string, { title: string; description: string }> = {
    'SPECIFY→INBOX': {
      title: 'Revenir a Inbox ?',
      description: 'La branche sera supprimee.',
    },
    'PLAN→SPECIFY': {
      title: 'Revenir a Specify ?',
      description: 'Le plan partiel sera ecrase au prochain lancement.',
    },
    'BUILD→PLAN': {
      title: 'Revenir a Plan ?',
      description: 'Le code sera reinitialise (backup cree).',
    },
    'VERIFY→BUILD': {
      title: 'Revenir a Build ?',
      description: 'Le code actuel sera conserve, verify sera relance.',
    },
  };

  // AIB-512: Handle extended rollback confirmation
  const handleRollbackConfirm = useCallback(async () => {
    if (!pendingRollback) return;

    const { ticket, targetStage } = pendingRollback;
    setPendingRollback(null);

    await performTransition(ticket, targetStage, {
      mergeServerData: (serverData, current): TicketWithVersion => {
        const data = serverData as Partial<TicketWithVersion>;
        return {
          ...current,
          stage: data.stage || current.stage,
          version: data.version || current.version,
          branch: data.branch !== undefined ? data.branch : current.branch,
          previewUrl: data.previewUrl ?? current.previewUrl ?? null,
          workflowType: data.workflowType || current.workflowType,
          updatedAt: data.updatedAt || current.updatedAt,
        };
      },
      onApiError: (error) => {
        toast({
          variant: 'destructive',
          title: 'Rollback failed',
          description: error.error || 'An error occurred during rollback.',
        });
      },
      successToast: {
        title: 'Ticket rolled back',
        description: `${ticket.ticketKey} moved to ${targetStage}.`,
      },
      networkErrorToast: {
        title: 'Network error',
        description: 'Could not rollback ticket. Please check your connection.',
      },
    });
  }, [pendingRollback, performTransition, toast]);

  // AIB-512: Handle extended rollback cancellation
  const handleRollbackCancel = useCallback(() => {
    setPendingRollback(null);
  }, []);

  // Delete confirmation handlers (T023)
  const handleDeleteConfirm = useCallback(() => {
    if (!ticketToDelete) return;

    deleteTicketMutation.mutate(ticketToDelete.id, {
      onSuccess: () => {
        toast({
          title: 'Ticket deleted',
          description: `${ticketToDelete.ticketKey} has been permanently deleted.`,
        });
        setDeleteModalOpen(false);
        setTicketToDelete(null);
      },
      onError: (error) => {
        toast({
          variant: 'destructive',
          title: 'Failed to delete ticket',
          description: error.message,
        });
        // Keep modal open on error to allow retry
      },
    });
  }, [ticketToDelete, deleteTicketMutation, toast]);


  // AIB-148: Handle close confirmation
  const handleCloseConfirm = useCallback(async () => {
    if (!pendingCloseTransition) return;

    const { ticket } = pendingCloseTransition;
    setIsClosingTicket(true);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticket.id}/close`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        toast({
          variant: 'destructive',
          title: 'Failed to close ticket',
          description: error.error || 'An error occurred while closing the ticket.',
        });
      } else {
        // Success - update ticket stage in cache (keep for modal access via search)
        const updatedTickets = allTickets.map(t =>
          t.id === ticket.id ? { ...t, stage: Stage.CLOSED } : t
        );
        queryClient.setQueryData(
          queryKeys.projects.tickets(projectId),
          updatedTickets
        );

        toast({
          title: 'Ticket closed',
          description: `${ticket.ticketKey} has been closed.`,
        });
      }
    } catch (error) {
      console.error('Error closing ticket:', error);
      toast({
        variant: 'destructive',
        title: 'Network error',
        description: 'Could not close ticket. Please check your connection.',
      });
    } finally {
      setIsClosingTicket(false);
      setPendingCloseTransition(null);
    }
  }, [pendingCloseTransition, allTickets, toast, projectId, queryClient]);

  // AIB-148: Handle close cancellation
  const handleCloseCancel = useCallback(() => {
    setPendingCloseTransition(null);
  }, []);

  // Get drop zone style based on drag state (T021)
  const getDropZoneStyle = useCallback(
    (stage: Stage): string => {
      if (!isDragging || !dragSource || !activeTicket) return '';

      // Helper function to get most recent workflow job
      const getMostRecentWorkflowJob = () => {
        const ticketJobs = initialJobs.get(activeTicket.id) || [];
        const polledTicketJobs = polledJobs.filter(job => job.ticketId === activeTicket.id && !job.command.startsWith('comment-'));

        if (polledTicketJobs.length > 0) {
          const mostRecentPolled = polledTicketJobs.reduce((latest, current) =>
            new Date(current.updatedAt) > new Date(latest.updatedAt) ? current : latest
          );
          return {
            id: mostRecentPolled.id,
            status: mostRecentPolled.status,
            command: mostRecentPolled.command,
          };
        } else {
          const workflowJobs = ticketJobs.filter(job => job.command && !job.command.startsWith('comment-'));
          if (workflowJobs.length > 0 && workflowJobs[0]) {
            const firstJob = workflowJobs[0];
            return {
              id: firstJob.id,
              status: firstJob.status,
              command: firstJob.command,
            };
          }
        }
        return null;
      };

      // AIB-512: Rollback mode for new transitions — highlight valid rollback targets
      if (validRollbackTargets.length > 0 && validRollbackTargets.includes(stage)) {
        // Validate specific transition
        const mostRecentWorkflowJob = getMostRecentWorkflowJob();
        let validation = { allowed: false };

        if (dragSource === Stage.SPECIFY && stage === Stage.INBOX) {
          validation = canRollbackSpecifyToInbox(dragSource, stage, activeTicket.workflowType, mostRecentWorkflowJob);
        } else if (dragSource === Stage.PLAN && stage === Stage.SPECIFY) {
          validation = canRollbackPlanToSpecify(dragSource, stage, activeTicket.workflowType, mostRecentWorkflowJob);
        } else if (dragSource === Stage.BUILD && stage === Stage.PLAN) {
          validation = canRollbackBuildToPlan(dragSource, stage, activeTicket.workflowType, mostRecentWorkflowJob);
        } else if (dragSource === Stage.VERIFY && stage === Stage.BUILD) {
          validation = canRollbackVerifyToBuild(dragSource, stage, activeTicket.workflowType, mostRecentWorkflowJob);
        }

        if (validation.allowed) {
          return 'border-4 border-dashed border-amber-500 bg-amber-500/10';
        }
        return 'opacity-50 cursor-not-allowed';
      }

      // Rollback mode: Dragging from BUILD to INBOX
      if (dragSource === Stage.BUILD && stage === Stage.INBOX) {
        const mostRecentWorkflowJob = getMostRecentWorkflowJob();

        // Validate rollback eligibility (only for quick-impl workflows)
        const validation = canRollbackToInbox(
          dragSource,
          stage,
          activeTicket.workflowType,
          mostRecentWorkflowJob
        );

        if (validation.allowed) {
          // Rollback eligible - amber border
          return 'border-4 border-dashed border-amber-500 bg-amber-500/10';
        } else {
          // Rollback not allowed - disabled with tooltip hint
          return 'opacity-50 cursor-not-allowed';
        }
      }

      // Rollback mode: Dragging from VERIFY to PLAN (AIB-75)
      if (dragSource === Stage.VERIFY && stage === Stage.PLAN) {
        const mostRecentWorkflowJob = getMostRecentWorkflowJob();

        // Validate rollback eligibility (only for FULL workflows)
        const validation = canRollbackToPlan(
          dragSource,
          stage,
          activeTicket.workflowType,
          mostRecentWorkflowJob
        );

        if (validation.allowed) {
          // Rollback eligible - amber border
          return 'border-4 border-dashed border-amber-500 bg-amber-500/10';
        } else {
          // Rollback not allowed - disabled with tooltip hint
          return 'opacity-50 cursor-not-allowed';
        }
      }

      // If ticket has active job, disable all drop zones
      if (draggedTicketHasJob) {
        return 'opacity-50 cursor-not-allowed';
      }

      // Quick-impl mode: Dragging from INBOX
      if (dragSource === Stage.INBOX) {
        if (stage === Stage.SPECIFY) {
          // Normal workflow - blue
          return 'border-4 border-dashed border-primary bg-primary/10';
        } else if (stage === Stage.BUILD) {
          // Quick-impl - green
          return 'border-4 border-dashed border-ctp-green bg-ctp-green/10';
        } else {
          // Invalid - gray with reduced opacity
          return 'opacity-50 cursor-not-allowed';
        }
      }

      // AIB-148: Close mode - Dragging from VERIFY to SHIP or CLOSED
      if (dragSource === Stage.VERIFY) {
        if (stage === Stage.SHIP) {
          // Normal ship - green
          return 'border-4 border-dashed border-ctp-green bg-ctp-green/10';
        } else if (stage === Stage.CLOSED) {
          // Close zone - red
          return 'border-4 border-dashed border-destructive bg-destructive/10';
        }
      }

      // Normal drag: Check if valid transition
      if (isValidTransition(dragSource, stage)) {
        return 'border-4 border-dashed border-primary bg-primary/10';
      } else {
        return 'opacity-50 cursor-not-allowed';
      }
    },
    [isDragging, dragSource, draggedTicketHasJob, activeTicket, initialJobs, polledJobs, validRollbackTargets]
  );

  // AIB-148: Filter out CLOSED stage from board display - CLOSED tickets are not shown on the board
  const stages = getAllStages().filter(s => s !== Stage.CLOSED);

  // Merge initial and polled jobs for a ticket (polled takes precedence for status)
  const getMergedTicketJobs = useCallback((ticketId: number) => {
    const initial = initialJobs.get(ticketId) || [];
    const polled = polledJobs.filter(job => job.ticketId === ticketId);
    const jobMap = new Map(initial.map(j => [j.id, j]));
    polled.forEach(pj => {
      const existing = jobMap.get(pj.id);
      if (existing) {
        // Update status from polling but keep other fields from initial
        jobMap.set(pj.id, { ...existing, status: pj.status, updatedAt: new Date(pj.updatedAt) });
      } else {
        // Create minimal Job object for new jobs discovered during polling
        jobMap.set(pj.id, {
          id: pj.id,
          ticketId: pj.ticketId,
          projectId,
          status: pj.status,
          command: pj.command,
          startedAt: new Date(pj.updatedAt),
          completedAt: null,
          branch: null,
          commitSha: null,
          logs: null,
          createdAt: new Date(pj.updatedAt),
          updatedAt: new Date(pj.updatedAt),
        } as Job);
      }
    });
    return Array.from(jobMap.values());
  }, [initialJobs, polledJobs, projectId]);

  // T024: Trash zone visibility and disabled state
  const trashZoneState = useMemo<{ isVisible: boolean; isDisabled: boolean; disabledReason?: string }>(() => {
    if (!activeTicket || !isDragging) {
      return { isVisible: false, isDisabled: false };
    }

    const allTicketJobs = getMergedTicketJobs(activeTicket.id);
    const ticketWithJobs = {
      stage: activeTicket.stage,
      jobs: allTicketJobs.map(j => ({ status: j.status })),
    };

    const isDeletable = isTicketDeletable(ticketWithJobs);
    const reason = getDeletionBlockReason(ticketWithJobs);

    return {
      isVisible: true,
      isDisabled: !isDeletable,
      ...(reason && { disabledReason: reason }),
    };
  }, [activeTicket, isDragging, getMergedTicketJobs]);

  // AIB-148: Close zone visibility and disabled state (only for VERIFY tickets)
  const closeZoneState = useMemo<{ isVisible: boolean; isDisabled: boolean; disabledReason?: string }>(() => {
    if (!activeTicket || !isDragging || activeTicket.stage !== Stage.VERIFY) {
      return { isVisible: false, isDisabled: false };
    }

    const allTicketJobs = getMergedTicketJobs(activeTicket.id);
    const hasActiveJob = allTicketJobs.some(j => ['PENDING', 'RUNNING'].includes(j.status));

    if (hasActiveJob) {
      return {
        isVisible: true,
        isDisabled: true,
        disabledReason: 'Cannot close ticket with active jobs',
      };
    }

    return {
      isVisible: true,
      isDisabled: false,
    };
  }, [activeTicket, isDragging, getMergedTicketJobs]);

  // Check if any column is being hovered during drag
  const isAnyColumnOver = activeTicket !== null;

  return (
    <div className="w-full h-full bg-background">
      <OfflineIndicator />

      <RetroSpecBanner
        projectId={projectId}
        hasSpecs={hasSpecs || isRetroSpecCompleted}
        isGenerating={isRetroSpecGenerating}
        isFailed={isRetroSpecFailed}
        onGenerateSuccess={handleRetroSpecSuccess}
        defaultAgent={defaultAgent}
      />
      {!hasSpecs && <RetroSpecBadge projectId={projectId} defaultAgent={defaultAgent} />}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="w-full h-full relative">
          {/* Drop Zone Visual Feedback - Full Board */}
          {isAnyColumnOver && (
            <div className="absolute inset-0 border-4 border-dashed border-primary pointer-events-none bg-primary/5 z-10" />
          )}

          {/* Board Grid - Restored original styling */}
          <div
            data-testid="board-grid"
            className="grid gap-2 overflow-x-auto pb-6 px-4 pt-4 relative z-20"
            style={{
              gridTemplateColumns: 'repeat(6, minmax(300px, 1fr))',
              height: 'calc(100vh - 4rem - 4px)',
            }}
          >
            {stages.map((stage) => {
              // Exception for rollback: allow rollback targets even when ticket has active job
              const isRollbackToInbox = dragSource === Stage.BUILD && stage === Stage.INBOX;
              const isRollbackToPlan = dragSource === Stage.VERIFY && stage === Stage.PLAN;
              const isNewRollbackTarget = validRollbackTargets.includes(stage);
              const isBlocked = isDragging && draggedTicketHasJob && !isRollbackToInbox && !isRollbackToPlan && !isNewRollbackTarget;

              return (
                <StageColumn
                  key={stage}
                  stage={stage}
                  tickets={ticketsByStage[stage] || []}
                  isDraggable={isOnline}
                  onTicketClick={handleTicketClick}
                  projectId={projectId}
                  getTicketJobs={getTicketJobs}
                  dropZoneStyle={getDropZoneStyle(stage)}
                  isBlockedByJob={isBlocked}
                  activePreviewTicket={activePreviewTicket}
                  activeDeploymentTicket={activeDeploymentTicket}
                />
              );
            })}
          </div>
        </div>

        <DragOverlay activeTicket={activeTicket} />

        {/* Trash Zone (T017, T024) */}
        {trashZoneState.isVisible && (
          <TrashZone
            isVisible={trashZoneState.isVisible}
            isDisabled={trashZoneState.isDisabled}
            disabledReason={trashZoneState.disabledReason}
          />
        )}

        {/* Close Zone (AIB-148) - Only visible when dragging VERIFY tickets */}
        {closeZoneState.isVisible && (
          <CloseZone
            isVisible={closeZoneState.isVisible}
            isDisabled={closeZoneState.isDisabled}
            disabledReason={closeZoneState.disabledReason}
          />
        )}
      </DndContext>

      {/* Ticket Detail Modal */}
      <TicketDetailModal
        ticket={convertTicketForModal(selectedTicket)}
        open={isModalOpen}
        onOpenChange={handleModalClose}
        onUpdate={handleTicketUpdate}
        projectId={projectId}
        initialTab={modalInitialTab}
        jobs={selectedTicket ? polledJobs.filter(job => job.ticketId === selectedTicket.id) : []}
        fullJobs={selectedTicketJobs}
      />

      {/* Quick Implementation Modal (T039) */}
      <QuickImplModal
        open={!!pendingTransition}
        onConfirm={handleQuickImplConfirm}
        onCancel={handleQuickImplCancel}
      />

      {/* Verify to Plan Rollback Modal (AIB-75) */}
      <RollbackVerifyModal
        open={!!pendingVerifyRollback}
        onConfirm={handleVerifyRollbackConfirm}
        onCancel={handleVerifyRollbackCancel}
      />

      {/* Extended Rollback Confirmation Modal (AIB-512) */}
      <RollbackConfirmationModal
        open={!!pendingRollback}
        onConfirm={handleRollbackConfirm}
        onCancel={handleRollbackCancel}
        title={pendingRollback ? (ROLLBACK_MESSAGES[`${pendingRollback.ticket.stage}→${pendingRollback.targetStage}`]?.title ?? 'Confirmer le rollback ?') : ''}
        description={pendingRollback ? (ROLLBACK_MESSAGES[`${pendingRollback.ticket.stage}→${pendingRollback.targetStage}`]?.description ?? '') : ''}
      />

      {/* Delete Confirmation Modal (T018, T023) */}
      <DeleteConfirmationModal
        ticket={ticketToDelete}
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteTicketMutation.isPending}
      />

      {/* Close Confirmation Modal (AIB-148) */}
      <CloseConfirmationModal
        ticketKey={pendingCloseTransition?.ticket.ticketKey || null}
        open={!!pendingCloseTransition}
        onOpenChange={(open) => !open && handleCloseCancel()}
        onConfirm={handleCloseConfirm}
        isClosing={isClosingTicket}
      />

      {/* Keyboard-triggered New Ticket Modal (AIB-299) */}
      <NewTicketModal
        open={isNewTicketModalOpen}
        onOpenChange={setIsNewTicketModalOpen}
        projectId={projectId}
      />

      {/* Keyboard Shortcuts Help (AIB-299) */}
      <KeyboardShortcutsDialog
        open={isShortcutsHelpOpen}
        onOpenChange={handleShortcutsHelpChange}
      />
      <ShortcutsHelpButton onClick={() => handleShortcutsHelpChange(!isShortcutsHelpOpen)} />

      {/* AIB-585: Generate Specs trigger (FR-013) — only after banner is dismissed, hidden during failure (badge shows retry) */}
      {!hasSpecs && !isRetroSpecCompleted && !isRetroSpecGenerating && !isRetroSpecFailed && isBannerDismissed && (
        <>
          <button
            onClick={() => setIsRetroSpecModalOpen(true)}
            className="fixed bottom-4 right-14 z-30 flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground text-xs"
            aria-label="Generate project specs"
            data-testid="retro-spec-menu-btn"
          >
            Generate Specs
          </button>
          <RetroSpecModal
            open={isRetroSpecModalOpen}
            onOpenChange={setIsRetroSpecModalOpen}
            projectId={projectId}
            defaultAgent={defaultAgent}
            onSuccess={handleRetroSpecSuccess}
          />
        </>
      )}
    </div>
  );
}

