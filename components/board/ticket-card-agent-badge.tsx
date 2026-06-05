'use client';

import * as React from 'react';

import { Agent } from '@prisma/client';
import { AgentIcon } from '@/components/ui/agent-icon';
import { getAgentLabel } from '@/app/lib/utils/agent-icons';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { TicketWithVersion } from '@/lib/types';
import { STAGE_MODEL_KEYS, STAGE_MODEL_LABELS } from '@/lib/models/claude-models';
import { CODEX_STAGE_MODEL_KEYS, CODEX_STAGE_MODEL_LABELS } from '@/lib/models/codex-models';

interface TicketCardAgentBadgeProps {
  ticket: TicketWithVersion;
}

/**
 * Agent Badge Component
 *
 * Renders the agent icon for a ticket, optionally wrapped in a "custom models"
 * halo ring when stage-specific model overrides are configured. The ring is
 * dormant (muted) when overrides exist but do not apply to the effective agent.
 *
 * The effective agent falls back to the project default when the ticket has no
 * explicit agent set. Returns null when no effective agent can be resolved.
 */
export const TicketCardAgentBadge = React.memo(
  ({ ticket }: TicketCardAgentBadgeProps) => {
    const effectiveAgent = ticket.agent ?? ticket.project?.defaultAgent;
    const isAgentInherited = ticket.agent == null;

    const claudeOverriddenStageLabels = React.useMemo(() => {
      return STAGE_MODEL_KEYS
        .filter((key) => ticket[key] != null)
        .map((key) => STAGE_MODEL_LABELS[key]);
    }, [ticket]);
    const codexOverriddenStageLabels = React.useMemo(() => {
      return CODEX_STAGE_MODEL_KEYS
        .filter((key) => ticket[key] != null)
        .map((key) => CODEX_STAGE_MODEL_LABELS[key]);
    }, [ticket]);
    const hasClaudeOverride = claudeOverriddenStageLabels.length > 0;
    const hasCodexOverride = codexOverriddenStageLabels.length > 0;
    const hasModelOverride = hasClaudeOverride || hasCodexOverride;
    const isModelOverrideDormant =
      hasModelOverride &&
      (
        (effectiveAgent !== Agent.CLAUDE && effectiveAgent !== Agent.CODEX) ||
        (effectiveAgent === Agent.CLAUDE && !hasClaudeOverride) ||
        (effectiveAgent === Agent.CODEX && !hasCodexOverride)
      );
    const overriddenStageLabels =
      effectiveAgent === Agent.CODEX
        ? (hasCodexOverride ? codexOverriddenStageLabels : claudeOverriddenStageLabels)
        : (hasClaudeOverride ? claudeOverriddenStageLabels : codexOverriddenStageLabels);

    if (!effectiveAgent) {
      return null;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span data-testid="agent-badge" className="inline-flex shrink-0">
            {hasModelOverride ? (
              <span
                data-testid="custom-models-badge"
                data-dormant={isModelOverrideDormant ? 'true' : 'false'}
                aria-label="Custom models configured"
                className={`inline-flex items-center justify-center rounded-full p-0.5 ${
                  isModelOverrideDormant
                    ? 'ring-1 ring-muted-foreground/40'
                    : 'ring-2 ring-indigo-500 dark:ring-indigo-400 shadow-[0_0_10px_theme(colors.indigo.500/0.5)]'
                }`}
              >
                <AgentIcon agent={effectiveAgent} size={16} />
              </span>
            ) : (
              <AgentIcon agent={effectiveAgent} size={16} />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="font-medium">
            {getAgentLabel(effectiveAgent)}{isAgentInherited ? ' (default)' : ''}
          </div>
          {hasModelOverride && (
            <div className="text-[11px] opacity-90 mt-0.5">
              {`Custom models: ${overriddenStageLabels.join(', ')}`}
              {isModelOverrideDormant ? ' (inactive — agent is not Claude)' : ''}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }
);

TicketCardAgentBadge.displayName = 'TicketCardAgentBadge';
