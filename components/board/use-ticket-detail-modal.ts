'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useTicketEdit } from '@/lib/hooks/use-ticket-edit';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import { ClarificationPolicy, Agent } from '@prisma/client';
import { Stage } from '@/lib/stage-transitions';
import type { TicketWithVersion } from '@/app/lib/types/query-types';
import type { TicketData } from './ticket-detail-modal-types';

interface UseTicketDetailModalParams {
  ticket: TicketData | null;
  projectId: number;
  onUpdate?: ((ticket: TicketData) => void) | undefined;
  onOpenChange: (open: boolean) => void;
}

/**
 * Encapsulates the local ticket state, optimistic mutation handlers, and inline
 * edit hooks for {@link TicketDetailModal}. Extracted so the modal component
 * stays presentational and within the Component-Driven Architecture size budget.
 */
export function useTicketDetailModal({
  ticket,
  projectId,
  onUpdate,
  onOpenChange,
}: UseTicketDetailModalParams) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localTicket, setLocalTicket] = useState<TicketData | null>(ticket);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Update local ticket when a different ticket is selected, version changes, or branch changes.
  // Reset to null on close so derived edit-hook initialValues change, which lets the inline
  // edit hooks discard in-progress edits instead of leaking them to the next ticket.
  useEffect(() => {
    if (!ticket) {
      setLocalTicket(null);
      return;
    }
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
  }, [ticket]);

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
      tokenSaving: localTicket.tokenSaving ?? null,
      clarificationPolicy: localTicket.clarificationPolicy || null,
      agent: localTicket.agent ?? null,
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
      attachments: (localTicket.attachments || []) as unknown as TicketWithVersion['attachments'],
      qualityScore: null,
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

  const handleSaveModelOverrides = async (input: {
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
  }): Promise<void> => {
    if (!localTicket) return;

    const originalTicket = { ...localTicket };

    const optimistic: TicketData = input.resetAll
      ? {
          ...localTicket,
          specifyModel: null,
          planModel: null,
          implementModel: null,
          quickImplModel: null,
          verifyModel: null,
          codexSpecifyModel: null,
          codexPlanModel: null,
          codexImplementModel: null,
          codexQuickImplModel: null,
          codexVerifyModel: null,
        }
      : {
          ...localTicket,
          specifyModel:
            input.specifyModel !== undefined ? input.specifyModel : localTicket.specifyModel ?? null,
          planModel:
            input.planModel !== undefined ? input.planModel : localTicket.planModel ?? null,
          implementModel:
            input.implementModel !== undefined
              ? input.implementModel
              : localTicket.implementModel ?? null,
          quickImplModel:
            input.quickImplModel !== undefined
              ? input.quickImplModel
              : localTicket.quickImplModel ?? null,
          verifyModel:
            input.verifyModel !== undefined ? input.verifyModel : localTicket.verifyModel ?? null,
          codexSpecifyModel:
            input.codexSpecifyModel !== undefined
              ? input.codexSpecifyModel
              : localTicket.codexSpecifyModel ?? null,
          codexPlanModel:
            input.codexPlanModel !== undefined
              ? input.codexPlanModel
              : localTicket.codexPlanModel ?? null,
          codexImplementModel:
            input.codexImplementModel !== undefined
              ? input.codexImplementModel
              : localTicket.codexImplementModel ?? null,
          codexQuickImplModel:
            input.codexQuickImplModel !== undefined
              ? input.codexQuickImplModel
              : localTicket.codexQuickImplModel ?? null,
          codexVerifyModel:
            input.codexVerifyModel !== undefined
              ? input.codexVerifyModel
              : localTicket.codexVerifyModel ?? null,
        };

    setLocalTicket(optimistic);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${localTicket.id}/model-config`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        setLocalTicket(originalTicket);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error?.error || 'Failed to update model overrides',
        });
        throw new Error('Update error');
      }

      const updated = await response.json();
      const normalizedTicket: TicketData = {
        ...optimistic,
        specifyModel: updated.specifyModel ?? null,
        planModel: updated.planModel ?? null,
        implementModel: updated.implementModel ?? null,
        quickImplModel: updated.quickImplModel ?? null,
        verifyModel: updated.verifyModel ?? null,
        codexSpecifyModel: updated.codexSpecifyModel ?? null,
        codexPlanModel: updated.codexPlanModel ?? null,
        codexImplementModel: updated.codexImplementModel ?? null,
        codexQuickImplModel: updated.codexQuickImplModel ?? null,
        codexVerifyModel: updated.codexVerifyModel ?? null,
      };
      setLocalTicket(normalizedTicket);

      toast({
        title: 'Success',
        description: 'Model overrides updated',
      });

      if (onUpdate) {
        onUpdate(normalizedTicket);
      }
    } catch (error) {
      if (error instanceof Error && error.message !== 'Update error') {
        setLocalTicket(originalTicket);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to save model overrides. Changes reverted.',
        });
      }
      throw error;
    }
  };

  const handleSaveDescription = (newDescription: string) =>
    saveTicketField('description', newDescription, 'Ticket updated');

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

  return {
    localTicket,
    setLocalTicket,
    isDuplicating,
    handleDuplicate,
    refreshTicketFromServer,
    handleSavePolicy,
    handleSaveAgent,
    handleSaveModelOverrides,
    titleEdit,
    descriptionEdit,
  };
}

export type UseTicketDetailModalReturn = ReturnType<typeof useTicketDetailModal>;
