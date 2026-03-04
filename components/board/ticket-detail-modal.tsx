'use client';

import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect, useMemo } from 'react';
import { Pencil, FileText, Settings2, GitBranch, ExternalLink, CheckSquare, BarChart3, FileOutput, Copy, Loader2, GitCompare, ChevronDown } from 'lucide-react';
import { ImageGallery } from '@/components/ticket/image-gallery';
import { isTicketAttachmentArray } from '@/app/lib/types/ticket';
import type { TicketAttachment } from '@/app/lib/types/ticket';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';
import { TicketStats } from '@/components/ticket/ticket-stats';
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTicketEdit } from '@/lib/hooks/use-ticket-edit';
import { CharacterCounter } from '@/components/ui/character-counter';
import { PolicyBadge } from '@/components/ui/policy-badge';
import { PolicyEditDialog } from '@/components/tickets/policy-edit-dialog';
import { AgentEditDialog } from '@/components/tickets/agent-edit-dialog';
import { getAgentIcon, getAgentLabel } from '@/app/lib/utils/agent-icons';
import DocumentationViewer from './documentation-viewer';
import type { DocumentType } from '@/lib/validations/documentation';
import { ClarificationPolicy, Agent } from '@prisma/client';
import { Stage } from '@/lib/stage-transitions';
import { CommentForm } from '@/components/comments/comment-form';
import { ConversationTimeline } from '@/components/ticket/conversation-timeline';
import { useComments } from '@/app/lib/hooks/queries/use-comments';
import { canEditDescriptionAndPolicy } from '@/lib/utils/field-edit-permissions';
import { MentionDisplay } from '@/components/comments/mention-display';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import type { TicketWithVersion } from '@/app/lib/types/query-types';
import { useComparisonCheck } from '@/hooks/use-comparisons';
import { ComparisonViewer } from '@/components/comparison/comparison-viewer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Ticket type for modal (compatible with both Prisma Ticket and TicketWithVersion)
 */
interface TicketData {
  id: number;
  ticketNumber: number;
  ticketKey: string;
  title: string;
  description: string | null;
  stage: string;
  version: number;
  projectId: number;
  branch: string | null;
  autoMode: boolean;
  clarificationPolicy: ClarificationPolicy | null;
  agent?: Agent | null;
  workflowType: 'FULL' | 'QUICK' | 'CLEAN';
  attachments?: TicketAttachment[] | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  project?: {
    clarificationPolicy: ClarificationPolicy;
    defaultAgent?: Agent;
    githubOwner?: string;
    githubRepo?: string;
  };
}

/**
 * Job data passed from parent for real-time updates
 */
export interface TicketJob {
  id: number;
  command: string;
  status: string;
}

/**
 * Props interface for TicketDetailModal component
 */
interface TicketDetailModalProps {
  /** The ticket to display in the modal. When null, modal should not render content. */
  ticket: TicketData | null;

  /** Controls the visibility of the modal dialog. */
  open: boolean;

  /** Callback fired when the modal requests to be closed (via close button, ESC, or overlay click). */
  onOpenChange: (open: boolean) => void;

  /** Callback fired when ticket is updated successfully to refresh parent state. */
  onUpdate?: (ticket: TicketData) => void;

  /** The project ID for project-scoped API calls */
  projectId: number;

  /** Optional initial tab to display when modal opens. Defaults to 'details'. */
  initialTab?: 'details' | 'comments' | 'files' | 'stats';

  /** Jobs for this ticket, passed from parent for real-time polling updates */
  jobs?: TicketJob[];

  /** Full job data with telemetry fields for Stats tab display */
  fullJobs?: TicketJobWithTelemetry[];
}

/**
 * Stage badge configuration mapping stages to Tailwind CSS classes
 */
const stageBadgeConfig: Record<string, { label: string; className: string }> = {
  INBOX: {
    label: 'Inbox',
    className: 'bg-[#6c7086] text-zinc-50 border-[#6c7086]',
  },
  SPECIFY: {
    label: 'Specify',
    className: 'bg-[#b4befe] text-zinc-900 border-[#b4befe]',
  },
  PLAN: {
    label: 'Plan',
    className: 'bg-[#89b4fa] text-zinc-900 border-[#89b4fa]',
  },
  BUILD: {
    label: 'Build',
    className: 'bg-[#f9cb98] text-zinc-900 border-[#f9cb98]',
  },
  VERIFY: {
    label: 'Verify',
    className: 'bg-[#f2cdcd] text-zinc-900 border-[#f2cdcd]',
  },
  SHIP: {
    label: 'Ship',
    className: 'bg-[#a6e3a1] text-zinc-900 border-[#a6e3a1]',
  },
  // AIB-148: CLOSED stage styling
  CLOSED: {
    label: 'Closed',
    className: 'bg-[#45475a] text-zinc-50 border-[#45475a]',
  },
};

