'use client';

import { format } from 'date-fns';
import { useState, useEffect, useMemo } from 'react';
import { Pencil, FileText, Settings2, GitBranch, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTicketEdit } from '@/lib/hooks/use-ticket-edit';
import { CharacterCounter } from '@/components/ui/character-counter';
import { PolicyBadge } from '@/components/ui/policy-badge';
import { PolicyEditDialog } from '@/components/tickets/policy-edit-dialog';
import SpecViewer from './spec-viewer';
import { ClarificationPolicy } from '@prisma/client';

/**
 * Ticket type for modal (compatible with both Prisma Ticket and TicketWithVersion)
 */
interface TicketData {
  id: number;
  title: string;
  description: string | null;
  stage: string;
  version: number;
  projectId: number;
  branch: string | null;
  autoMode: boolean;
  clarificationPolicy: ClarificationPolicy | null;
  workflowType: 'FULL' | 'QUICK';
  createdAt: Date | string;
  updatedAt: Date | string;
  project?: {
    clarificationPolicy: ClarificationPolicy;
    githubOwner?: string;
    githubRepo?: string;
  };
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
}

/**
 * Stage badge configuration mapping stages to Tailwind CSS classes
 */
const stageBadgeConfig: Record<string, { label: string; className: string }> = {
  INBOX: {
    label: 'Inbox',
    className: 'bg-zinc-600 text-zinc-50 border-zinc-500',
  },
  PLAN: {
    label: 'Plan',
    className: 'bg-blue-600 text-blue-50 border-blue-500',
  },
  BUILD: {
    label: 'Build',
    className: 'bg-green-600 text-green-50 border-green-500',
  },
  VERIFY: {
    label: 'Verify',
    className: 'bg-orange-600 text-orange-50 border-orange-500',
  },
  SHIP: {
    label: 'Ship',
    className: 'bg-purple-600 text-purple-50 border-purple-500',
  },
};

/**
 * Helper function to format ticket dates in human-readable format
 */
