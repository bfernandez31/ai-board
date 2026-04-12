# Gemini Workflow Dispatch Specification

## Overview

This document defines the workflow dispatch process for Gemini CLI integration, including environment setup, execution flow, and error handling.

## Workflow Definition

### Input Parameters

```typescript
interface GeminiWorkflowInput {
  workflowName: 'speckit.yml' | 'quick-impl.yml' | 'iterate.yml';
  ticketId: string;
  projectId: string;
  agent: 'GEMINI';
  credentials: {
    apiKey?: string;
    oauthToken?: string;
  };
  environment: Record<string, string>;
}
```

### Phases

#### Phase 1: Validation

**Purpose**: Validate workflow compatibility and credentials

**Steps**:
1. Verify workflow is in Gemini's supported list
2. Validate credentials are present and in VALID state
3. Check user has permission to dispatch workflow
4. Validate ticket and project exist

**Success Criteria**:
- All validations pass
- No errors thrown

**Error Handling**:
- `WORKFLOW_NOT_SUPPORTED`: If workflow not in supported list
- `INVALID_CREDENTIALS`: If credentials missing or invalid
- `PERMISSION_DENIED`: If user lacks permissions

#### Phase 2: Environment Setup

**Purpose**: Prepare execution environment

**Steps**:
1. Create temporary directory for workflow
2. Copy workflow files to temporary directory
3. Set up environment variables:
   - `GEMINI_API_KEY` or `GEMINI_OAUTH_TOKEN`
   - `GEMINI_TELEMETRY_ENDPOINT`
   - `GEMINI_TELEMETRY_INTERVAL=60s`
   - `GEMINI_MODEL=gemini-1.5-pro`
4. Initialize telemetry collector

**Success Criteria**:
- Environment variables set correctly
- Telemetry collector initialized
- Temporary directory created

**Error Handling**:
- `ENVIRONMENT_SETUP_FAILED`: If environment setup fails
- `TELEMETRY_INIT_FAILED`: If telemetry initialization fails

#### Phase 3: Gemini CLI Execution

**Purpose**: Execute workflow using Gemini CLI

**Steps**:
1. Check Gemini CLI installation
2. Install if not present: `npm install -g @google/gemini-cli@latest`
3. Execute workflow in headless mode:
   ```bash
   gemini run --headless --no-interactive --workflow "$WORKFLOW_FILE"
   ```
4. Monitor execution for completion
5. Capture stdout and stderr

**Success Criteria**:
- Gemini CLI executes successfully
- Exit code 0
- Workflow completes without errors

**Error Handling**:
- `CLI_INSTALLATION_FAILED`: If CLI installation fails
- `EXECUTION_FAILED`: If workflow execution fails
- `TIMEOUT`: If execution exceeds timeout (30 minutes)

#### Phase 4: Telemetry Collection

**Purpose**: Collect and process telemetry events

**Steps**:
1. Listen for OTLP events on configured endpoint
2. Parse gemini_cli.api_response events
3. Parse gemini_cli.tool_call events
4. Store events in database
5. Update job metrics

**Success Criteria**:
- All telemetry events processed
- Job metrics updated
- No events lost

**Error Handling**:
- `TELEMETRY_PARSING_FAILED`: If event parsing fails
- `DATABASE_ERROR`: If event storage fails

#### Phase 5: Cleanup

**Purpose**: Clean up resources and finalize job

**Steps**:
1. Remove temporary directory
2. Update job status
3. Calculate final metrics
4. Send completion notification
5. Archive logs

**Success Criteria**:
- Resources cleaned up
- Job status finalized
- Notifications sent

**Error Handling**:
- `CLEANUP_FAILED`: If resource cleanup fails
- `JOB_UPDATE_FAILED`: If job status update fails

## Command Specification

### run-agent.sh Gemini Case

**Location**: `/scripts/run-agent.sh`

