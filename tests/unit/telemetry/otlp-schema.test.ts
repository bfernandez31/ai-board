import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * OTLP schema validation tests
 *
 * These tests verify that the OTLP schema correctly accepts both string and number
 * formats for 64-bit integer fields as per the OTLP JSON spec (protobuf JSON mapping).
 *
 * @see https://opentelemetry.io/docs/specs/otlp/
 * @see https://protobuf.dev/programming-guides/json/
 */

// Mirror the schema from route.ts for testing
const otlpAttributeSchema = z.object({
  key: z.string(),
  value: z.object({
    stringValue: z.string().optional(),
    intValue: z.union([z.string(), z.number()]).optional(),
    doubleValue: z.number().optional(),
    boolValue: z.boolean().optional(),
    arrayValue: z.object({
      values: z.array(z.unknown()).optional(),
    }).optional(),
  }),
});

const otlpLogRecordSchema = z.object({
  timeUnixNano: z.union([z.string(), z.number()]).optional(),
  observedTimeUnixNano: z.union([z.string(), z.number()]).optional(),
  severityNumber: z.number().optional(),
  severityText: z.string().optional(),
  body: z.object({
    stringValue: z.string().optional(),
  }).optional(),
  attributes: z.array(otlpAttributeSchema).optional(),
  droppedAttributesCount: z.number().optional(),
  flags: z.number().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
});

const otlpScopeLogsSchema = z.object({
  scope: z.object({
    name: z.string().optional(),
    version: z.string().optional(),
  }).optional(),
  logRecords: z.array(otlpLogRecordSchema).optional(),
});

const otlpResourceLogsSchema = z.object({
  resource: z.object({
    attributes: z.array(otlpAttributeSchema).optional(),
  }).optional(),
  scopeLogs: z.array(otlpScopeLogsSchema).optional(),
});

const otlpLogsSchema = z.object({
  resourceLogs: z.array(otlpResourceLogsSchema),
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
      // Large 64-bit integers should be strings to avoid precision loss
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
  });
});
