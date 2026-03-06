import { describe, it, expect } from 'vitest';
import {
  otlpAttributeSchema,
  otlpLogRecordSchema,
  otlpLogsSchema,
  API_REQUEST_EVENTS,
  TOOL_EVENTS,
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

describe('OTLP Event Constants', () => {
  it('should include Claude Code API request event', () => {
    expect(API_REQUEST_EVENTS).toContain('claude_code.api_request');
  });

  it('should include Codex API request event', () => {
    expect(API_REQUEST_EVENTS).toContain('codex.api_request');
  });

  it('should include Claude Code tool events', () => {
    expect(TOOL_EVENTS).toContain('claude_code.tool_result');
    expect(TOOL_EVENTS).toContain('claude_code.tool_decision');
  });

  it('should include Codex tool call event', () => {
    expect(TOOL_EVENTS).toContain('codex.tool.call');
  });
});

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

    it('should accept Codex telemetry with codex.api_request event', () => {
      const payload = {
        resourceLogs: [{
          resource: {
            attributes: [
              { key: 'job_id', value: { stringValue: '456' } },
              { key: 'service.name', value: { stringValue: 'codex' } },
            ],
          },
          scopeLogs: [{
            logRecords: [{
              body: { stringValue: 'codex.api_request' },
              attributes: [
                { key: 'input_tokens', value: { intValue: '2000' } },
                { key: 'output_tokens', value: { intValue: '800' } },
                { key: 'cost_usd', value: { stringValue: '0.03' } },
                { key: 'model', value: { stringValue: 'o3' } },
              ],
            }],
          }],
        }],
      };

      const result = otlpLogsSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should accept Codex tool call events', () => {
      const payload = {
        resourceLogs: [{
          resource: {
            attributes: [
              { key: 'job_id', value: { stringValue: '456' } },
              { key: 'service.name', value: { stringValue: 'codex' } },
            ],
          },
          scopeLogs: [{
            logRecords: [{
              body: { stringValue: 'codex.tool.call' },
              attributes: [
                { key: 'tool_name', value: { stringValue: 'shell' } },
              ],
            }],
          }],
        }],
      };

      const result = otlpLogsSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });
});