**Implementation**:
```bash
case "$AGENT" in
  GEMINI)
    # Phase 1: Validation
    if [[ ! " ${GEMINI_SUPPORTED_WORKFLOWS[@]} " =~ " ${WORKFLOW_NAME} " ]]; then
      echo "Error: Workflow $WORKFLOW_NAME not supported by Gemini"
      exit 1
    fi
    
    # Phase 2: Environment Setup
    WORKFLOW_DIR=$(mktemp -d)
    cp "$WORKFLOW_FILE" "$WORKFLOW_DIR/"
    
    # Set environment variables
    export GEMINI_API_KEY="$GEMINI_API_KEY"
    export GEMINI_OAUTH_TOKEN="$GEMINI_OAUTH_TOKEN"
    export GEMINI_TELEMETRY_ENDPOINT="$TELEMETRY_ENDPOINT"
    export GEMINI_TELEMETRY_INTERVAL="60s"
    export GEMINI_MODEL="gemini-1.5-pro"
    
    # Phase 3: CLI Execution
    if ! command -v gemini &> /dev/null; then
      echo "Installing Gemini CLI..."
      npm install -g @google/gemini-cli@latest
    fi
    
    # Execute with timeout
    timeout 1800 gemini run --headless --no-interactive --workflow "$WORKFLOW_DIR/workflow.yml" \
      --telemetry-endpoint "$GEMINI_TELEMETRY_ENDPOINT" \
      --telemetry-interval "$GEMINI_TELEMETRY_INTERVAL" \
      --model "$GEMINI_MODEL"
    
    EXIT_CODE=$?
    
    # Phase 4: Telemetry Collection (handled by separate process)
    # Phase 5: Cleanup
    rm -rf "$WORKFLOW_DIR"
    
    if [ $EXIT_CODE -ne 0 ]; then
      echo "Gemini workflow failed with exit code $EXIT_CODE"
      exit $EXIT_CODE
    fi
    ;;
```

### Environment Variables

**Required**:
- `GEMINI_API_KEY` or `GEMINI_OAUTH_TOKEN`: Google credentials
- `GEMINI_TELEMETRY_ENDPOINT`: OTLP endpoint URL
- `GEMINI_TELEMETRY_INTERVAL`: Telemetry batch interval
- `GEMINI_MODEL`: Model to use

**Optional**:
- `GEMINI_TIMEOUT`: Execution timeout (default: 1800s)
- `GEMINI_VERBOSE`: Enable verbose logging
- `GEMINI_DEBUG`: Enable debug mode

## Callback Specification

### Status Updates

**Format**: WebSocket messages

**Message Types**:

#### Status Update
```json
{
  "type": "status_update",
  "dispatchId": "dispatch_abc123",
  "status": "RUNNING",
  "phase": "environment_setup",
  "progress": 0.3,
  "timestamp": "2024-07-14T10:45:00Z"
}
```

#### Telemetry Event
```json
{
  "type": "telemetry_event",
  "dispatchId": "dispatch_abc123",
  "jobId": "job_abc123",
  "eventType": "gemini_cli.api_response",
  "payload": {
    "input_token_count": 1500,
    "output_token_count": 800,
    "model": "gemini-1.5-pro"
  }
}
```

#### Completion
```json
{
  "type": "completion",
  "dispatchId": "dispatch_abc123",
  "status": "COMPLETED",
  "metrics": {
    "durationMs": 900000,
    "inputTokens": 15000,
    "outputTokens": 8000,
    "estimatedCost": 0.012
  },
  "timestamp": "2024-07-14T11:00:00Z"
}
```

#### Error
```json
{
  "type": "error",
  "dispatchId": "dispatch_abc123",
  "errorCode": "CLI_INSTALLATION_FAILED",
  "errorMessage": "Failed to install Gemini CLI",
  "details": {
    "exitCode": 1,
    "stderr": "npm ERR! network timeout"
  },
  "timestamp": "2024-07-14T10:40:00Z"
}
```

## Error Handling Strategy

### Error Codes

| Code | Description | Recovery Strategy |
|------|-------------|------------------|
| `WORKFLOW_NOT_SUPPORTED` | Workflow not in supported list | Return error to user |
| `INVALID_CREDENTIALS` | Credentials missing or invalid | Prompt user to update credentials |
| `PERMISSION_DENIED` | User lacks permissions | Return 403 error |
| `ENVIRONMENT_SETUP_FAILED` | Environment setup failed | Retry once, then fail |
| `TELEMETRY_INIT_FAILED` | Telemetry initialization failed | Continue without telemetry, log warning |
| `CLI_INSTALLATION_FAILED` | CLI installation failed | Retry with different method, then fail |
| `EXECUTION_FAILED` | Workflow execution failed | Retry once with same parameters, then fail |
| `TIMEOUT` | Execution exceeded timeout | Fail immediately |
| `TELEMETRY_PARSING_FAILED` | Event parsing failed | Store raw event, continue processing |
| `DATABASE_ERROR` | Database operation failed | Retry with exponential backoff |
| `CLEANUP_FAILED` | Resource cleanup failed | Log warning, continue |
| `JOB_UPDATE_FAILED` | Job status update failed | Retry with exponential backoff |