/**
 * Constructs GitHub compare URL for viewing branch changes against main
 * @param owner - GitHub repository owner/organization
 * @param repo - GitHub repository name
 * @param branch - Git branch name (will be URL encoded)
 * @returns Fully qualified GitHub compare URL (main...branch)
 */
const buildGitHubBranchUrl = (
  owner: string,
  repo: string,
  branch: string
): string => {
  return `https://github.com/${owner}/${repo}/compare/main...${encodeURIComponent(branch)}`;
};

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localTicket, setLocalTicket] = useState<TicketData | null>(ticket);
  const [policyEditOpen, setPolicyEditOpen] = useState(false);
  const [agentEditOpen, setAgentEditOpen] = useState(false);
  const [docViewerOpen, setDocViewerOpen] = useState(false);
  const [docViewerType, setDocViewerType] = useState<DocumentType>('plan');
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'files' | 'stats'>(initialTab);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [comparisonViewerOpen, setComparisonViewerOpen] = useState(false);

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
    open && !!ticket && !!ticket.branch
  );

  // Update local ticket when a different ticket is selected, version changes, or branch changes
  useEffect(() => {
    if (ticket) {
      setLocalTicket((current) => {
        // Only update if different ticket, newer version, or branch changed
        // Branch comparison is needed because branch updates don't bump version
        if (
          !current ||
          current.id !== ticket.id ||
          current.version !== ticket.version ||
          current.branch !== ticket.branch
        ) {
          return ticket;
        }
        return current;
      });
    }
  }, [ticket]);

  // Sync activeTab with initialTab when modal opens or initialTab changes
  // This ensures the tab is correctly set even when navigating via URL params
  useEffect(() => {
    if (!open) {
      setPolicyEditOpen(false);
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

  const completedJobs = useMemo(() => {
    if (!localTicket?.branch || jobs.length === 0) {
      return { specify: false, plan: false, implement: false };
    }
    const has = (cmd: string) => jobs.some(j => j.command === cmd && j.status === 'COMPLETED');
    return { specify: has('specify'), plan: has('plan'), implement: has('implement') };
  }, [localTicket?.branch, jobs]);

  const showPlanButton = localTicket?.workflowType === 'FULL' && completedJobs.plan;
  const showTasksButton = showPlanButton;
  const showSummaryButton = localTicket?.workflowType === 'FULL' && completedJobs.implement;

  // Full clone option visibility: Only for stages with branch (SPECIFY, PLAN, BUILD, VERIFY)
  const showFullClone = localTicket?.stage && ['SPECIFY', 'PLAN', 'BUILD', 'VERIFY'].includes(localTicket.stage);

  /**
   * Handle ticket duplication (both simple copy and full clone)
   * @param mode - "simple" for Copy of prefix in INBOX, "full" for Clone of with preserved stage
   */
  const handleDuplicate = async (mode: 'simple' | 'full' = 'simple') => {
    if (!localTicket) return;

    setIsDuplicating(true);

    const queryKey = queryKeys.projects.tickets(projectId);
    const previousData = queryClient.getQueryData<TicketWithVersion[]>(queryKey) || [];

    // Optimistic update: Create temporary ticket for immediate UI feedback
    const tempId = Date.now();
    const now = new Date().toISOString();
    const titlePrefix = mode === 'full' ? 'Clone of ' : 'Copy of ';
    const optimisticTicket: TicketWithVersion = {
      id: tempId,
      ticketNumber: tempId,
      ticketKey: `TEMP-${tempId}`,
      title: `${titlePrefix}${localTicket.title}`.slice(0, 100),
      description: localTicket.description || '',
      stage: mode === 'full' ? (localTicket.stage as Stage) : Stage.INBOX,
      projectId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      branch: mode === 'full' ? 'creating...' : null,
      autoMode: false,
      workflowType: localTicket.workflowType || 'FULL',
      clarificationPolicy: localTicket.clarificationPolicy || null,
      agent: localTicket.agent ?? null,
      attachments: (localTicket.attachments || []) as unknown as TicketWithVersion['attachments'],
    };

    // Add to cache optimistically
    queryClient.setQueryData<TicketWithVersion[]>(queryKey, (old) => [
      ...(old || []),
      optimisticTicket,
    ]);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${localTicket.id}/duplicate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to duplicate ticket');
      }

      const newTicket = await response.json();

      // Invalidate to replace temp with real data
      await queryClient.invalidateQueries({ queryKey });

      toast({
        title: mode === 'full' ? 'Ticket cloned' : 'Ticket copied',
        description: `${mode === 'full' ? 'Cloned' : 'Copied'} to ${newTicket.ticketKey}`,
      });

      // Close modal after successful duplication
      onOpenChange(false);
    } catch (error) {
      // Rollback optimistic update on error
      queryClient.setQueryData(queryKey, previousData);

      const errorMessage = error instanceof Error ? error.message : 'Failed to duplicate ticket';
      toast({
        variant: 'destructive',
        title: mode === 'full' ? 'Clone failed' : 'Copy failed',
        description: errorMessage,
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  /**
   * Refresh ticket data from server
   * Used after conflict detection to get latest version
   */
  const refreshTicketFromServer = async () => {
    if (!localTicket) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${localTicket.id}`
      );
      if (response.ok) {
        const serverTicket = await response.json();
        const normalizedTicket: TicketData = {
          ...serverTicket,
          createdAt: new Date(serverTicket.createdAt),
          updatedAt: new Date(serverTicket.updatedAt),
          // Preserve project field (API doesn't return it)
          project: localTicket.project,
          // Ensure ticket number and key are included from server response (with fallback)
          ticketNumber: serverTicket.ticketNumber ?? localTicket.ticketNumber,
          ticketKey: serverTicket.ticketKey ?? localTicket.ticketKey,
        };
        setLocalTicket(normalizedTicket);
        if (onUpdate) {
          onUpdate(normalizedTicket);
        }
      }
    } catch (error) {
      console.error('Failed to refresh ticket:', error);
    }
  };

  const saveTicketField = async (
    fieldName: string,
    fieldValue: string,
    successMessage: string
  ): Promise<void> => {
    if (!localTicket) return;

    const originalTicket = { ...localTicket };
    setLocalTicket({ ...localTicket, [fieldName]: fieldValue } as TicketData);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${localTicket.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            [fieldName]: fieldValue,
            version: localTicket.version,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();

        if (response.status === 409) {
          setLocalTicket(originalTicket);
          toast({
            variant: 'destructive',
            title: 'Conflict',
            description: 'Ticket was modified by another user. Please refresh to see the latest changes.',
          });
          refreshTicketFromServer();
          return;
        }

        toast({
          variant: 'destructive',
          title: response.status === 400 ? 'Validation Error' : 'Error',
          description: response.status === 400
            ? (error.issues?.[0]?.message || `Invalid ${fieldName}`)
            : 'Failed to save changes while offline. Changes reverted.',
        });
        setTimeout(() => setLocalTicket(originalTicket), 500);
        return;
      }

      const updatedTicket = await response.json();
      const normalizedTicket: TicketData = {
        ...updatedTicket,
        createdAt: new Date(updatedTicket.createdAt),
        updatedAt: new Date(updatedTicket.updatedAt),
        project: localTicket.project,
        attachments: localTicket.attachments,
        ticketNumber: updatedTicket.ticketNumber ?? localTicket.ticketNumber,
        ticketKey: updatedTicket.ticketKey ?? localTicket.ticketKey,
      };

      setLocalTicket(normalizedTicket);
      toast({ title: 'Success', description: successMessage });
      onUpdate?.(normalizedTicket);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save changes while offline. Changes reverted.',
      });
      setTimeout(() => setLocalTicket(originalTicket), 500);
    }
  };

  const handleSaveTitle = (newTitle: string) => saveTicketField('title', newTitle, 'Ticket updated');

  // Save handler for clarification policy
  const handleSavePolicy = async (
    newPolicy: ClarificationPolicy | null
  ): Promise<void> => {
    if (!localTicket) return;

    const originalTicket = { ...localTicket };

    // Optimistic update
    setLocalTicket({ ...localTicket, clarificationPolicy: newPolicy });

    try {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${localTicket.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clarificationPolicy: newPolicy,
            version: localTicket.version,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();

        if (response.status === 409) {
          // Conflict: ticket modified by another user
          setLocalTicket(originalTicket);

          toast({
            variant: 'destructive',
            title: 'Conflict',
            description:
              'Ticket was modified by another user. Please refresh to see the latest changes.',
          });

          refreshTicketFromServer();
          throw new Error('Conflict');
        } else if (response.status === 400) {
          // Validation error
          toast({
            variant: 'destructive',
            title: 'Validation Error',
            description:
              error.issues?.[0]?.message || 'Invalid clarification policy',
          });

          setTimeout(() => {
            setLocalTicket(originalTicket);
          }, 500);
          throw new Error('Validation error');
        } else {
          // Network or other error
          toast({
            variant: 'destructive',
            title: 'Error',
            description:
              'Failed to save changes while offline. Changes reverted.',
          });

          setTimeout(() => {
            setLocalTicket(originalTicket);
          }, 500);
          throw new Error('Network error');
        }
      }

      const updatedTicket = await response.json();

      const normalizedTicket: TicketData = {
        ...updatedTicket,
        createdAt: new Date(updatedTicket.createdAt),
        updatedAt: new Date(updatedTicket.updatedAt),
        // Preserve fields that API doesn't return on updates
        project: localTicket.project,
        attachments: localTicket.attachments,
        // Ensure ticket number and key are preserved (from response or fallback to current)
        ticketNumber: updatedTicket.ticketNumber ?? localTicket.ticketNumber,
        ticketKey: updatedTicket.ticketKey ?? localTicket.ticketKey,
      };

      // Update local ticket with all fields including new version
      setLocalTicket(normalizedTicket);

      toast({
        title: 'Success',
        description: 'Clarification policy updated',
      });

      // Notify parent to refresh board
      if (onUpdate) {
        onUpdate(normalizedTicket);
      }
    } catch (error) {
      // Network error (e.g., offline, fetch failed completely)
      if (
        error instanceof Error &&
        !['Conflict', 'Validation error', 'Network error'].includes(
          error.message
        )
      ) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description:
            'Failed to save changes while offline. Changes reverted.',
        });

        // Rollback on error
        setLocalTicket(originalTicket);
      }
      throw error;
    }
  };

  // Save handler for agent
  const handleSaveAgent = async (
    newAgent: Agent | null
  ): Promise<void> => {
    if (!localTicket) return;

    const originalTicket = { ...localTicket };

    // Optimistic update
    setLocalTicket({ ...localTicket, agent: newAgent });

    try {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${localTicket.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent: newAgent,
            version: localTicket.version,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();

        if (response.status === 409) {
          setLocalTicket(originalTicket);
          toast({
            variant: 'destructive',
            title: 'Conflict',
            description:
              'Ticket was modified by another user. Please refresh to see the latest changes.',
          });
          refreshTicketFromServer();
          throw new Error('Conflict');
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: error.issues?.[0]?.message || 'Failed to update agent',
          });
          setTimeout(() => {
            setLocalTicket(originalTicket);
          }, 500);
          throw new Error('Update error');
        }
      }

      const updatedTicket = await response.json();

      const normalizedTicket: TicketData = {
        ...updatedTicket,
        createdAt: new Date(updatedTicket.createdAt),
        updatedAt: new Date(updatedTicket.updatedAt),
        project: localTicket.project,
        attachments: localTicket.attachments,
        ticketNumber: updatedTicket.ticketNumber ?? localTicket.ticketNumber,
        ticketKey: updatedTicket.ticketKey ?? localTicket.ticketKey,
      };

      setLocalTicket(normalizedTicket);

      toast({
        title: 'Success',
        description: 'AI agent updated',
      });

      if (onUpdate) {
        onUpdate(normalizedTicket);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        !['Conflict', 'Update error'].includes(error.message)
      ) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to save changes. Changes reverted.',
        });
        setLocalTicket(originalTicket);
      }
      throw error;
    }
  };

  const handleSaveDescription = (newDescription: string) => saveTicketField('description', newDescription, 'Ticket updated');

  // Initialize inline edit hooks
  const titleEdit = useTicketEdit({
    initialValue: localTicket?.title || '',
    onSave: handleSaveTitle,
    maxLength: 100,
    fieldType: 'title',
  });

  const descriptionEdit = useTicketEdit({
    initialValue: localTicket?.description || '',
    onSave: handleSaveDescription,
    maxLength: 10000,
    fieldType: 'description',
  });

  // Don't render content if no ticket is selected (after all hooks)
  if (!ticket) {
    return null;
  }

  // Get stage badge configuration
  const stageBadge = stageBadgeConfig[ticket.stage] || {
    label: ticket.stage,
    className: 'bg-zinc-600 text-zinc-50 border-zinc-500',
  };

  // Check if description and policy can be edited based on current stage
  const isInboxStage = canEditDescriptionAndPolicy(ticket.stage as Stage);

  // AIB-148: Check if ticket is closed (read-only mode)
  const isClosedTicket = ticket.stage === 'CLOSED';

  const effectiveAgent = localTicket?.agent ?? localTicket?.project?.defaultAgent;
  const isAgentOverride = localTicket?.agent !== null && localTicket?.agent !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          // Prevent auto-focus on the first interactive element (duplicate button)
          // and redirect focus to the close button for better UX
          event.preventDefault();
          // Find and focus the close button (rendered by DialogContent)
          const closeButton = (event.target as HTMLElement)?.querySelector('button[aria-label="Close"], button:has(.sr-only)');
          if (closeButton instanceof HTMLElement) {
            closeButton.focus();
          }
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
          flex flex-col h-screen w-screen p-4
          !top-0 !translate-y-0
          sm:grid sm:h-auto sm:max-w-2xl sm:max-h-[90vh] sm:rounded-lg sm:p-10
          sm:!top-[50%] sm:!-translate-y-1/2
          bg-[#181825] border-[#313244] text-[#cdd6f4]
        "
      >
        {/* Header with editable title */}
        <DialogHeader className="flex-shrink-0 pb-2 sm:pb-4 space-y-1 sm:space-y-1.5 text-left">
          <DialogDescription className="sr-only">
            View and edit ticket details, including title, description, stage, clarification policy, and documentation.
          </DialogDescription>
          {/* Compact metadata row - ticket key, badges and branch link */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {/* Ticket Key - at the start */}
            <span className="text-sm font-mono font-bold text-muted-foreground" data-testid="ticket-key">
              {localTicket?.ticketKey || ticket.ticketKey}
            </span>

            <Badge
              className={`${stageBadge.className} text-xs px-2 py-0.5 font-medium pointer-events-none`}
              data-testid="stage-badge"
            >
              {stageBadge.label}
            </Badge>
            {/* AIB-148: Read-only indicator for closed tickets */}
            {isClosedTicket && (
              <Badge variant="outline" className="text-xs px-2 py-0.5 text-muted-foreground border-muted-foreground/30">
                Read-only
              </Badge>
            )}
            {localTicket?.project && (
              <PolicyBadge
                policy={
                  localTicket.clarificationPolicy ??
                  localTicket.project.clarificationPolicy
                }
                isOverride={localTicket.clarificationPolicy !== null}
                variant={
                  localTicket.clarificationPolicy !== null
                    ? 'default'
                    : 'secondary'
                }
              />
            )}
            {/* Agent Badge */}
            {localTicket?.project?.defaultAgent && effectiveAgent && (
              <Badge
                variant={isAgentOverride ? 'default' : 'secondary'}
                className="gap-1"
                data-testid="agent-badge"
              >
                <span>{getAgentIcon(effectiveAgent)}</span>
                <span className="text-xs">{getAgentLabel(effectiveAgent)}</span>
                {!isAgentOverride && (
                  <span className="text-xs text-muted-foreground">(default)</span>
                )}
              </Badge>
            )}
            {/* Branch link - compact icon button */}
            {localTicket?.branch &&
              localTicket.branch.length > 0 &&
              localTicket.stage !== 'SHIP' &&
              localTicket.project?.githubOwner &&
              localTicket.project?.githubRepo && (
                <a
                  href={buildGitHubBranchUrl(
                    localTicket.project.githubOwner,
                    localTicket.project.githubRepo,
                    localTicket.branch
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    inline-flex items-center gap-1.5 px-2 py-0.5
                    text-xs font-medium
                    bg-[#313244] hover:bg-[#45475a]
                    text-[#89b4fa] hover:text-[#b4befe]
                    rounded border border-[#45475a]
                    transition-colors duration-200
                    focus:outline-none focus:ring-2 focus:ring-[#89b4fa] focus:ring-offset-2 focus:ring-offset-[#181825]
                  "
                  data-testid="github-branch-link"
                  aria-label={`View branch ${localTicket.branch} in GitHub`}
                  title={`Branch: ${localTicket.branch}`}
                >
                  <GitBranch className="w-3 h-3" aria-hidden="true" />
                  <span className="max-w-[150px] truncate">{localTicket.branch}</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              )}
            {/* Edit Policy button - compact (only visible in INBOX stage) */}
            {localTicket?.project && isInboxStage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPolicyEditOpen(true)}
                className="ml-auto h-6 px-2 text-xs"
                data-testid="edit-policy-button"
                title="Edit clarification policy"
              >
                <Settings2 className="w-3 h-3 mr-1" />
                Edit Policy
              </Button>
            )}
            {/* Edit Agent button - compact (only visible in INBOX stage) */}
            {localTicket?.project?.defaultAgent && isInboxStage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAgentEditOpen(true)}
                className="h-6 px-2 text-xs"
                data-testid="edit-agent-button"
                title="Edit AI agent"
              >
                <Settings2 className="w-3 h-3 mr-1" />
                Edit Agent
              </Button>
            )}
            {/* Duplicate dropdown menu - always visible */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isDuplicating}
                  className={`h-6 px-2 text-xs ${!isInboxStage && !localTicket?.project ? 'ml-auto' : ''}`}
                  data-testid="duplicate-ticket-button"
                >
                  {isDuplicating ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <ChevronDown className="w-3 h-3 mr-1" />
                  )}
                  {isDuplicating ? 'Duplicating...' : 'Duplicate'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDuplicate('simple')}>
                  <Copy className="mr-2 h-4 w-4" />
                  Simple copy
                </DropdownMenuItem>
                {showFullClone && (
                  <DropdownMenuItem onClick={() => handleDuplicate('full')}>
                    <GitBranch className="mr-2 h-4 w-4" />
                    Full clone
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="group">
            {titleEdit.isEditing ? (
              <div className="space-y-3">
                <Input
                  ref={titleEdit.inputRef as React.RefObject<HTMLInputElement>}
                  value={titleEdit.value}
                  onChange={titleEdit.handleChange}
                  onKeyDown={titleEdit.handleKeyDown}
                  onKeyUp={(event) => {
                    if (
                      event.key === 'Escape' ||
                      (event.key === 'Enter' && !event.shiftKey)
                    ) {
                      event.preventDefault();
                      event.stopPropagation();
                    }
                  }}
                  maxLength={100}
                  className="text-2xl font-bold bg-[#313244] border-2 border-[#8B5CF6] px-4 py-3 focus:ring-2 focus:ring-[#8B5CF6]/50 !text-white"
                  disabled={titleEdit.isSaving}
                  data-testid="title-input"
                  name="title"
                  aria-label="Edit ticket title"
                  aria-invalid={!!titleEdit.error}
                  aria-describedby={titleEdit.error ? 'title-error' : undefined}
                />
                {titleEdit.error && (
                  <p
                    id="title-error"
                    className="text-sm text-red-400 font-medium"
                    data-testid="title-error"
                    role="alert"
                  >
                    {titleEdit.error}
                  </p>
                )}
              </div>
            ) : isClosedTicket ? (
              /* AIB-148: Read-only title display for closed tickets */
              <div
                className="flex items-center gap-3 p-3 -ml-3 rounded-lg"
                data-testid="ticket-title"
              >
                <DialogTitle className="text-2xl font-bold text-[#cdd6f4] flex-1">
                  {localTicket?.title || ticket.title}
                </DialogTitle>
              </div>
            ) : (
              <div
                className="flex items-center gap-3 cursor-pointer hover:bg-[#313244]/50 p-3 -ml-3 rounded-lg transition-all duration-200"
                onClick={titleEdit.startEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    titleEdit.startEdit();
                  }
                }}
                data-testid="ticket-title"
                role="button"
                tabIndex={0}
                aria-label="Edit ticket title"
              >
                <DialogTitle className="text-2xl font-bold text-[#cdd6f4] flex-1">
                  {localTicket?.title || ticket.title}
                </DialogTitle>
                <Pencil
                  className="w-5 h-5 text-[#a6adc8] opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  data-testid="edit-icon-title"
                  aria-hidden="true"
                />
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Tabs for organizing modal content */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'details' | 'comments' | 'files' | 'stats')} className="w-full flex-1 flex flex-col -mt-2 sm:mt-0 sm:block sm:flex-initial overflow-hidden">
          <TabsList className={`flex-shrink-0 grid w-full ${hasJobs ? 'grid-cols-4' : 'grid-cols-3'} mb-0 sm:mb-4`}>
            <TabsTrigger value="details" className="text-sm">
              Details
            </TabsTrigger>
            <TabsTrigger value="comments" className="text-sm relative">
              Conversation
              {comments?.comments && comments.comments.length > 0 && (
                <Badge className="ml-2 bg-blue text-white text-xs px-1.5 py-0 h-5 min-w-[1.25rem]">
                  {comments.comments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="files" className="text-sm relative">
              Files
              {localTicket?.attachments && isTicketAttachmentArray(localTicket.attachments) && localTicket.attachments.length > 0 && (
                <Badge className="ml-2 bg-blue text-white text-xs px-1.5 py-0 h-5 min-w-[1.25rem]">
                  {localTicket.attachments.length}
                </Badge>
              )}
            </TabsTrigger>
            {hasJobs && (
              <TabsTrigger value="stats" className="text-sm relative" data-testid="stats-tab-trigger">
                <BarChart3 className="w-4 h-4 mr-1.5" />
                Stats
                <Badge className="ml-2 bg-blue text-white text-xs px-1.5 py-0 h-5 min-w-[1.25rem]">
                  {fullJobs.length}
                </Badge>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="flex-1 min-h-0 flex flex-col max-h-[calc(100vh-240px)] sm:max-h-[calc(90vh-280px)]">
            {/* Description section with inline editing - scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-2" data-testid="description-container">
              <div className="group">
                <h3 className="text-sm text-[#a6adc8] uppercase tracking-wider mb-4 font-bold">
                  Description
                </h3>
                {descriptionEdit.isEditing ? (
                  <div className="space-y-4">
                    <Textarea
                      ref={
                        descriptionEdit.inputRef as React.RefObject<HTMLTextAreaElement>
                      }
                      value={descriptionEdit.value}
                      onChange={descriptionEdit.handleChange}
                      onKeyDown={descriptionEdit.handleKeyDown}
                      onKeyUp={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          event.stopPropagation();
                        }
                      }}
                      maxLength={10000}
                      className="bg-[#313244] border-2 border-[#8B5CF6] resize-y px-4 py-3 focus:ring-2 focus:ring-[#8B5CF6]/50 leading-relaxed min-h-[200px] !text-white"
                      disabled={descriptionEdit.isSaving}
                      data-testid="description-textarea"
                      name="description"
                      aria-label="Edit ticket description"
                      aria-invalid={!!descriptionEdit.error}
                      aria-describedby={
                        descriptionEdit.error
                          ? 'description-error'
                          : 'description-counter'
                      }
                    />
                    <CharacterCounter
                      current={descriptionEdit.value.length}
                      max={10000}
                    />
                    {descriptionEdit.error && (
                      <p
                        id="description-error"
                        className="text-sm text-red-400 font-medium"
                        data-testid="description-error"
                        role="alert"
                      >
                        {descriptionEdit.error}
                      </p>
                    )}
                    <div className="flex gap-3 pt-2">
                      <Button
                        type="button"
                        onClick={async () => {
                          await descriptionEdit.save();
                        }}
                        disabled={
                          descriptionEdit.isSaving ||
                          !!descriptionEdit.error ||
                          descriptionEdit.value.trim() ===
                            (localTicket?.description || '')
                        }
                        className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-medium px-6 shadow-sm"
                        aria-label="Save description changes"
                      >
                        {descriptionEdit.isSaving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        type="button"
                        onClick={descriptionEdit.cancelEdit}
                        variant="outline"
                        disabled={descriptionEdit.isSaving}
                        className="border-2 border-[#45475a] bg-transparent hover:bg-[#313244] text-[#cdd6f4] font-medium px-6"
                        aria-label="Cancel editing"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`
                      p-4 -ml-4 rounded-lg transition-all duration-200
                      relative
                      ${isInboxStage ? 'cursor-pointer hover:bg-[#313244]/50' : 'cursor-default'}
                    `}
                    onClick={isInboxStage ? descriptionEdit.startEdit : undefined}
                    onKeyDown={isInboxStage ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        descriptionEdit.startEdit();
                      }
                    } : undefined}
                    data-testid="ticket-description"
                    role={isInboxStage ? "button" : undefined}
                    tabIndex={isInboxStage ? 0 : undefined}
                    aria-label={isInboxStage ? "Edit ticket description" : "Ticket description (read-only)"}
                  >
                    {isInboxStage && (
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Pencil
                          className="w-5 h-5 text-[#a6adc8]"
                          data-testid="edit-icon-description"
                          aria-hidden="true"
                        />
                      </div>
                    )}
                    <div className="text-base leading-relaxed text-white prose prose-sm prose-invert max-w-none">
                      {(localTicket?.description || ticket.description) ? (
                        <MentionDisplay
                          content={localTicket?.description || ticket.description || ''}
                          mentionedUsers={{}}
                        />
                      ) : (
                        <span className="text-[#a6adc8]">No description provided</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Fixed footer section - always visible */}
            <div className="flex-shrink-0 pt-4 space-y-4 bg-[#181825]">
              {/* Action buttons section - compact horizontal layout */}
              {/* Show section when any button should be visible (documents OR comparisons) */}
              {(completedJobs.specify || comparisonCheck?.hasComparisons) && (
                <div className="border-t-2 border-[#313244]/50 pt-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Document buttons - only for FULL workflow with completed specify job */}
                    {completedJobs.specify && (
                      <Button
                        onClick={() => {
                          setDocViewerType('spec');
                          setDocViewerOpen(true);
                        }}
                        size="sm"
                        className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-medium px-3 py-2 h-auto text-xs flex items-center gap-1.5"
                        title="View specification document"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Spec
                      </Button>
                    )}
                    {showPlanButton && (
                      <Button
                        onClick={() => {
                          setDocViewerType('plan');
                          setDocViewerOpen(true);
                        }}
                        size="sm"
                        className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-medium px-3 py-2 h-auto text-xs flex items-center gap-1.5"
                        title="View implementation plan"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        Plan
                      </Button>
                    )}
                    {showTasksButton && (
                      <Button
                        onClick={() => {
                          setDocViewerType('tasks');
                          setDocViewerOpen(true);
                        }}
                        size="sm"
                        className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-medium px-3 py-2 h-auto text-xs flex items-center gap-1.5"
                        title="View task breakdown"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        Tasks
                      </Button>
                    )}
                    {showSummaryButton && (
                      <Button
                        onClick={() => {
                          setDocViewerType('summary');
                          setDocViewerOpen(true);
                        }}
                        size="sm"
                        className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-medium px-3 py-2 h-auto text-xs flex items-center gap-1.5"
                        title="View implementation summary"
                      >
                        <FileOutput className="w-3.5 h-3.5" />
                        Summary
                      </Button>
                    )}
                    {/* Compare button - visible when comparisons exist (independent of workflow type) */}
                    {comparisonCheck?.hasComparisons && (
                      <Button
                        onClick={() => setComparisonViewerOpen(true)}
                        size="sm"
                        className="bg-[#89b4fa] hover:bg-[#b4befe] text-zinc-900 font-medium px-3 py-2 h-auto text-xs flex items-center gap-1.5"
                        title={`View comparison reports (${comparisonCheck.count})`}
                        data-testid="compare-button"
                      >
                        <GitCompare className="w-3.5 h-3.5" />
                        Compare ({comparisonCheck.count})
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Footer with relative dates */}
              <div
                className="border-t border-border pt-3 text-xs text-muted-foreground"
                data-testid="details-footer"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono">{localTicket?.ticketKey || ticket.ticketKey}</span>
                  <span>·</span>
                  <span>📅 Created {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}</span>
                  <span>·</span>
                  <span>✏️ Updated {formatDistanceToNow(new Date(localTicket?.updatedAt || ticket.updatedAt), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Comments Tab - now Conversation Timeline */}
          <TabsContent value="comments" className="flex-1 min-h-0 overflow-y-auto max-h-[calc(100vh-240px)] sm:max-h-[calc(90vh-280px)] pr-2 pb-4">
            <div className="space-y-4">
              {/* AIB-148: Hide comment form for closed tickets */}
              {isClosedTicket ? (
                <div className="text-sm text-muted-foreground italic px-3 py-2 bg-surface0/50 rounded">
                  This ticket is closed. Comments are disabled.
                </div>
              ) : (
                /* Comment form at top for adding new comments */
                <CommentForm
                  projectId={projectId}
                  ticketId={ticket.id}
                  {...(setIsAutocompleteOpen && { onAutocompleteOpenChange: setIsAutocompleteOpen })}
                />
              )}

              {/* Timeline separator */}
              <div className="border-t border-surface0 pt-4">
                {/* Unified conversation timeline (comments + job events) */}
                <ConversationTimeline
                  projectId={projectId}
                  ticketId={ticket.id}
                />
              </div>
            </div>
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="flex-1 min-h-0 overflow-y-auto max-h-[calc(100vh-240px)] sm:max-h-[calc(90vh-280px)] pr-2 pb-4">
            <ImageGallery
              projectId={projectId}
              ticketId={localTicket?.id || ticket.id}
              ticketStage={localTicket?.stage as Stage || ticket.stage as Stage}
              ticketVersion={localTicket?.version || ticket.version}
              attachmentCount={
                (localTicket?.attachments && isTicketAttachmentArray(localTicket.attachments)
                  ? localTicket.attachments.length
                  : ticket.attachments && isTicketAttachmentArray(ticket.attachments)
                  ? ticket.attachments.length
                  : 0)
              }
              onAttachmentsUpdated={refreshTicketFromServer}
            />
          </TabsContent>

          {/* Stats Tab - only rendered when jobs exist */}
          {hasJobs && (
            <TabsContent value="stats" className="flex-1 min-h-0 overflow-y-auto max-h-[calc(100vh-240px)] sm:max-h-[calc(90vh-280px)] pr-2 pb-4" data-testid="stats-tab-content">
              <TicketStats jobs={fullJobs} polledJobs={jobs} />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>

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

      {/* PolicyEditDialog - only render when parent dialog is open */}
      {localTicket?.project && open && (
        <PolicyEditDialog
          open={policyEditOpen}
          onOpenChange={setPolicyEditOpen}
          currentPolicy={localTicket.clarificationPolicy}
          projectDefaultPolicy={localTicket.project.clarificationPolicy}
          onSave={handleSavePolicy}
        />
      )}

      {/* AgentEditDialog - only render when parent dialog is open */}
      {localTicket?.project?.defaultAgent && open && (
        <AgentEditDialog
          open={agentEditOpen}
          onOpenChange={setAgentEditOpen}
          currentAgent={localTicket.agent ?? null}
          projectDefaultAgent={localTicket.project.defaultAgent}
          onSave={handleSaveAgent}
        />
      )}

      {/* ComparisonViewer modal - only render when parent dialog is open */}
      {ticket && open && (
        <ComparisonViewer
          projectId={projectId}
          ticketId={ticket.id}
          isOpen={comparisonViewerOpen}
          onClose={() => setComparisonViewerOpen(false)}
        />
      )}
    </Dialog>
  );
}
