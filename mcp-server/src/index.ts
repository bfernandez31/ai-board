#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

/**
 * Main entry point for the MCP server.
 * Loads configuration from ~/.aiboard/config.json and starts the server.
 */
async function main(): Promise<void> {
  try {
    const config = loadConfig();
    const server = createServer(config);
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    // Log error to stderr (not stdout, which is reserved for MCP protocol)
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to start MCP server: ${message}`);
    process.exit(1);
  }
}

main();