### Retry Policy

- **Transient Errors**: Retry 3 times with exponential backoff
- **Permanent Errors**: Fail immediately
- **Timeout Errors**: Fail immediately

### Notification Strategy

- **User Notifications**: WebSocket + email for critical failures
- **Admin Notifications**: Email + Slack for system errors
- **Logging**: Structured logs with context for all errors

## Performance Requirements

### Execution Time
- **Environment Setup**: < 5 seconds
- **CLI Installation**: < 30 seconds (cached)
- **Workflow Execution**: < 30 minutes (configurable timeout)
- **Telemetry Processing**: < 1 second per event
- **Cleanup**: < 2 seconds

### Resource Limits
- **Memory**: < 2GB per workflow
- **CPU**: < 2 vCPUs per workflow
- **Disk**: < 1GB temporary storage
- **Network**: < 10Mbps sustained

### Concurrency
- **Max Concurrent Workflows**: 10 per user
- **Max Concurrent Gemini Workflows**: 5 per user
- **Rate Limiting**: 1 dispatch per minute per user

## Monitoring and Metrics

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Dispatch Success Rate | 99% | < 95% for 5 minutes |
| Average Execution Time | < 10 minutes | > 20 minutes for 3 workflows |
| Telemetry Event Loss | 0% | > 1% for 5 minutes |
| CLI Installation Time | < 10 seconds | > 30 seconds for 3 installations |
| Error Rate | < 1% | > 5% for 5 minutes |

### Health Checks

**Endpoint**: `GET /health/workflows`

**Response**:
```json
{
  "status": "healthy",
  "components": {
    "gemini_cli": {
      "status": "healthy",
      "version": "1.2.0",
      "last_used": "2024-07-14T10:50:00Z"
    },
    "telemetry_collector": {
      "status": "healthy",
      "events_processed": 1500,
      "last_event": "2024-07-14T10:55:00Z"
    }
  },
  "metrics": {
    "active_workflows": 3,
    "pending_workflows": 1,
    "error_rate": 0.002
  }
}
```

## Security Considerations

### Credential Handling
- **Storage**: AES-256-GCM encrypted at rest
- **Transmission**: TLS 1.2+ for all network calls
- **Memory**: Zeroized after use
- **Logging**: Never logged in plaintext

### Execution Isolation
- **Sandboxing**: Each workflow runs in isolated temporary directory
- **Permissions**: Minimal required permissions
- **Cleanup**: All temporary files removed after execution

### Input Validation
- **Workflow Files**: Validated against schema
- **Environment Variables**: Sanitized before use
- **API Responses**: Validated with Zod schemas

## Testing Strategy

### Unit Tests
- **Credential Validation**: Test all validation scenarios
- **Workflow Validation**: Test supported/unsupported workflows
- **Environment Setup**: Test variable injection
- **Error Handling**: Test all error codes

### Integration Tests
- **End-to-End Execution**: Test complete workflow lifecycle
- **Telemetry Collection**: Test event processing pipeline
- **Concurrency**: Test multiple simultaneous workflows

### Load Tests
- **Throughput**: 10 concurrent workflows
- **Telemetry Volume**: 1000 events/second
- **Error Recovery**: Inject failures, verify recovery

## Implementation Checklist

- [ ] Add GEMINI case to run-agent.sh
- [ ] Implement validation logic
- [ ] Set up environment variables
- [ ] Add CLI installation check
- [ ] Implement execution with timeout
- [ ] Set up telemetry collection
- [ ] Add cleanup logic
- [ ] Implement error handling
- [ ] Add WebSocket callbacks
- [ ] Set up monitoring
- [ ] Write tests

## References

- **Gemini CLI Documentation**: https://developers.google.com/gemini/cli
- **OTLP Specification**: https://opentelemetry.io/docs/specs/otlp/
- **Bash Best Practices**: https://google.github.io/styleguide/shellguide.html