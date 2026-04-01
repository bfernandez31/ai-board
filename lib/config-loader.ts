/**
 * Config file loader for .ai-board/config.yml.
 *
 * Reads, parses YAML, and validates the config file from a target repository.
 */
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { validateConfig } from '@/lib/validations/config';
import type { ValidationResult } from '@/lib/validations/config';

const CONFIG_PATH = '.ai-board/config.yml';

export async function loadConfig(projectDir: string): Promise<ValidationResult> {
  const filePath = join(projectDir, CONFIG_PATH);

  try {
    await access(filePath);
  } catch {
    return {
      success: false,
      errors: [
        {
          path: CONFIG_PATH,
          type: 'missing_required',
          message:
            'Missing .ai-board/config.yml — this file is required for ai-board to operate on your project.',
        },
      ],
      warnings: [],
    };
  }

  const content = await readFile(filePath, 'utf-8');

  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch (err) {
    const message =
      err instanceof Error
        ? `YAML syntax error: ${err.message}. Check indentation and formatting.`
        : 'YAML syntax error. Check indentation and formatting.';
    return {
      success: false,
      errors: [
        {
          path: CONFIG_PATH,
          type: 'invalid_value',
          message,
        },
      ],
      warnings: [],
    };
  }

  if (parsed == null) {
    return validateConfig({});
  }

  return validateConfig(parsed);
}
