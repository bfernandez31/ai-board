import { describe, it, expect } from 'vitest';
import { otlpLogsSchema } from '@/lib/schemas/otlp';
import {
  API_REQUEST_EVENTS,
  TOOL_EVENTS,
} from '@/app/api/telemetry/v1/logs/events';

describe('Multi-agent telemetry event constants', () => {
  describe('API_REQUEST_EVENTS', () => {
    it('should include claude_code.api_request', () => {
      expect(API_REQUEST_EVENTS).toContain('claude_code.api_request');
    });

    it('should include codex.api_request', () => {
      expect(API_REQUEST_EVENTS).toContain('codex.api_request');
    });
  });

  describe('TOOL_EVENTS', () => {
    it('should include claude_code.tool_result', () => {
      expect(TOOL_EVENTS).toContain('claude_code.tool_result');
    });

    it('should include claude_code.tool_decision', () => {
      expect(TOOL_EVENTS).toContain('claude_code.tool_decision');
    });

    it('should include codex.tool.call', () => {
      expect(TOOL_EVENTS).toContain('codex.tool.call');
    });
  });
});

describe('Codex OTLP schema validation', () => {
  it('should accept Codex api_request telemetry payload', () => {
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
              { key: 'cost_usd', value: { stringValue: '0.08' } },
              { key: 'model', value: { stringValue: 'o3-mini' } },
            ],
          }],
        }],
      }],
    };

    const result = otlpLogsSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('should accept Codex tool.call telemetry payload', () => {
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

  it('should accept mixed Claude and Codex events in same payload', () => {
    const payload = {
      resourceLogs: [
        {
          resource: {
            attributes: [
              { key: 'job_id', value: { stringValue: '789' } },
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeLogs: [{
            logRecords: [{
              body: { stringValue: 'claude_code.api_request' },
              attributes: [
                { key: 'input_tokens', value: { intValue: '1000' } },
                { key: 'output_tokens', value: { intValue: '500' } },
                { key: 'cost_usd', value: { stringValue: '0.05' } },
              ],
            }],
          }],
        },
        {
          resource: {
            attributes: [
              { key: 'job_id', value: { stringValue: '789' } },
              { key: 'service.name', value: { stringValue: 'codex' } },
            ],
          },
          scopeLogs: [{
            logRecords: [{
              body: { stringValue: 'codex.api_request' },
              attributes: [
                { key: 'input_tokens', value: { intValue: '2000' } },
                { key: 'output_tokens', value: { intValue: '800' } },
                { key: 'cost_usd', value: { stringValue: '0.08' } },
              ],
            }],
          }],
        },
      ],
    };

    const result = otlpLogsSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
