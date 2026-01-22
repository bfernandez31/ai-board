/**
 * Unit Test: AI-BOARD Commands
 *
 * Tests for AI-BOARD command definitions and filtering used in comment autocomplete.
 * Verifies command list contains expected entries and filterCommands works correctly.
 */

import { describe, it, expect } from 'vitest';
import {
  AI_BOARD_COMMANDS,
  filterCommands,
  type AIBoardCommand,
} from '@/app/lib/data/ai-board-commands';

describe('AI_BOARD_COMMANDS', () => {
  it('should be an array of commands', () => {
    expect(Array.isArray(AI_BOARD_COMMANDS)).toBe(true);
    expect(AI_BOARD_COMMANDS.length).toBeGreaterThan(0);
  });

  it('should contain /compare command', () => {
    const compareCmd = AI_BOARD_COMMANDS.find((cmd) => cmd.name === '/compare');
    expect(compareCmd).toBeDefined();
    expect(compareCmd?.description).toBe('Compare ticket implementations for best code quality');
  });

  it('should contain /review command', () => {
    const reviewCmd = AI_BOARD_COMMANDS.find((cmd) => cmd.name === '/review');
    expect(reviewCmd).toBeDefined();
    expect(reviewCmd?.description).toBe('Request code review for the current PR');
  });

  it('should have all commands with name starting with /', () => {
    AI_BOARD_COMMANDS.forEach((cmd: AIBoardCommand) => {
      expect(cmd.name.startsWith('/')).toBe(true);
    });
  });

  it('should have all commands with non-empty descriptions', () => {
    AI_BOARD_COMMANDS.forEach((cmd: AIBoardCommand) => {
      expect(cmd.description).toBeTruthy();
      expect(cmd.description.length).toBeGreaterThan(0);
    });
  });

  it('should have descriptions within 60 character limit', () => {
    AI_BOARD_COMMANDS.forEach((cmd: AIBoardCommand) => {
      expect(cmd.description.length).toBeLessThanOrEqual(60);
    });
  });
});

describe('filterCommands', () => {
  it('should return all commands when query is empty', () => {
    const result = filterCommands('');
    expect(result).toEqual(AI_BOARD_COMMANDS);
  });

  it('should filter by command name', () => {
    const result = filterCommands('review');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('/review');
  });

  it('should filter by partial command name', () => {
    const result = filterCommands('comp');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('/compare');
  });

  it('should filter by description', () => {
    const result = filterCommands('code review');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('/review');
  });

  it('should be case-insensitive', () => {
    const result1 = filterCommands('REVIEW');
    const result2 = filterCommands('review');
    expect(result1).toEqual(result2);
    expect(result1.length).toBe(1);
  });

  it('should return empty array when no matches', () => {
    const result = filterCommands('nonexistentcommand');
    expect(result).toEqual([]);
  });

  it('should match both /compare and /review when searching "co"', () => {
    const result = filterCommands('co');
    expect(result.length).toBe(2);
    expect(result.map((c) => c.name).sort()).toEqual(['/compare', '/review'].sort());
  });
});
