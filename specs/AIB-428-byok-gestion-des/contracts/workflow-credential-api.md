# API Contract: Workflow Credential Retrieval (Internal)

**Path**: `/api/internal/credentials`
**Auth**: Workflow token only (`Authorization: Bearer ${WORKFLOW_API_TOKEN}`)

This is an internal endpoint called by GitHub Actions workflows to retrieve the decrypted credential for a project's owner. It is NOT accessible to regular users.

---

## GET /api/internal/credentials

Retrieve the decrypted credential for a project owner.

**Query parameters**:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | `string` (numeric) | Yes | Project ID to resolve owner credential |

**Server-side behavior**:
1. Verify workflow token (`verifyWorkflowToken`)
2. Look up project by ID → get `userId` (owner)
3. Find UserCredential for owner with provider = ANTHROPIC
4. If no credential found → return 404 with message
5. Decrypt credential value using AES-256-GCM
6. Return env var name + decrypted value

**Response 200**:
```json
{
  "envVar": "ANTHROPIC_API_KEY",
  "value": "sk-ant-api03-...",
  "credentialType": "API_KEY"
}
```

For OAuth tokens:
```json
{
  "envVar": "CLAUDE_CODE_OAUTH_TOKEN",
  "value": "oauth-token-value...",
  "credentialType": "OAUTH_TOKEN"
}
```

**Response 401**: `{ "error": "Unauthorized" }` (missing/invalid workflow token)
**Response 400**: `{ "error": "projectId is required" }`
**Response 404**: `{ "error": "No AI credential configured for project owner. Please add your Anthropic key in Settings." }`

---

## Workflow Integration

In `.github/workflows/ai-board-assist.yml`, add a step before Claude execution:

```yaml
- name: Fetch owner credential
  id: fetch-credential
  run: |
    RESPONSE=$(curl -sf "${APP_URL}/api/internal/credentials?projectId=${{ inputs.project_id }}" \
      -H "Authorization: Bearer ${WORKFLOW_API_TOKEN}")

    ENV_VAR=$(echo "$RESPONSE" | jq -r '.envVar')
    VALUE=$(echo "$RESPONSE" | jq -r '.value')

    # Export as environment variable (masked in logs)
    echo "::add-mask::${VALUE}"
    echo "${ENV_VAR}=${VALUE}" >> $GITHUB_ENV
  env:
    APP_URL: ${{ vars.APP_URL }}
    WORKFLOW_API_TOKEN: ${{ secrets.WORKFLOW_API_TOKEN }}
```

**Security notes**:
- `::add-mask::` ensures the credential value is masked in all subsequent GitHub Actions log output
- The credential is set via `$GITHUB_ENV`, not as a step output (step outputs are visible in the UI)
- HTTPS-only communication between workflow and app
- Credential is never passed as a workflow dispatch input

---

## Pre-Dispatch Validation

Before dispatching a workflow, the app should check that the project owner has a credential configured. This check happens in the workflow dispatch functions (`dispatch-ai-board.ts`):

```typescript
// Before calling octokit.actions.createWorkflowDispatch():
const credential = await prisma.userCredential.findUnique({
  where: { userId_provider: { userId: project.userId, provider: 'ANTHROPIC' } },
  select: { id: true }
});

if (!credential) {
  throw new Error('No AI credential configured. Please add your Anthropic key in Settings.');
}
```

This provides immediate feedback to the user instead of a delayed workflow failure.
