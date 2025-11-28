#!/usr/bin/env node
/**
 * Parse Claude Code CLI telemetry output and aggregate metrics
 *
 * Usage: node parse-claude-telemetry.js <telemetry-log-file>
 * Output: JSON with aggregated metrics
 *
 * Expected input format (from OTEL_LOGS_EXPORTER=console):
 * {
 *   body: "claude_code.api_request",
 *   attributes: {
 *     input_tokens: "123",
 *     output_tokens: "456",
 *     ...
 *   }
 * }
 */

const fs = require('fs');

function parseJsObject(content) {
  // Convert JavaScript object notation to JSON
  // Handle: undefined, unquoted keys, trailing commas
  let json = content
    // Remove undefined values
    .replace(/:\s*undefined/g, ': null')
    // Quote unquoted keys (keys followed by :)
    .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
    // Remove trailing commas before } or ]
    .replace(/,(\s*[}\]])/g, '$1');

  try {
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function extractEvents(logContent) {
  const events = [];

  // Split by opening braces at the start of lines to find event objects
  // The telemetry output has objects separated by newlines
  const objectMatches = logContent.match(/\{[\s\S]*?^\}/gm);

  if (!objectMatches) {
    // Try alternative: split by resource blocks
    const blocks = logContent.split(/(?=\{\s*resource:)/);
    for (const block of blocks) {
      if (block.trim()) {
        const parsed = parseJsObject(block.trim());
        if (parsed && parsed.body) {
          events.push(parsed);
        }
      }
    }
  } else {
    for (const match of objectMatches) {
      const parsed = parseJsObject(match);
      if (parsed && parsed.body) {
        events.push(parsed);
      }
    }
  }

  return events;
}

function aggregateMetrics(events) {
  const metrics = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    costUsd: 0,
    durationMs: 0,
    model: null,
    toolsUsed: new Set(),
    apiRequestCount: 0,
    toolResultCount: 0,
  };

  for (const event of events) {
    const attrs = event.attributes || {};

    if (event.body === 'claude_code.api_request') {
      metrics.apiRequestCount++;
      metrics.inputTokens += parseInt(attrs.input_tokens || '0', 10);
      metrics.outputTokens += parseInt(attrs.output_tokens || '0', 10);
      metrics.cacheReadTokens += parseInt(attrs.cache_read_tokens || '0', 10);
      metrics.cacheCreationTokens += parseInt(attrs.cache_creation_tokens || '0', 10);
      metrics.costUsd += parseFloat(attrs.cost_usd || '0');
      metrics.durationMs += parseInt(attrs.duration_ms || '0', 10);

      // Keep track of the primary model (use the most recent one)
      if (attrs.model) {
        metrics.model = attrs.model;
      }
    }

    if (event.body === 'claude_code.tool_result') {
      metrics.toolResultCount++;
      if (attrs.tool_name) {
        metrics.toolsUsed.add(attrs.tool_name);
      }
    }

    // Also capture tools from tool_decision events
    if (event.body === 'claude_code.tool_decision') {
      if (attrs.tool_name) {
        metrics.toolsUsed.add(attrs.tool_name);
      }
    }
  }

  // Convert Set to Array for JSON serialization
  return {
    inputTokens: metrics.inputTokens,
    outputTokens: metrics.outputTokens,
    cacheReadTokens: metrics.cacheReadTokens,
    cacheCreationTokens: metrics.cacheCreationTokens,
    costUsd: Math.round(metrics.costUsd * 1000000) / 1000000, // Round to 6 decimal places
    durationMs: metrics.durationMs,
    model: metrics.model,
    toolsUsed: Array.from(metrics.toolsUsed).sort(),
    _meta: {
      apiRequestCount: metrics.apiRequestCount,
      toolResultCount: metrics.toolResultCount,
      eventsProcessed: events.length,
    }
  };
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node parse-claude-telemetry.js <telemetry-log-file>');
    console.error('       cat telemetry.log | node parse-claude-telemetry.js -');
    process.exit(1);
  }

  let logContent;

  if (args[0] === '-') {
    // Read from stdin
    logContent = fs.readFileSync(0, 'utf-8');
  } else {
    // Read from file
    const logFile = args[0];
    if (!fs.existsSync(logFile)) {
      console.error(`Error: File not found: ${logFile}`);
      process.exit(1);
    }
    logContent = fs.readFileSync(logFile, 'utf-8');
  }

  const events = extractEvents(logContent);
  const metrics = aggregateMetrics(events);

  console.log(JSON.stringify(metrics, null, 2));
}

main();
