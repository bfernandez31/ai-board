/**
 * Integration Test: /fix Workflow Routing
 *
 * Validates that the ai-board-assist.yml workflow correctly routes the /fix command,
 * validates the VERIFY stage requirement, and performs PR lookup.
 * Tests verify workflow YAML structure and command file integration.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const WORKFLOW_PATH = resolve(
  process.cwd(),
  '.github/workflows/ai-board-assist.yml'
);
const COMMAND_PATH = resolve(
  process.cwd(),
  '.claude-plugin/commands/ai-board.fix.md'
);

const workflowContent = readFileSync(WORKFLOW_PATH, 'utf-8');

describe('/fix workflow routing', () => {
  it('should have /fix command routing block in workflow', () => {
    expect(workflowContent).toContain('grep -qE "/fix\\b"');
  });

  it('should route to ai-board.fix command', () => {
    expect(workflowContent).toContain('"ai-board.fix"');
  });

  it('should validate VERIFY stage before proceeding', () => {
    // The /fix routing block must check STAGE == "verify"
    const fixBlock = workflowContent.substring(
      workflowContent.indexOf('"/fix\\b"'),
      workflowContent.indexOf('"ai-board.fix"') + 100
    );
    expect(fixBlock).toContain('STAGE');
    expect(fixBlock).toContain('verify');
  });

  it('should look up PR number via gh pr list', () => {
    expect(workflowContent).toContain(
      'gh pr list --head "$BRANCH" --json number --jq'
    );
  });

  it('should extract arguments after /fix', () => {
    expect(workflowContent).toContain(
      "sed -n 's/.*\\/fix[[:space:]]*\\(.*\\)/\\1/p'"
    );
  });

  it('should pass PR_NUMBER and ARGS to run-agent.sh', () => {
    expect(workflowContent).toContain('"$PR_NUMBER $ARGS"');
  });

  it('should post error when stage is not VERIFY', () => {
    expect(workflowContent).toContain(
      '/fix command is only available in VERIFY stage'
    );
  });

  it('should post error when no PR found', () => {
    expect(workflowContent).toContain('No PR found for branch');
  });

  it('should appear after /review routing and before else fallback', () => {
    const reviewIndex = workflowContent.indexOf('"/review\\b"');
    const fixIndex = workflowContent.indexOf('"/fix\\b"');
    const elseIndex = workflowContent.indexOf(
      'Using ai-board.assist for general request'
    );

    expect(reviewIndex).toBeLessThan(fixIndex);
    expect(fixIndex).toBeLessThan(elseIndex);
  });
});

describe('/fix command file integration', () => {
  it('should have command file at expected path', () => {
    expect(existsSync(COMMAND_PATH)).toBe(true);
  });

  it('should have valid frontmatter', () => {
    const content = readFileSync(COMMAND_PATH, 'utf-8');
    expect(content).toMatch(/^---\n/);
    expect(content).toContain('command:');
    expect(content).toContain('category:');
    expect(content).toContain('purpose:');
  });

  it('should reference $ARGUMENTS for input', () => {
    const content = readFileSync(COMMAND_PATH, 'utf-8');
    expect(content).toContain('$ARGUMENTS');
  });

  it('should reference required environment variables', () => {
    const content = readFileSync(COMMAND_PATH, 'utf-8');
    expect(content).toContain('TICKET_ID');
    expect(content).toContain('BRANCH');
    expect(content).toContain('STAGE');
    expect(content).toContain('USER_ID');
    expect(content).toContain('USER');
    expect(content).toContain('PROJECT_ID');
  });

  it('should specify result file path format', () => {
    const content = readFileSync(COMMAND_PATH, 'utf-8');
    expect(content).toContain('specs/$BRANCH/.ai-board-result.md');
  });
});
