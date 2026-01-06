'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { StageColumn } from './stage-column';
import { DragOverlay } from './drag-overlay';
import { OfflineIndicator } from './offline-indicator';
import { TicketDetailModal } from './ticket-detail-modal';
import { QuickImplModal } from './quick-impl-modal';
import { RollbackVerifyModal } from './rollback-verify-modal';
import { TrashZone } from './trash-zone';
import { DeleteConfirmationModal } from './delete-confirmation-modal';
import { CloseConfirmationModal } from './close-confirmation-modal';
import { CleanupInProgressBanner } from '@/components/cleanup/CleanupInProgressBanner';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { Stage, isValidTransition, getAllStages } from '@/lib/stage-transitions';
import { TicketWithVersion } from '@/lib/types';
import {
  updateTicketStageOptimistically,
  revertTicketStage,
} from '@/lib/optimistic-updates';
import { useToast } from '@/hooks/use-toast';
import { useJobPolling } from '@/app/lib/hooks/useJobPolling';
import { useTicketsByStage } from '@/app/lib/hooks/queries/useTickets';
import { useTicketJobs } from '@/app/lib/hooks/queries/useTicketJobs';
import { queryKeys } from '@/app/lib/query-keys';
import { Job, ClarificationPolicy } from '@prisma/client';
import { isTicketAttachmentArray } from '@/app/lib/types/ticket';
import type { DualJobState } from '@/lib/types/job-types';
import { getWorkflowJob, getAIBoardJob, getDeployJob } from '@/lib/utils/job-filtering';
import { canRollbackToInbox, canRollbackToPlan } from '@/app/lib/workflows/rollback-validator';
import { isTicketDeletable, getDeletionBlockReason } from '@/lib/utils/trash-zone-eligibility';
import { useDeleteTicket } from '@/lib/hooks/mutations/useDeleteTicket';
import { useCloseTicket } from '@/app/lib/hooks/mutations/useCloseTicket';

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

interface BoardProps {
  ticketsByStage: Record<Stage, TicketWithVersion[]>;
  projectId: number;
  initialJobs?: Map<number, Job[]>; // Array of jobs per ticket for dual job display
  activeCleanupJobId?: number | null; // T063-T064: Active cleanup job ID for lock banner
}

/**
 * BoardContent Component - Internal Board Logic
 *
 * Main kanban board with drag-and-drop functionality
 * - Optimistic UI updates
 * - Version-based conflict detection
 * - Sequential stage validation
 * - Touch and pointer support
 * - Project-scoped API calls
 * - Real-time job status updates
 */
