import { test, expect } from '../../../helpers/worker-isolation';

test.describe('Test Data Prefix Pattern Contract', () => {
  // Regex pattern for validation
  const E2E_PREFIX_PATTERN = /^\[e2e\] /;

  test.describe('Prefix Format Validation', () => {
    test('should validate correct [e2e] prefix format', () => {
      // Valid patterns
      expect(E2E_PREFIX_PATTERN.test('[e2e] Fix login bug')).toBe(true);
      expect(E2E_PREFIX_PATTERN.test('[e2e] Add dark mode')).toBe(true);
      expect(E2E_PREFIX_PATTERN.test('[e2e] Test ticket with special chars - test, test? test!')).toBe(true);
    });

    test('should reject invalid prefix patterns', () => {
      // Invalid patterns
      expect(E2E_PREFIX_PATTERN.test('e2e Fix login bug')).toBe(false); // Missing brackets
      expect(E2E_PREFIX_PATTERN.test('[E2E] Fix login bug')).toBe(false); // Wrong case
      expect(E2E_PREFIX_PATTERN.test('[ e2e ] Fix login bug')).toBe(false); // Extra spaces
      expect(E2E_PREFIX_PATTERN.test('Fix login bug [e2e]')).toBe(false); // Suffix
      expect(E2E_PREFIX_PATTERN.test('[test] Fix login bug')).toBe(false); // Different identifier
    });
  });

  test.describe('Title Length Constraints', () => {
    test('should validate ticket title with prefix stays under 200 chars', () => {
      const prefix = '[e2e] ';
      const maxTitleLength = 200;
      const maxActualTitleLength = maxTitleLength - prefix.length;

      // Valid length
      const validTitle = 'A'.repeat(maxActualTitleLength);
      const fullValidTitle = prefix + validTitle;
      expect(fullValidTitle.length).toBe(200);
      expect(fullValidTitle.length).toBeLessThanOrEqual(maxTitleLength);

      // Invalid length
      const tooLongTitle = 'A'.repeat(maxActualTitleLength + 1);
      const fullTooLongTitle = prefix + tooLongTitle;
      expect(fullTooLongTitle.length).toBeGreaterThan(maxTitleLength);
    });

    test('should validate project name with prefix stays under 100 chars', () => {
      const prefix = '[e2e] ';
      const maxNameLength = 100;
      const maxActualNameLength = maxNameLength - prefix.length;

      // Valid length
      const validName = 'A'.repeat(maxActualNameLength);
      const fullValidName = prefix + validName;
      expect(fullValidName.length).toBe(100);
      expect(fullValidName.length).toBeLessThanOrEqual(maxNameLength);

      // Invalid length
      const tooLongName = 'A'.repeat(maxActualNameLength + 1);
      const fullTooLongName = prefix + tooLongName;
      expect(fullTooLongName.length).toBeGreaterThan(maxNameLength);
    });
  });

  test.describe('Prefix Consistency', () => {
    test('should enforce consistent prefix across different entity types', () => {
      const ticketTitle = '[e2e] Test ticket';
      const projectName = '[e2e] Test Project';

      // Both should match the same pattern
      expect(E2E_PREFIX_PATTERN.test(ticketTitle)).toBe(true);
      expect(E2E_PREFIX_PATTERN.test(projectName)).toBe(true);

      // Prefix should be consistent
      const extractPrefix = (text: string) => text.match(/^\[[^\]]+\]\s/)?.[0];
      expect(extractPrefix(ticketTitle)).toBe('[e2e] ');
      expect(extractPrefix(projectName)).toBe('[e2e] ');
    });
  });

  test.describe('Helper Functions', () => {
    function createE2ETicketTitle(actualTitle: string): string {
      const prefix = '[e2e] ';
      const fullTitle = prefix + actualTitle;

      if (fullTitle.length > 200) {
        throw new Error(`Title too long: ${fullTitle.length} chars (max 200)`);
      }

      return fullTitle;
    }

    function createE2EProjectName(actualName: string): string {
      const prefix = '[e2e] ';
      const fullName = prefix + actualName;

      if (fullName.length > 100) {
        throw new Error(`Name too long: ${fullName.length} chars (max 100)`);
      }

      return fullName;
    }

    test('should create valid ticket title with prefix', () => {
      const title = createE2ETicketTitle('Fix login bug');
      expect(title).toBe('[e2e] Fix login bug');
      expect(E2E_PREFIX_PATTERN.test(title)).toBe(true);
    });

    test('should create valid project name with prefix', () => {
      const name = createE2EProjectName('Test Project');
      expect(name).toBe('[e2e] Test Project');
      expect(E2E_PREFIX_PATTERN.test(name)).toBe(true);
    });

    test('should throw error for too long ticket title', () => {
      const longTitle = 'A'.repeat(195); // Would be 201 with prefix
      expect(() => createE2ETicketTitle(longTitle)).toThrow('Title too long');
    });

    test('should throw error for too long project name', () => {
      const longName = 'A'.repeat(95); // Would be 101 with prefix
      expect(() => createE2EProjectName(longName)).toThrow('Name too long');
    });
  });
});
