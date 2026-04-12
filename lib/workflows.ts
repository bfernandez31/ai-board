import { Agent } from '@prisma/client';

/**
 * Workflow availability by agent
 * Defines which workflow types are supported by each agent
 */
export const AGENT_WORKFLOW_AVAILABILITY: Record<Agent, {
  supportedWorkflowTypes: string[];
  supportsSpeckit: boolean;
  supportsCustomWorkflows: boolean;
}> = {
  [Agent.CLAUDE]: {
    supportedWorkflowTypes: ['SPECKIT', 'CUSTOM', 'ONBOARD', 'RETRO_SPEC'],
    supportsSpeckit: true,
    supportsCustomWorkflows: true,
  },
  [Agent.CODEX]: {
    supportedWorkflowTypes: ['SPECKIT', 'CUSTOM', 'ONBOARD'],
    supportsSpeckit: true,
    supportsCustomWorkflows: true,
  },
  [Agent.MISTRAL]: {
    supportedWorkflowTypes: ['SPECKIT', 'CUSTOM'],
    supportsSpeckit: true,
    supportsCustomWorkflows: true,
  },
  [Agent.GEMINI]: {
    supportedWorkflowTypes: ['SPECKIT', 'CUSTOM'],
    supportsSpeckit: true,
    supportsCustomWorkflows: true,
  },
};

/**
 * Check if an agent supports a specific workflow type
 * @param agent - The agent to check
 * @param workflowType - The workflow type to check
 * @returns True if the agent supports the workflow type
 */
export function isWorkflowAvailable(agent: Agent, workflowType: string): boolean {
  const availability = AGENT_WORKFLOW_AVAILABILITY[agent];
  return availability.supportedWorkflowTypes.includes(workflowType);
}

/**
 * Check if an agent supports speckit workflows
 * @param agent - The agent to check
 * @returns True if the agent supports speckit workflows
 */
export function supportsSpeckit(agent: Agent): boolean {
  return AGENT_WORKFLOW_AVAILABILITY[agent].supportsSpeckit;
}

/**
 * Check if an agent supports custom workflows
 * @param agent - The agent to check
 * @returns True if the agent supports custom workflows
 */
export function supportsCustomWorkflows(agent: Agent): boolean {
  return AGENT_WORKFLOW_AVAILABILITY[agent].supportsCustomWorkflows;
}

/**
 * Get all supported workflow types for an agent
 * @param agent - The agent to check
 * @returns Array of supported workflow type strings
 */
export function getSupportedWorkflowTypes(agent: Agent): string[] {
  return [...AGENT_WORKFLOW_AVAILABILITY[agent].supportedWorkflowTypes];
}

/**
 * Validate that a workflow can be executed with the specified agent
 * @param agent - The agent to validate
 * @param workflowType - The workflow type to validate
 * @returns Validation result with success flag and error message
 */
export function validateWorkflowAvailability(agent: Agent, workflowType: string): {
  isAvailable: boolean;
  error?: string;
} {
  const availability = AGENT_WORKFLOW_AVAILABILITY[agent];
  
  if (!availability.supportedWorkflowTypes.includes(workflowType)) {
    return {
      isAvailable: false,
      error: `Agent ${agent} does not support workflow type ${workflowType}`,
    };
  }
  
  return { isAvailable: true };
}
