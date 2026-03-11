import { z } from 'zod';

/**
 * OTLP Log Record schema (simplified for Claude Code telemetry)
 *
 * Per OTLP JSON spec (protobuf JSON mapping), 64-bit integers (int64) are encoded
 * as decimal strings for precision, but implementations must accept both numbers
 * and strings when decoding. Claude Code may send either format.
 *
 * @see https://opentelemetry.io/docs/specs/otlp/
 * @see https://protobuf.dev/programming-guides/json/
 */

/**
 * Schema for int64 fields that accept both string and number formats
 */
const int64Schema = z.union([z.string(), z.number()]);

export const otlpAttributeSchema = z.object({
  key: z.string(),
  value: z.object({
    stringValue: z.string().optional(),
    intValue: int64Schema.optional(),
    doubleValue: z.number().optional(),
    boolValue: z.boolean().optional(),
    arrayValue: z.object({
      values: z.array(z.unknown()).optional(),
    }).optional(),
  }),
});

export const otlpLogRecordSchema = z.object({
  timeUnixNano: int64Schema.optional(),
  observedTimeUnixNano: int64Schema.optional(),
  severityNumber: z.number().optional(),
  severityText: z.string().optional(),
  body: z.object({
    stringValue: z.string().optional(),
  }).nullable().optional(),
  attributes: z.array(otlpAttributeSchema).optional(),
  droppedAttributesCount: z.number().optional(),
  flags: z.number().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  eventName: z.string().optional(),
});

export const otlpScopeLogsSchema = z.object({
  scope: z.object({
    name: z.string().optional(),
    version: z.string().optional(),
    attributes: z.array(otlpAttributeSchema).optional(),
    droppedAttributesCount: z.number().optional(),
  }).optional(),
  logRecords: z.array(otlpLogRecordSchema).optional(),
});

export const otlpResourceLogsSchema = z.object({
  resource: z.object({
    attributes: z.array(otlpAttributeSchema).optional(),
    droppedAttributesCount: z.number().optional(),
    entityRefs: z.array(z.unknown()).optional(),
  }).optional(),
  scopeLogs: z.array(otlpScopeLogsSchema).optional(),
});

export const otlpLogsSchema = z.object({
  resourceLogs: z.array(otlpResourceLogsSchema),
});

export type OTLPAttribute = z.infer<typeof otlpAttributeSchema>;
export type OTLPLogRecord = z.infer<typeof otlpLogRecordSchema>;
export type OTLPScopeLogs = z.infer<typeof otlpScopeLogsSchema>;
export type OTLPResourceLogs = z.infer<typeof otlpResourceLogsSchema>;
export type OTLPLogs = z.infer<typeof otlpLogsSchema>;

/**
 * Extract value from OTLP attribute
 */
export function getAttributeValue(attr: OTLPAttribute): string | number | boolean | undefined {
  const { stringValue, intValue, doubleValue, boolValue } = attr.value;
  if (stringValue !== undefined) return stringValue;
  if (intValue !== undefined) return intValue;
  if (doubleValue !== undefined) return doubleValue;
  if (boolValue !== undefined) return boolValue;
  return undefined;
}

/**
 * Find attribute by key in array
 */
export function findAttribute(
  attributes: OTLPAttribute[] | undefined,
  key: string
): string | number | boolean | undefined {
  if (!attributes) return undefined;
  const attr = attributes.find(a => a.key === key);
  return attr ? getAttributeValue(attr) : undefined;
}

/**
 * Parse attribute value as integer, returning 0 if invalid
 */
export function parseIntAttribute(value: string | number | boolean | undefined): number {
  if (value === undefined) return 0;
  const parsed = parseInt(String(value), 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parse attribute value as float, returning 0 if invalid
 */
export function parseFloatAttribute(value: string | number | boolean | undefined): number {
  if (value === undefined) return 0;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : parsed;
}