const formatTicketDate = (date: Date | string | null | undefined): string => {
  if (!date) return 'Unknown date';

  try {
    return format(new Date(date), 'MMM d, yyyy h:mm a');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
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

/**
 * TicketDetailModal Component
 *
 * Displays full ticket details in a modal dialog with inline editing capabilities.
 * The modal is responsive:
 * - Mobile (<768px): Full-screen layout
 * - Desktop (≥768px): Centered modal with max-width
 *
 * Features:
 * - Display ticket title, description, stage, and dates
 * - Inline editing for title and description
 * - Optimistic updates with rollback on error
 * - Version-based concurrency control
 * - Close via button, ESC key, or clicking outside
 * - Keyboard accessible with focus trap
 * - Dark theme styling consistent with app
 *
 * @param ticket - The ticket object to display, or null to hide content
 * @param open - Boolean controlling modal visibility
 * @param onOpenChange - Callback for state changes (e.g., when user closes modal)
 * @param onUpdate - Callback to refresh parent board state after successful update
 */
export function TicketDetailModal({
  ticket,
  open,
  onOpenChange,
  onUpdate,
  projectId,
}: TicketDetailModalProps) {
  const { toast } = useToast();
  const [localTicket, setLocalTicket] = useState<TicketData | null>(ticket);
  const [specViewerOpen, setSpecViewerOpen] = useState(false);
  const [policyEditOpen, setPolicyEditOpen] = useState(false);
  const [jobs, setJobs] = useState<Array<{ id: number; command: string; status: string }>>([]);

  // Update local ticket when a different ticket is selected or version changes
  useEffect(() => {
    if (ticket) {
      setLocalTicket((current) => {
        // Only update if different ticket or newer version
        if (
          !current ||
          current.id !== ticket.id ||
          current.version !== ticket.version
        ) {
          return ticket;
        }
        return current;
      });
    }
  }, [ticket]);

  // Reset child dialog states when parent dialog closes
  useEffect(() => {
    if (!open) {
      setSpecViewerOpen(false);
      setPolicyEditOpen(false);
    }
  }, [open]);

  // Fetch jobs for the ticket to check for completed specify job
  useEffect(() => {
    if (!ticket || !open) {
      setJobs([]);
      return;
    }

    const fetchJobs = async () => {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/tickets/${ticket.id}/jobs`
        );
        if (response.ok) {
          const jobsData = await response.json();
          setJobs(jobsData);
        }
      } catch (error) {
        console.error('Failed to fetch jobs:', error);
        setJobs([]);
      }
    };

    fetchJobs();
  }, [ticket, open, projectId]);

  // Check if "View Specification" button should be visible
  const hasCompletedSpecifyJob = useMemo(() => {
    if (!localTicket?.branch || jobs.length === 0) return false;
    return jobs.some(
      (job) => job.command === 'specify' && job.status === 'COMPLETED'
    );
  }, [localTicket?.branch, jobs]);

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

  // Save handler for title
  const handleSaveTitle = async (newTitle: string): Promise<void> => {
    if (!localTicket) return;

    const originalTicket = { ...localTicket };

    // Optimistic update
    setLocalTicket({ ...localTicket, title: newTitle });

    try {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${localTicket.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newTitle,
            version: localTicket.version,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();

        if (response.status === 409) {
          // Conflict: ticket modified by another user
          // Revert optimistic update immediately
          setLocalTicket(originalTicket);

          toast({
            variant: 'destructive',
            title: 'Conflict',
            description:
              'Ticket was modified by another user. Please refresh to see the latest changes.',
          });

          // Refresh ticket from server to get the actual current state
          refreshTicketFromServer();
          return; // Don't throw, just return
        } else if (response.status === 400) {
          // Validation error
          toast({
            variant: 'destructive',
            title: 'Validation Error',
            description: error.issues?.[0]?.message || 'Invalid title',
          });

          // Rollback after short delay to allow optimistic state to show
          setTimeout(() => {
            setLocalTicket(originalTicket);
          }, 500);
          return; // Don't throw, just return
        } else {
          // Network or other error
          toast({
            variant: 'destructive',
            title: 'Error',
            description:
              'Failed to save changes while offline. Changes reverted.',
          });

          // Rollback after short delay to allow optimistic state to show
          setTimeout(() => {
            setLocalTicket(originalTicket);
          }, 500);
          return; // Don't throw, just return
        }
      }

      const updatedTicket = await response.json();

      const normalizedTicket: TicketData = {
        ...updatedTicket,
        createdAt: new Date(updatedTicket.createdAt),
        updatedAt: new Date(updatedTicket.updatedAt),
        // Preserve project field (API doesn't return it)
        project: localTicket.project,
      };

      // Update local ticket with all fields including new version
      setLocalTicket(normalizedTicket);

      toast({
        title: 'Success',
        description: 'Ticket updated',
      });

      // Notify parent to refresh board
      if (onUpdate) {
        onUpdate(normalizedTicket);
      }
    } catch (error) {
      // Network error (e.g., offline, fetch failed completely)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save changes while offline. Changes reverted.',
      });

      // Rollback on error
      setLocalTicket(originalTicket);
    }
  };

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
        // Preserve project field (API doesn't return it)
        project: localTicket.project,
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

  // Save handler for description
  const handleSaveDescription = async (
    newDescription: string
  ): Promise<void> => {
    if (!localTicket) return;

    const originalTicket = { ...localTicket };

    // Optimistic update
    setLocalTicket({ ...localTicket, description: newDescription });

    try {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${localTicket.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: newDescription,
            version: localTicket.version,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();

        if (response.status === 409) {
          // Conflict: ticket modified by another user
          // Revert optimistic update immediately
          setLocalTicket(originalTicket);

          toast({
            variant: 'destructive',
            title: 'Conflict',
            description:
              'Ticket was modified by another user. Please refresh to see the latest changes.',
          });

          // Refresh ticket from server to get the actual current state
          refreshTicketFromServer();
          return; // Don't throw, just return
        } else if (response.status === 400) {
          // Validation error
          toast({
            variant: 'destructive',
            title: 'Validation Error',
            description: error.issues?.[0]?.message || 'Invalid description',
          });

          // Rollback after short delay to allow optimistic state to show
          setTimeout(() => {
            setLocalTicket(originalTicket);
          }, 500);
          return; // Don't throw, just return
        } else {
          // Network or other error
          toast({
            variant: 'destructive',
            title: 'Error',
            description:
              'Failed to save changes while offline. Changes reverted.',
          });

          // Rollback after short delay to allow optimistic state to show
          setTimeout(() => {
            setLocalTicket(originalTicket);
          }, 500);
          return; // Don't throw, just return
        }
      }

      const updatedTicket = await response.json();

      const normalizedTicket: TicketData = {
        ...updatedTicket,
        createdAt: new Date(updatedTicket.createdAt),
        updatedAt: new Date(updatedTicket.updatedAt),
        // Preserve project field (API doesn't return it)
        project: localTicket.project,
      };

      // Update local ticket with all fields including new version
      setLocalTicket(normalizedTicket);

      toast({
        title: 'Success',
        description: 'Ticket updated',
      });

      // Notify parent to refresh board
      if (onUpdate) {
        onUpdate(normalizedTicket);
      }
    } catch (error) {
      // Network error (e.g., offline, fetch failed completely)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save changes while offline. Changes reverted.',
      });

      // Rollback on error
      setLocalTicket(originalTicket);
    }
  };

  // Initialize inline edit hooks
  const titleEdit = useTicketEdit({
    initialValue: localTicket?.title || '',
    onSave: handleSaveTitle,
    maxLength: 100,
  });

  const descriptionEdit = useTicketEdit({
    initialValue: localTicket?.description || '',
    onSave: handleSaveDescription,
    maxLength: 1000,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onEscapeKeyDown={(event) => {
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
          h-screen w-screen p-6
          sm:h-auto sm:max-w-2xl sm:max-h-[90vh] sm:rounded-lg sm:p-10
          bg-[#181825] border-[#313244] text-[#cdd6f4]
        "
      >
        {/* Header with editable title */}
        <DialogHeader className="pb-4">
          {/* Compact metadata row - badges and branch link */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge
              className={`${stageBadge.className} text-xs px-2 py-0.5 font-medium`}
              data-testid="stage-badge"
            >
              {stageBadge.label}
            </Badge>
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
            {/* Edit Policy button - compact */}
            {localTicket?.project && (
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
                  className="text-2xl font-bold bg-[#313244] border-2 border-[#8B5CF6] text-[#cdd6f4] px-4 py-3 focus:ring-2 focus:ring-[#8B5CF6]/50"
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

        {/* Modal body content */}
        <div className="space-y-8">

          {/* Description section with inline editing */}
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
                  maxLength={1000}
                  rows={8}
                  className="bg-[#313244] border-2 border-[#8B5CF6] text-[#cdd6f4] resize-none px-4 py-3 focus:ring-2 focus:ring-[#8B5CF6]/50 leading-relaxed"
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
                  max={1000}
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
                className="
                  cursor-pointer hover:bg-[#313244]/50 p-4 -ml-4 rounded-lg transition-all duration-200
                  relative
                "
                onClick={descriptionEdit.startEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    descriptionEdit.startEdit();
                  }
                }}
                data-testid="ticket-description"
                role="button"
                tabIndex={0}
                aria-label="Edit ticket description"
              >
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Pencil
                    className="w-5 h-5 text-[#a6adc8]"
                    data-testid="edit-icon-description"
                    aria-hidden="true"
                  />
                </div>
                <div
                  className="
                    text-base text-[#cdd6f4] leading-relaxed
                    max-h-96 overflow-y-auto
                    pr-2
                    scrollbar-thin scrollbar-thumb-[#585b70] scrollbar-track-[#1e1e2e]
                  "
                >
                  {localTicket?.description ||
                    ticket.description ||
                    'No description provided'}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons section - compact horizontal layout */}
          {hasCompletedSpecifyJob && (
            <div className="border-t-2 border-[#313244]/50 pt-6">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => setSpecViewerOpen(true)}
                  size="sm"
                  className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-medium px-3 py-2 h-auto text-xs flex items-center gap-1.5"
                  title="View specification document"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Spec
                </Button>
                {/* Placeholder for future buttons */}
                {/* <Button size="sm" variant="secondary" className="...">
                  <FileText className="w-3.5 h-3.5" />
                  Plan
                </Button>
                <Button size="sm" variant="secondary" className="...">
                  <FileText className="w-3.5 h-3.5" />
                  Tasks
                </Button> */}
              </div>
            </div>
          )}

          {/* Dates section */}
          <div className="border-t-2 border-[#313244]/50 pt-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#a6adc8] font-medium">
                Created:
              </span>
              <span className="text-sm text-[#cdd6f4] font-mono">
                {formatTicketDate(ticket.createdAt)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#a6adc8] font-medium">
                Last Updated:
              </span>
              <span className="text-sm text-[#cdd6f4] font-mono">
                {formatTicketDate(localTicket?.updatedAt || ticket.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* SpecViewer modal - only render when parent dialog is open */}
      {ticket && open && (
        <SpecViewer
          ticketId={ticket.id}
          projectId={projectId}
          ticketTitle={ticket.title}
          open={specViewerOpen}
          onOpenChange={setSpecViewerOpen}
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
    </Dialog>
  );
}
