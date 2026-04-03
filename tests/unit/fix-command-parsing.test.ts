/**
 * Unit Test: /fix Command Argument Parsing
 *
 * Validates the /fix command file contains correct argument parsing instructions
 * and the autocomplete registration is properly configured.
 * The actual parsing is performed by the Claude agent at runtime following
 * the instructions in the command file.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  AI_BOARD_COMMANDS,
  filterCommands,
} from '@/app/lib/data/ai-board-commands';

const COMMAND_FILE_PATH = resolve(
  process.cwd(),
  '.claude-plugin/commands/ai-board.fix.md'
);
const commandContent = readFileSync(COMMAND_FILE_PATH, 'utf-8');

describe('/fix command argument parsing specification', () => {
  it('should document PR number as first argument', () => {
    expect(commandContent).toContain('PR number');
    expect(commandContent).toContain('first token');
  });

  it('should document "all" keyword handling', () => {
    expect(commandContent).toContain('"all" keyword');
    expect(commandContent).toContain('fix all pertinent findings');
  });

  it('should document space-separated finding numbers', () => {
    expect(commandContent).toContain('Space-separated numbers');
    expect(commandContent).toContain('1 3 5');
  });

  it('should document no-args behavior as fix all', () => {
    expect(commandContent).toContain('No remaining tokens');
    expect(commandContent).toContain('Fix all pertinent findings');
  });

  it('should document invalid token handling', () => {
    expect(commandContent).toContain('Invalid tokens');
    expect(commandContent).toContain('non-numeric');
  });

  it('should document three invocation forms', () => {
    // No args (fix all), specific numbers (e.g., 1 3 5), and "all" keyword
    expect(commandContent).toContain('No remaining tokens');
    expect(commandContent).toContain('1 3 5');
    expect(commandContent).toContain('`all` keyword');
  });
});

describe('/fix command autocomplete registration', () => {
  it('should be registered in AI_BOARD_COMMANDS', () => {
    const fixCmd = AI_BOARD_COMMANDS.find((cmd) => cmd.name === '/fix');
    expect(fixCmd).toBeDefined();
    expect(fixCmd?.description).toBe(
      'Fix PR review findings from code review'
    );
  });

  it('should be findable via filter with "fix" query', () => {
    const result = filterCommands('fix');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((cmd) => cmd.name === '/fix')).toBe(true);
  });

  it('should be findable via filter with "review findings" query', () => {
    const result = filterCommands('review findings');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((cmd) => cmd.name === '/fix')).toBe(true);
  });

  it('should have description within 60 character limit', () => {
    const fixCmd = AI_BOARD_COMMANDS.find((cmd) => cmd.name === '/fix');
    expect(fixCmd).toBeDefined();
    expect(fixCmd!.description.length).toBeLessThanOrEqual(60);
  });
});
