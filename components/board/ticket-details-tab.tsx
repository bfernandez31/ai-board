'use client';

import { formatDistanceToNow } from 'date-fns';
import { Pencil, FileText, Settings2, CheckSquare, FileOutput, GitCompare, GitBranch } from 'lucide-react';
import { InboxAnalysisPanel } from '@/components/ticket/inbox-analysis-panel';
import { TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CharacterCounter } from '@/components/ui/character-counter';
import { MentionDisplay } from '@/components/comments/mention-display';
import type { DocumentType } from '@/lib/validations/documentation';
import type { ComparisonCheckResult } from '@/lib/types/comparison';
import type { TicketData } from './ticket-detail-modal-types';
import type { UseTicketDetailModalReturn } from './use-ticket-detail-modal';

interface TicketDetailsTabProps {
  ticket: TicketData;
  localTicket: TicketData | null;
  projectId: number;
  isInboxStage: boolean;
  descriptionEdit: UseTicketDetailModalReturn['descriptionEdit'];
  /**
   * Description textarea ref forwarded separately from `descriptionEdit` so the
   * React Compiler ref rule does not treat the whole edit object as ref-like
   * (which would forbid reading its other fields during render).
   */
  descriptionInputRef: UseTicketDetailModalReturn['descriptionEdit']['inputRef'];
  completedJobs: { specify: boolean; plan: boolean; implement: boolean };
  showPlanButton: boolean;
  showTasksButton: boolean;
  showSummaryButton: boolean;
  showPrDiffButton: boolean;
  comparisonCheck: ComparisonCheckResult | undefined;
  onOpenDoc: (docType: DocumentType) => void;
  onOpenComparison: () => void;
  onOpenPrDiff: () => void;
}

/**
 * Details tab body for {@link TicketDetailModal}: inbox analysis panel,
 * inline-editable description, document/comparison/PR-diff action buttons,
 * and the created/updated footer.
 */
export function TicketDetailsTab({
  ticket,
  localTicket,
  projectId,
  isInboxStage,
  descriptionEdit,
  descriptionInputRef,
  completedJobs,
  showPlanButton,
  showTasksButton,
  showSummaryButton,
  showPrDiffButton,
  comparisonCheck,
  onOpenDoc,
  onOpenComparison,
  onOpenPrDiff,
}: TicketDetailsTabProps) {
  return (
    <TabsContent value="details" className="flex-1 min-h-0 flex flex-col max-h-[calc(100vh-240px)] sm:max-h-[calc(90vh-280px)]">
      {/* Description section with inline editing - scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-2" data-testid="description-container">
        <InboxAnalysisPanel
          projectId={projectId}
          ticketId={ticket.id}
          triggerable={ticket.stage === 'INBOX'}
        />
        <div className="group">
          <h3 className="text-sm text-muted-foreground uppercase tracking-wider mb-4 font-bold">
            Description
          </h3>
          {descriptionEdit.isEditing ? (
            <div className="space-y-4">
              <Textarea
                ref={
                  descriptionInputRef as React.RefObject<HTMLTextAreaElement>
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
                className="bg-secondary border-2 border-primary resize-y px-4 py-3 focus:ring-2 focus:ring-ring/50 leading-relaxed min-h-[200px] !text-white"
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
                  className="px-6"
                  aria-label="Save description changes"
                >
                  {descriptionEdit.isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  type="button"
                  onClick={descriptionEdit.cancelEdit}
                  variant="secondary"
                  disabled={descriptionEdit.isSaving}
                  className="px-6"
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
                ${isInboxStage ? 'cursor-pointer hover:bg-secondary/50' : 'cursor-default'}
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
                    className="w-5 h-5 text-muted-foreground"
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
                  <span className="text-muted-foreground">No description provided</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed footer section - always visible */}
      <div className="flex-shrink-0 pt-4 space-y-4">
        {/* Action buttons section - compact horizontal layout */}
        {/* Show section when any button should be visible (documents OR comparisons) */}
        {(completedJobs.specify || comparisonCheck?.hasComparisons || showPrDiffButton) && (
          <div className="border-t border-ctp-mauve/15 pt-4">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Document buttons - only for FULL workflow with completed specify job */}
              {completedJobs.specify && (
                <Button
                  onClick={() => onOpenDoc('spec')}
                  size="sm"
                  className="border font-medium px-3 py-2 h-auto text-xs flex items-center gap-1.5 border-ctp-sapphire/25 text-ctp-sapphire hover:text-ctp-sapphire bg-transparent aurora-btn-blue"
                  title="View specification document"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Spec
                </Button>
              )}
              {showPlanButton && (
                <Button
                  onClick={() => onOpenDoc('plan')}
                  size="sm"
                  className="border font-medium px-3 py-2 h-auto text-xs flex items-center gap-1.5 border-ctp-mauve/25 text-ctp-mauve hover:text-ctp-mauve bg-transparent aurora-btn-mauve"
                  title="View implementation plan"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Plan
                </Button>
              )}
              {showTasksButton && (
                <Button
                  onClick={() => onOpenDoc('tasks')}
                  size="sm"
                  className="border font-medium px-3 py-2 h-auto text-xs flex items-center gap-1.5 border-ctp-green/25 text-ctp-green hover:text-ctp-green bg-transparent aurora-btn-green"
                  title="View task breakdown"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Tasks
                </Button>
              )}
              {showSummaryButton && (
                <Button
                  onClick={() => onOpenDoc('summary')}
                  size="sm"
                  className="border font-medium px-3 py-2 h-auto text-xs flex items-center gap-1.5 border-ctp-yellow/25 text-ctp-yellow hover:text-ctp-yellow bg-transparent aurora-btn-yellow"
                  title="View implementation summary"
                >
                  <FileOutput className="w-3.5 h-3.5" />
                  Summary
                </Button>
              )}
              {/* Compare button - visible when comparisons exist (independent of workflow type) */}
              {comparisonCheck?.hasComparisons && (
                <Button
                  onClick={onOpenComparison}
                  size="sm"
                  className="border font-medium px-3 py-2 h-auto text-xs flex items-center gap-1.5 border-ctp-pink/25 text-ctp-pink hover:text-ctp-pink bg-transparent aurora-btn-pink"
                  title={`View comparison reports (${comparisonCheck.count})`}
                  data-testid="compare-button"
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  Compare ({comparisonCheck.count})
                </Button>
              )}
              {/* PR Diff button - visible only in VERIFY/SHIP (AIB-879) */}
              {showPrDiffButton && (
                <Button
                  onClick={onOpenPrDiff}
                  size="sm"
                  className="border font-medium px-3 py-2 h-auto text-xs flex items-center gap-1.5 border-ctp-sapphire/25 text-ctp-sapphire hover:text-ctp-sapphire bg-transparent aurora-btn-blue"
                  title="View pull request diff"
                  data-testid="pr-diff-button"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  PR Diff
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Footer with relative dates */}
        <div
          className="border-t border-ctp-mauve/10 pt-3 text-xs text-muted-foreground"
          data-testid="details-footer"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="ticket">{localTicket?.ticketKey || ticket.ticketKey}</Badge>
            <span>·</span>
            <span>📅 Created {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}</span>
            <span>·</span>
            <span>✏️ Updated {formatDistanceToNow(new Date(localTicket?.updatedAt || ticket.updatedAt), { addSuffix: true })}</span>
          </div>
        </div>
      </div>
    </TabsContent>
  );
}
