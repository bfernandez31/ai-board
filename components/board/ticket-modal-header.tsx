'use client';

import { Pencil, Settings2, GitBranch, ExternalLink, Copy, Loader2, X, MoreHorizontal } from 'lucide-react';
import {
  DialogClose,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PolicyBadge } from '@/components/ui/policy-badge';
import { TokenSavingBadge } from '@/components/ui/token-saving-badge';
import { getAgentLabel } from '@/app/lib/utils/agent-icons';
import { AgentIcon } from '@/components/ui/agent-icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TicketData, CanonicalStage } from './ticket-detail-modal-types';
import type { UseTicketDetailModalReturn } from './use-ticket-detail-modal';

/**
 * Stage badge configuration. Stage variant uses canonical Catppuccin colors;
 * CLOSED is non-canonical and falls back to the neutral secondary variant.
 */
const stageBadgeConfig: Record<
  string,
  { label: string; stage?: CanonicalStage }
> = {
  INBOX: { label: 'Inbox', stage: 'inbox' },
  SPECIFY: { label: 'Specify', stage: 'specify' },
  PLAN: { label: 'Plan', stage: 'plan' },
  BUILD: { label: 'Build', stage: 'build' },
  VERIFY: { label: 'Verify', stage: 'verify' },
  SHIP: { label: 'Ship', stage: 'ship' },
  CLOSED: { label: 'Closed' },
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

interface TicketModalHeaderProps {
  ticket: TicketData;
  localTicket: TicketData | null;
  isClosedTicket: boolean;
  isDuplicating: boolean;
  showFullClone: boolean;
  titleEdit: UseTicketDetailModalReturn['titleEdit'];
  /**
   * Title input ref forwarded separately from `titleEdit` so the React Compiler
   * ref rule does not treat the whole edit object as ref-like (which would
   * forbid reading its other fields during render).
   */
  titleInputRef: UseTicketDetailModalReturn['titleEdit']['inputRef'];
  onOpenRunSettings: () => void;
  onDuplicate: (mode: 'simple' | 'full') => void;
}

/**
 * Header for {@link TicketDetailModal}: identity/metadata status strip, actions
 * overflow menu, close control, and the inline-editable ticket title.
 */
export function TicketModalHeader({
  ticket,
  localTicket,
  isClosedTicket,
  isDuplicating,
  showFullClone,
  titleEdit,
  titleInputRef,
  onOpenRunSettings,
  onDuplicate,
}: TicketModalHeaderProps) {
  const stageBadge = stageBadgeConfig[ticket.stage] || { label: ticket.stage };

  const effectiveAgent = localTicket?.agent ?? localTicket?.project?.defaultAgent;
  const isAgentOverride = localTicket?.agent !== null && localTicket?.agent !== undefined;

  // AIB-849: effective token saving (ticket override > project default).
  const effectiveTokenSaving =
    localTicket?.tokenSaving ?? localTicket?.project?.tokenSaving ?? false;
  const isTokenSavingOverride =
    localTicket?.tokenSaving !== null && localTicket?.tokenSaving !== undefined;

  return (
    <DialogHeader className="flex-shrink-0 pb-1 sm:pb-2 space-y-0.5 text-left">
      <DialogDescription className="sr-only">
        View and edit ticket details, including title, description, stage, clarification policy, and documentation.
      </DialogDescription>
      {/* Integrated status strip: identity + metadata + actions */}
      <div className="flex items-center gap-2 mb-2">
        {/* Left: ticket key + stage pip + metadata badges */}
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          <Badge variant="ticket" data-testid="ticket-key">
            {localTicket?.ticketKey || ticket.ticketKey}
          </Badge>
          {stageBadge.stage ? (
            <Badge
              variant="stage"
              stage={stageBadge.stage}
              data-testid="stage-badge"
            >
              {stageBadge.label}
            </Badge>
          ) : (
            <Badge variant="secondary" data-testid="stage-badge">
              {stageBadge.label}
            </Badge>
          )}
          {isClosedTicket && (
            <Badge variant="outline">Read-only</Badge>
          )}
          <span className="text-muted-foreground/30 select-none hidden sm:inline">·</span>
          {localTicket?.project && (
            <PolicyBadge
              policy={
                localTicket.clarificationPolicy ??
                localTicket.project.clarificationPolicy
              }
              isOverride={localTicket.clarificationPolicy !== null}
              variant="secondary"
              className="text-xs py-0.5 px-2 font-normal"
            />
          )}
          {effectiveAgent && (
            <Badge
              variant={isAgentOverride ? 'default' : 'secondary'}
              data-testid="agent-badge"
              title={`Agent${isAgentOverride ? ' (override)' : ''}`}
            >
              <AgentIcon agent={effectiveAgent} size={14} />
              <span>{getAgentLabel(effectiveAgent)}</span>
              {!isAgentOverride && <span className="opacity-70">(default)</span>}
            </Badge>
          )}
          {effectiveTokenSaving === true && (
            <TokenSavingBadge
              isOverride={isTokenSavingOverride}
              className="text-xs py-0.5 px-2 font-normal"
            />
          )}
          {localTicket?.branch &&
            localTicket.branch.length > 0 &&
            localTicket.stage !== 'SHIP' &&
            localTicket.project?.githubOwner &&
            localTicket.project?.githubRepo && (
              <>
                <span className="text-muted-foreground/30 select-none hidden sm:inline">·</span>
                <a
                  href={buildGitHubBranchUrl(
                    localTicket.project.githubOwner,
                    localTicket.project.githubRepo,
                    localTicket.branch
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium text-ctp-green hover:text-ctp-teal rounded-full border border-ctp-green/15 aurora-bg-muted transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-ctp-green/30"
                  data-testid="github-branch-link"
                  aria-label={`View branch ${localTicket.branch} in GitHub`}
                  title={`Branch: ${localTicket.branch}`}
                >
                  <GitBranch className="w-3 h-3" aria-hidden="true" />
                  <span className="max-w-[150px] truncate">{localTicket.branch}</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              </>
            )}
        </div>

        {/* Right: overflow menu + close */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  data-testid="ticket-actions-menu"
                  disabled={isDuplicating}
                >
                  {isDuplicating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  )}
                  <span className="sr-only">Ticket actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {localTicket?.project && (
                  <DropdownMenuItem
                    onClick={onOpenRunSettings}
                    data-testid="run-settings-button"
                  >
                    <Settings2 className="mr-2 h-4 w-4" />
                    Run settings
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => onDuplicate('simple')}
                  disabled={isDuplicating}
                  data-testid="duplicate-ticket-button"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Simple copy
                </DropdownMenuItem>
                {showFullClone && (
                  <DropdownMenuItem
                    onClick={() => onDuplicate('full')}
                    disabled={isDuplicating}
                  >
                    <GitBranch className="mr-2 h-4 w-4" />
                    Full clone
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          <DialogClose aria-label="Close" className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ml-0.5">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>
      </div>

      <div className="group">
        {titleEdit.isEditing ? (
          <div className="space-y-3">
            <Input
              ref={titleInputRef as React.RefObject<HTMLInputElement>}
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
              className="text-2xl font-bold bg-secondary border-2 border-primary px-4 py-3 focus:ring-2 focus:ring-ring/50 !text-white"
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
            <DialogTitle className="text-2xl font-bold text-foreground flex-1">
              {localTicket?.title || ticket.title}
            </DialogTitle>
          </div>
        ) : (
          <div
            className="flex items-center gap-3 cursor-pointer hover:bg-secondary/50 p-3 -ml-3 rounded-lg transition-all duration-200"
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
            <DialogTitle className="text-2xl font-bold text-foreground flex-1">
              {localTicket?.title || ticket.title}
            </DialogTitle>
            <Pencil
              className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              data-testid="edit-icon-title"
              aria-hidden="true"
            />
          </div>
        )}
      </div>
    </DialogHeader>
  );
}
