import { describe, it, expect } from 'vitest';
import {
  otlpAttributeSchema,
  otlpLogRecordSchema,
  otlpLogsSchema,
} from '@/lib/schemas/otlp';

/**
 * OTLP schema validation tests
 *
 * These tests verify that the OTLP schema correctly accepts both string and number
 * formats for 64-bit integer fields as per the OTLP JSON spec (protobuf JSON mapping).
 *
 * @see https://opentelemetry.io/docs/specs/otlp/
 * @see https://protobuf.dev/programming-guides/json/
 */

describe('OTLP Schema Validation', () => {
  describe('intValue field', () => {
    it('should accept intValue as string (OTLP spec standard)', () => {
      const attribute = {
        key: 'input_tokens',
        value: { intValue: '1000' },
      };

      const result = otlpAttributeSchema.safeParse(attribute);
      expect(result.success).toBe(true);
    });

    it('should accept intValue as number (common format)', () => {
      const attribute = {
        key: 'input_tokens',
        value: { intValue: 1000 },
      };

      const result = otlpAttributeSchema.safeParse(attribute);
      expect(result.success).toBe(true);
    });

    it('should accept large intValue as string', () => {
      const attribute = {
        key: 'large_number',
        value: { intValue: '9007199254740993' },
      };

      const result = otlpAttributeSchema.safeParse(attribute);
      expect(result.success).toBe(true);
    });
  });

  describe('timeUnixNano field', () => {
    it('should accept timeUnixNano as string', () => {
      const logRecord = {
        timeUnixNano: '1705936800000000000',
        body: { stringValue: 'test' },
      };

      const result = otlpLogRecordSchema.safeParse(logRecord);
      expect(result.success).toBe(true);
    });

    it('should accept timeUnixNano as number', () => {
      const logRecord = {
        timeUnixNano: 1705936800000000000,
        body: { stringValue: 'test' },
      };

      const result = otlpLogRecordSchema.safeParse(logRecord);
      expect(result.success).toBe(true);
    });
  });

  describe('full OTLP payload', () => {
    it('should accept Claude Code telemetry with string values (original format)', () => {
      const payload = {
        resourceLogs: [{
          resource: {
            attributes: [
              { key: 'job_id', value: { stringValue: '123' } },
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeLogs: [{
            logRecords: [{
              timeUnixNano: '1705936800000000000',
              body: { stringValue: 'claude_code.api_request' },
              attributes: [
                { key: 'input_tokens', value: { intValue: '1000' } },
                { key: 'output_tokens', value: { intValue: '500' } },
                { key: 'cost_usd', value: { stringValue: '0.05' } },
              ],
            }],
          }],
        }],
      };

      const result = otlpLogsSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should accept Claude Code telemetry with number values (new format)', () => {
      const payload = {
        resourceLogs: [{
          resource: {
            attributes: [
              { key: 'job_id', value: { stringValue: '123' } },
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeLogs: [{
            logRecords: [{
              timeUnixNano: 1705936800000000000,
              body: { stringValue: 'claude_code.api_request' },
              attributes: [
                { key: 'input_tokens', value: { intValue: 1000 } },
                { key: 'output_tokens', value: { intValue: 500 } },
                { key: 'cost_usd', value: { stringValue: '0.05' } },
              ],
            }],
          }],
        }],
      };

      const result = otlpLogsSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should accept mixed string and number values', () => {
      const payload = {
        resourceLogs: [{
          resource: {
            attributes: [
              { key: 'job_id', value: { intValue: 123 } },
            ],
          },
          scopeLogs: [{
            logRecords: [{
              timeUnixNano: '1705936800000000000',
              observedTimeUnixNano: 1705936800000000000,
              severityNumber: 9,
              body: { stringValue: 'claude_code.api_request' },
              attributes: [
                { key: 'input_tokens', value: { intValue: '1000' } },
                { key: 'output_tokens', value: { intValue: 500 } },
                { key: 'cache_read_tokens', value: { intValue: 200 } },
              ],
            }],
          }],
        }],
      };

      const result = otlpLogsSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should accept additional log record fields', () => {
      const payload = {
        resourceLogs: [{
          scopeLogs: [{
            logRecords: [{
              timeUnixNano: 1705936800000000000,
              observedTimeUnixNano: 1705936800000000000,
              severityNumber: 9,
              severityText: 'INFO',
              body: { stringValue: 'claude_code.api_request' },
              droppedAttributesCount: 0,
              flags: 0,
              traceId: 'abc123',
              spanId: 'def456',
            }],
          }],
        }],
      };

      const result = otlpLogsSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should accept boolValue in attributes', () => {
      const attribute = {
        key: 'is_cached',
        value: { boolValue: true },
      };

      const result = otlpAttributeSchema.safeParse(attribute);
      expect(result.success).toBe(true);
    });

    it('should accept doubleValue for floating point numbers', () => {
      const attribute = {
        key: 'cost_usd',
        value: { doubleValue: 0.05 },
      };

      const result = otlpAttributeSchema.safeParse(attribute);
      expect(result.success).toBe(true);
    });

    it('T012: OTLP payload with Codex event names validates successfully', () => {
      const payload = {
        resourceLogs: [{
          resource: {
            attributes: [
              { key: 'job_id', value: { stringValue: '456' } },
              { key: 'service.name', value: { stringValue: 'codex' } },
            ],
          },
          scopeLogs: [{
            logRecords: [
              {
                body: { stringValue: 'codex.api_request' },
                attributes: [
                  { key: 'input_tokens', value: { stringValue: '500' } },
                  { key: 'output_tokens', value: { stringValue: '200' } },
                  { key: 'cost_usd', value: { stringValue: '0.03' } },
                  { key: 'model', value: { stringValue: 'codex-mini-latest' } },
                ],
              },
              {
                body: { stringValue: 'codex.tool.call' },
                attributes: [
                  { key: 'tool_name', value: { stringValue: 'shell' } },
                ],
              },
            ],
          }],
        }],
      };

      const result = otlpLogsSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('T013: OTLP payload with mixed Claude + Codex events validates', () => {
      const payload = {
        resourceLogs: [{
          resource: {
            attributes: [
              { key: 'job_id', value: { stringValue: '789' } },
            ],
          },
          scopeLogs: [{
            logRecords: [
              {
                body: { stringValue: 'claude_code.api_request' },
                attributes: [
                  { key: 'input_tokens', value: { intValue: 1000 } },
                  { key: 'output_tokens', value: { intValue: 500 } },
                ],
              },
              {
                body: { stringValue: 'codex.api_request' },
                attributes: [
                  { key: 'input_tokens', value: { stringValue: '300' } },
                  { key: 'output_tokens', value: { stringValue: '100' } },
                ],
              },
              {
                body: { stringValue: 'claude_code.tool_result' },
                attributes: [
                  { key: 'tool_name', value: { stringValue: 'Read' } },
                ],
              },
              {
                body: { stringValue: 'codex.tool.call' },
                attributes: [
                  { key: 'tool_name', value: { stringValue: 'shell' } },
                ],
              },
            ],
          }],
        }],
      };

      const result = otlpLogsSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });
});
