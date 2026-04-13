# Telemetry API Contract: Gemini OTLP Extension

This document specifies the OTLP log record format expected from Gemini CLI.

## `POST /api/telemetry/v1/logs`

### Log Record: `gemini_cli.api_response`

Sent when an API request to Gemini completes.

**Attributes**:
- `gemini_cli.usage.input_tokens` (int): Tokens in prompt (excluding cached).
- `gemini_cli.usage.output_tokens` (int): Tokens in completion.
- `gemini_cli.usage.thinking_tokens` (int): Tokens used for reasoning.
- `gemini_cli.usage.cache_read_tokens` (int): Tokens retrieved from cache.
- `gemini_cli.usage.cache_creation_tokens` (int): Tokens written to cache.
- `gemini_cli.model` (string): Model identifier (e.g., "gemini-2.5-pro").
- `gemini_cli.duration_ms` (int): Total request duration.

### Log Record: `gemini_cli.tool_call`

Sent whenever a tool is invoked by Gemini.

**Attributes**:
- `gemini_cli.tool_name` (string): Name of the tool.

### Resource Attributes

The following attributes MUST be present at the resource level:
- `job_id` (string): The database ID of the Job.
- `service.name` (string): "gemini-cli".

## Example OTLP Payload

```json
{
  "resourceLogs": [
    {
      "resource": {
        "attributes": [
          { "key": "job_id", "value": { "stringValue": "12345" } },
          { "key": "service.name", "value": { "stringValue": "gemini-cli" } }
        ]
      },
      "scopeLogs": [
        {
          "logRecords": [
            {
              "body": { "stringValue": "gemini_cli.api_response" },
              "attributes": [
                { "key": "gemini_cli.usage.input_tokens", "value": { "intValue": "1500" } },
                { "key": "gemini_cli.usage.output_tokens", "value": { "intValue": "800" } },
                { "key": "gemini_cli.usage.thinking_tokens", "value": { "intValue": "200" } },
                { "key": "gemini_cli.model", "value": { "stringValue": "gemini-2.5-pro" } },
                { "key": "gemini_cli.duration_ms", "value": { "intValue": "3400" } }
              ]
            },
            {
              "body": { "stringValue": "gemini_cli.tool_call" },
              "attributes": [
                { "key": "gemini_cli.tool_name", "value": { "stringValue": "read_file" } }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```
