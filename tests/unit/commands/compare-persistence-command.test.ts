import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('/compare comparison persistence configuration', () => {
  let workflowContent: string;
  let compareCommandContent: string;

  beforeAll(() => {
    workflowContent = readFileSync(
      join(process.cwd(), '.github/workflows/ai-board-assist.yml'),
      'utf-8'
    );
    compareCommandContent = readFileSync(
      join(process.cwd(), '.claude-plugin/commands/ai-board.compare.md'),
      'utf-8'
    );
  });

  it('documents writing comparison-data.json alongside markdown output', () => {
    expect(compareCommandContent).toContain('comparison-data.json');
    expect(compareCommandContent).toContain('same `specs/$BRANCH/comparisons/` directory');
  });

  it('instructs the compare command to continue when JSON writing fails', () => {
    expect(compareCommandContent).toContain('If JSON writing fails, continue successfully');
  });

  it('checks for comparison-data.json in the assist workflow after /compare', () => {
    expect(workflowContent).toContain('COMPARISON_DATA_FILE="specs/$BRANCH/comparisons/comparison-data.json"');
  });

  it('posts comparison-data.json to the ticket comparison persistence endpoint', () => {
    expect(workflowContent).toContain('/api/projects/${{ inputs.project_id }}/tickets/${{ inputs.ticket_id }}/comparisons');
  });

  it('does not fail the workflow when comparison persistence fails', () => {
    expect(workflowContent).toContain('Comparison persistence failed, continuing workflow');
  });
});