function BoardContent({
  ticketsByStage: initialTicketsByStage,
  projectId,
  initialJobs = new Map(),
  activeCleanupJobId,
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

  // AIB-72: Track if cleanup lock is active (determines if transitions are blocked)
  const isCleanupLockActive = useMemo(() => {
    if (!activeCleanupJobId) return false;
    // Check if the cleanup job is still in progress (PENDING or RUNNING)
    const cleanupJob = polledJobs.find(job => job.id === activeCleanupJobId);
    // If we don't have polled data yet, assume lock is active (initial render)
    if (!cleanupJob) return true;
    return ['PENDING', 'RUNNING'].includes(cleanupJob.status);
  }, [activeCleanupJobId, polledJobs]);

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

  // Delete confirmation state (T023)
  const [ticketToDelete, setTicketToDelete] = useState<TicketWithVersion | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Close confirmation state (AIB-147)
  const [ticketToClose, setTicketToClose] = useState<TicketWithVersion | null>(null);
  const [closeModalOpen, setCloseModalOpen] = useState(false);

  // Delete mutation hook (T019)
  const deleteTicketMutation = useDeleteTicket(projectId);

  // Close mutation hook (AIB-147)
  const closeTicketMutation = useCloseTicket(projectId);

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevent accidental drags
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // Long-press duration for deliberate drag
        tolerance: 20, // Allow vertical scroll gestures without triggering drag (T905)
      },
    })
  );

  // Get all tickets as a flat array for updates
  const allTickets = useMemo(() => {
    return Object.values(ticketsByStage).flat();
  }, [ticketsByStage]);

  // Derive the selected ticket from allTickets to get the latest data
  // This ensures we always show fresh data (e.g., branch) after cache invalidation
  const selectedTicket = useMemo(() => {
    if (!selectedTicketId) return null;
    return allTickets.find(t => t.id === selectedTicketId) || null;
  }, [selectedTicketId, allTickets]);

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

  // AIB-80: Parse URL params to auto-open modal with specific tab
  // Format: ?ticket=AIB-123&modal=open&tab=comments#comment-123
  useEffect(() => {
    if (!searchParams) return;

    const shouldOpenModal = searchParams.get('modal') === 'open';
    const tabParam = searchParams.get('tab');
    const ticketKey = searchParams.get('ticket');

    if (!shouldOpenModal || !ticketKey) return;

    // Parse tab parameter
    const initialTab =
      tabParam === 'comments' || tabParam === 'files' ? tabParam : 'details';

    // Find ticket by ticketKey
    const ticket = allTickets.find(t => t.ticketKey === ticketKey);

    if (ticket && !isModalOpen) {
      setSelectedTicketId(ticket.id);
      setModalInitialTab(initialTab);
      setIsModalOpen(true);

      // Clean up URL params immediately after opening modal
      // This prevents re-opening when user closes the modal
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, allTickets, isModalOpen, router, pathname]);

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

      // If no jobs at all, return null state
      if (ticketInitialJobs.length === 0 && ticketPolledJobs.length === 0) {
        return { workflow: null, aiBoard: null, deployJob: null };
      }

      // If no polled jobs yet, use initial jobs (first render)
      if (ticketPolledJobs.length === 0) {
        const ticket = allTickets.find(t => t.id === ticketId);
        return {
          workflow: ticket ? getWorkflowJob(ticketInitialJobs, ticket.stage) : null,
          aiBoard: ticket ? getAIBoardJob(ticketInitialJobs, ticket.stage) : null,
          deployJob: getDeployJob(ticketInitialJobs),
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
    }
  }, [getTicketJobs]);

  // Handle drag end with API call
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTicket(null);
      setIsDragging(false);
      setDragSource(null);
      setDraggedTicketHasJob(false);

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

      // AIB-147: Check if dropped on close zone (VERIFY → CLOSED)
      if (over.id === 'close-zone') {
        // Only VERIFY tickets can be closed
        if (ticket.stage === Stage.VERIFY) {
          setTicketToClose(ticket);
          setCloseModalOpen(true);
        } else {
          toast({
            variant: 'destructive',
            title: 'Cannot close ticket',
            description: 'Only tickets in VERIFY stage can be closed.',
          });
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

      // Store original state for rollback
      const originalStage = ticket.stage;
      const originalVersion = ticket.version;

      // Optimistic update - update cache directly
      const updatedTickets = updateTicketStageOptimistically(
        allTickets,
        ticket.id,
        targetStage
      );
      queryClient.setQueryData(
        queryKeys.projects.tickets(projectId),
        updatedTickets
      );

      // Send update to server using /transition endpoint for all stage changes
      try {
        const response = await fetch(
          `/api/projects/${projectId}/tickets/${ticket.id}/transition`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetStage: targetStage,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();

          // Rollback optimistic update - revert cache
          const revertedTickets = revertTicketStage(
            updatedTickets,
            ticket.id,
            originalStage,
            originalVersion
          );
          queryClient.setQueryData(
            queryKeys.projects.tickets(projectId),
            revertedTickets
          );

          // Show error message with backend-provided details
          // T068-T069: Handle 423 Locked response for cleanup in progress
          if (response.status === 423) {
            toast({
              variant: 'destructive',
              title: 'Transition blocked',
              description: 'Project cleanup is in progress. Please wait for it to complete. You can still update ticket descriptions, documents, and preview deployments.',
            });
          } else if (response.status === 409) {
            toast({
              variant: 'destructive',
              title: 'Ticket modified by another user',
              description: 'Please refresh the page and try again.',
            });
          } else if (response.status === 500 && error.error) {
            // Display server-provided error message directly
            toast({
              variant: 'destructive',
              title: 'Cannot move ticket',
              description: error.error,
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'Failed to update ticket',
              description:
                error.error || error.message || 'An error occurred while updating the ticket.',
            });
          }
        } else {
          // Success - merge server response with optimistic update
          const serverData = await response.json();

          const finalTickets = updatedTickets.map((t) =>
            t.id === ticket.id
              ? {
                  ...t,
                  stage: serverData.stage || t.stage,
                  version: serverData.version || t.version,
                  branch: serverData.branch !== undefined ? serverData.branch : t.branch,
                  workflowType: serverData.workflowType || t.workflowType,
                  updatedAt: serverData.updatedAt || t.updatedAt,
                }
              : t
          );
          queryClient.setQueryData(
            queryKeys.projects.tickets(projectId),
            finalTickets
          );

          // Invalidate jobs status to resume polling if new job created
          queryClient.invalidateQueries({
            queryKey: queryKeys.projects.jobsStatus(projectId),
          });

          toast({
            title: 'Ticket updated',
            description: `Moved to ${targetStage}`,
          });
        }
      } catch (error) {
        console.error('Error updating ticket:', error);

        // Rollback on network error - revert cache
        const revertedTickets = revertTicketStage(
          updatedTickets,
          ticket.id,
          originalStage,
          originalVersion
        );
        queryClient.setQueryData(
          queryKeys.projects.tickets(projectId),
          revertedTickets
        );

        toast({
          variant: 'destructive',
          title: 'Network error',
          description: 'Could not update ticket. Please check your connection.',
        });
      }
    },
    [allTickets, isOnline, toast, projectId, queryClient]
  );

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

    // Store original state for rollback
    const originalStage = ticket.stage;
    const originalVersion = ticket.version;

    // Optimistic update - update cache directly
    const updatedTickets = updateTicketStageOptimistically(
      allTickets,
      ticket.id,
      targetStage
    );
    queryClient.setQueryData(
      queryKeys.projects.tickets(projectId),
      updatedTickets
    );

    // Send update to server using transition endpoint
    try {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticket.id}/transition`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetStage,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();

        // Rollback optimistic update - revert cache
        const revertedTickets = revertTicketStage(
          updatedTickets,
          ticket.id,
          originalStage,
          originalVersion
        );
        queryClient.setQueryData(
          queryKeys.projects.tickets(projectId),
          revertedTickets
        );

        // Show error message
        toast({
          variant: 'destructive',
          title: 'Failed to start quick implementation',
          description:
            error.message || 'An error occurred while starting the workflow.',
        });
      } else {
        // Success - merge server response with optimistic update
        const serverData = await response.json();

        const finalTickets = updatedTickets.map((t) =>
          t.id === ticket.id
            ? {
                ...t,
                stage: serverData.stage || t.stage,
                version: serverData.version || t.version,
                branch: serverData.branch !== undefined ? serverData.branch : t.branch,
                workflowType: serverData.workflowType || t.workflowType,
                updatedAt: serverData.updatedAt || t.updatedAt,
              }
            : t
        );
        queryClient.setQueryData(
          queryKeys.projects.tickets(projectId),
          finalTickets
        );

        // Invalidate jobs status to resume polling (new job created for quick-impl)
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.jobsStatus(projectId),
        });

        toast({
          title: 'Quick implementation started',
          description: `Workflow dispatched for ticket ${ticket.ticketKey}`,
        });
      }
    } catch (error) {
      console.error('Error starting quick-impl:', error);

      // Rollback on network error - revert cache
      const revertedTickets = revertTicketStage(
        updatedTickets,
        ticket.id,
        originalStage,
        originalVersion
      );
      queryClient.setQueryData(
        queryKeys.projects.tickets(projectId),
        revertedTickets
      );

      toast({
        variant: 'destructive',
        title: 'Network error',
        description: 'Could not start workflow. Please check your connection.',
      });
    }
  }, [pendingTransition, allTickets, toast, projectId, queryClient]);

  // T038: Handle quick-impl cancellation
  const handleQuickImplCancel = useCallback(() => {
    setPendingTransition(null);
  }, []);

  // AIB-75: Handle VERIFY to PLAN rollback confirmation
  const handleVerifyRollbackConfirm = useCallback(async () => {
    if (!pendingVerifyRollback) return;

    const { ticket, targetStage } = pendingVerifyRollback;
    setPendingVerifyRollback(null);

    // Store original state for rollback
    const originalStage = ticket.stage;
    const originalVersion = ticket.version;

    // Optimistic update - update cache directly
    const updatedTickets = updateTicketStageOptimistically(
      allTickets,
      ticket.id,
      targetStage
    );
    queryClient.setQueryData(
      queryKeys.projects.tickets(projectId),
      updatedTickets
    );

    // Send update to server using transition endpoint
    try {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticket.id}/transition`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetStage,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();

        // Rollback optimistic update - revert cache
        const revertedTickets = revertTicketStage(
          updatedTickets,
          ticket.id,
          originalStage,
          originalVersion
        );
        queryClient.setQueryData(
          queryKeys.projects.tickets(projectId),
          revertedTickets
        );

        // Show error message
        toast({
          variant: 'destructive',
          title: 'Failed to rollback to PLAN',
          description:
            error.error || 'An error occurred while rolling back the ticket.',
        });
      } else {
        // Success - merge server response with optimistic update
        const serverData = await response.json();

        const finalTickets = updatedTickets.map((t) =>
          t.id === ticket.id
            ? {
                ...t,
                stage: serverData.stage || t.stage,
                version: serverData.version || t.version,
                previewUrl: serverData.previewUrl,
                updatedAt: serverData.updatedAt || t.updatedAt,
              }
            : t
        );
        queryClient.setQueryData(
          queryKeys.projects.tickets(projectId),
          finalTickets
        );

        // Invalidate jobs status to update job list (job was deleted)
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.jobsStatus(projectId),
        });

        toast({
          title: 'Ticket rolled back to PLAN',
          description: `${ticket.ticketKey} has been moved to PLAN stage. Preview URL cleared.`,
        });
      }
    } catch (error) {
      console.error('Error rolling back to PLAN:', error);

      // Rollback on network error - revert cache
      const revertedTickets = revertTicketStage(
        updatedTickets,
        ticket.id,
        originalStage,
        originalVersion
      );
      queryClient.setQueryData(
        queryKeys.projects.tickets(projectId),
        revertedTickets
      );

      toast({
        variant: 'destructive',
        title: 'Network error',
        description: 'Could not rollback ticket. Please check your connection.',
      });
    }
  }, [pendingVerifyRollback, allTickets, toast, projectId, queryClient]);

  // AIB-75: Handle VERIFY to PLAN rollback cancellation
  const handleVerifyRollbackCancel = useCallback(() => {
    setPendingVerifyRollback(null);
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

  // Used indirectly via setDeleteModalOpen in DeleteConfirmationModal
  const handleDeleteCancel = useCallback(() => {
    setDeleteModalOpen(false);
    setTicketToDelete(null);
  }, []);
  // Silence unused warning - function is used via state setter
  void handleDeleteCancel;

  // Close confirmation handlers (AIB-147)
  const handleCloseConfirm = useCallback(() => {
    if (!ticketToClose) return;

    closeTicketMutation.mutate(
      { ticketId: ticketToClose.id, version: ticketToClose.version },
      {
        onSuccess: () => {
          toast({
            title: 'Ticket closed',
            description: `${ticketToClose.ticketKey} has been closed. You can find it via search.`,
          });
          setCloseModalOpen(false);
          setTicketToClose(null);
        },
        onError: (error) => {
          toast({
            variant: 'destructive',
            title: 'Failed to close ticket',
            description: error.message,
          });
          // Keep modal open on error to allow retry
        },
      }
    );
  }, [ticketToClose, closeTicketMutation, toast]);

  // Used indirectly via setCloseModalOpen in CloseConfirmationModal
  const handleCloseCancel = useCallback(() => {
    setCloseModalOpen(false);
    setTicketToClose(null);
  }, []);
  // Silence unused warning - function is used via state setter
  void handleCloseCancel;

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

      // AIB-72: If cleanup lock is active, disable all drop zones (same behavior as job lock)
      if (isCleanupLockActive) {
        return 'opacity-50 cursor-not-allowed';
      }

      // If ticket has active job, disable all drop zones
      if (draggedTicketHasJob) {
        return 'opacity-50 cursor-not-allowed';
      }

      // Quick-impl mode: Dragging from INBOX
      if (dragSource === Stage.INBOX) {
        if (stage === Stage.SPECIFY) {
          // Normal workflow - blue
          return 'border-4 border-dashed border-blue-500 bg-blue-500/10';
        } else if (stage === Stage.BUILD) {
          // Quick-impl - green
          return 'border-4 border-dashed border-green-500 bg-green-500/10';
        } else {
          // Invalid - gray with reduced opacity
          return 'opacity-50 cursor-not-allowed';
        }
      }

      // Normal drag: Check if valid transition
      if (isValidTransition(dragSource, stage)) {
        return 'border-4 border-dashed border-blue-500 bg-blue-500/10';
      } else {
        return 'opacity-50 cursor-not-allowed';
      }
    },
    [isDragging, dragSource, draggedTicketHasJob, isCleanupLockActive, activeTicket, initialJobs, polledJobs]
  );

  const stages = getAllStages();

  // T024: Trash zone visibility and disabled state
  const trashZoneState = useMemo<{ isVisible: boolean; isDisabled: boolean; disabledReason?: string }>(() => {
    if (!activeTicket || !isDragging) {
      return { isVisible: false, isDisabled: false };
    }

    // Get all jobs for the active ticket (both initial and polled)
    const initialTicketJobs = initialJobs.get(activeTicket.id) || [];
    const polledTicketJobs = polledJobs.filter(job => job.ticketId === activeTicket.id);

    // Merge jobs (polled takes precedence for status updates)
    const jobMap = new Map(initialTicketJobs.map(j => [j.id, j]));
    polledTicketJobs.forEach(pj => {
      jobMap.set(pj.id, pj as any);  // Cast polled job to avoid type issues
    });
    const allTicketJobs = Array.from(jobMap.values());

    // Create ticket with jobs for eligibility check (cast as Partial to avoid type issues)
    const ticketWithJobs = {
      ...activeTicket,
      jobs: allTicketJobs.map(j => ({ status: j.status })),
    } as any;

    const isDeletable = isTicketDeletable(ticketWithJobs);
    const reason = getDeletionBlockReason(ticketWithJobs);

    return {
      isVisible: true,
      isDisabled: !isDeletable,
      ...(reason && { disabledReason: reason }),
    };
  }, [activeTicket, isDragging, initialJobs, polledJobs]);

  // Check if any column is being hovered during drag
  const isAnyColumnOver = activeTicket !== null;

  return (
    <div className="w-full h-full bg-[#1e1e2e]">
      <OfflineIndicator />

      {/* T063: Render CleanupInProgressBanner component at top of board */}
      {/* T064: Conditional rendering - show banner only when activeCleanupJobId is not null */}
      {activeCleanupJobId && (
        <div className="px-4 pt-4">
          <CleanupInProgressBanner
            projectId={projectId}
            jobId={activeCleanupJobId}
          />
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="w-full h-full relative">
          {/* Drop Zone Visual Feedback - Full Board */}
          {isAnyColumnOver && (
            <div className="absolute inset-0 border-4 border-dashed border-blue-500 pointer-events-none bg-blue-500/5 z-10" />
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
              // Exception for rollback: INBOX is not blocked when dragging failed BUILD ticket
              const isRollbackToInbox = dragSource === Stage.BUILD && stage === Stage.INBOX;
              // Exception for rollback: PLAN is not blocked when dragging VERIFY ticket (AIB-75)
              const isRollbackToPlan = dragSource === Stage.VERIFY && stage === Stage.PLAN;
              // AIB-72: Block transitions if either ticket has active job OR cleanup is in progress
              const isBlocked = isDragging && (draggedTicketHasJob || isCleanupLockActive) && !isRollbackToInbox && !isRollbackToPlan;
              // AIB-72: Determine block reason for appropriate overlay message
              const blockReason = isCleanupLockActive ? 'cleanup' as const : 'job' as const;

              // AIB-147: Determine if dragging from VERIFY (for dual zone in SHIP column)
              const isDraggingFromVerify = isDragging && dragSource === Stage.VERIFY;

              // AIB-147: Check if close zone should be disabled (active job on dragged ticket)
              const closeZoneDisabled = draggedTicketHasJob;
              const closeZoneDisabledReason = draggedTicketHasJob
                ? 'Cannot close: workflow is still running'
                : undefined;

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
                  blockReason={blockReason}
                  activePreviewTicket={activePreviewTicket}
                  activeDeploymentTicket={activeDeploymentTicket}
                  isDraggingFromVerify={isDraggingFromVerify}
                  closeZoneDisabled={closeZoneDisabled}
                  closeZoneDisabledReason={closeZoneDisabledReason}
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

      {/* Delete Confirmation Modal (T018, T023) */}
      <DeleteConfirmationModal
        ticket={ticketToDelete}
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteTicketMutation.isPending}
      />

      {/* Close Confirmation Modal (AIB-147) */}
      <CloseConfirmationModal
        ticket={ticketToClose}
        open={closeModalOpen}
        onOpenChange={setCloseModalOpen}
        onConfirm={handleCloseConfirm}
        isClosing={closeTicketMutation.isPending}
      />
    </div>
  );
}

/**
 * Board Component - Polling-Enabled Board
 *
 * Main board component with client-side polling for real-time updates.
 */
export function Board(props: BoardProps) {
  return <BoardContent {...props} />;
}
