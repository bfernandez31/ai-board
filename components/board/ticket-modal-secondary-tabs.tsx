'use client';

import { ImageGallery } from '@/components/ticket/image-gallery';
import { isTicketAttachmentArray } from '@/app/lib/types/ticket';
import { TicketStats } from '@/components/ticket/ticket-stats';
import { TabsContent } from '@/components/ui/tabs';
import { CommentForm } from '@/components/comments/comment-form';
import { ConversationTimeline } from '@/components/ticket/conversation-timeline';
import { Stage } from '@/lib/stage-transitions';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';
import type { TicketData, TicketJob } from './ticket-detail-modal-types';

interface TicketModalSecondaryTabsProps {
  ticket: TicketData;
  localTicket: TicketData | null;
  projectId: number;
  isClosedTicket: boolean;
  hasJobs: boolean;
  jobs: TicketJob[];
  fullJobs: TicketJobWithTelemetry[];
  setIsAutocompleteOpen: (open: boolean) => void;
  refreshTicketFromServer: () => void;
}

/**
 * Conversation, Files, and Stats tab panels for {@link TicketDetailModal}.
 * Grouped here to keep the modal orchestrator within the component size budget;
 * the Details tab lives in {@link TicketDetailsTab}.
 */
export function TicketModalSecondaryTabs({
  ticket,
  localTicket,
  projectId,
  isClosedTicket,
  hasJobs,
  jobs,
  fullJobs,
  setIsAutocompleteOpen,
  refreshTicketFromServer,
}: TicketModalSecondaryTabsProps) {
  return (
    <>
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
          <TicketStats jobs={fullJobs} polledJobs={jobs} projectId={projectId} ticketId={ticket.id} />
        </TabsContent>
      )}
    </>
  );
}
