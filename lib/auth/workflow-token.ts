import { timingSafeEqual } from "node:crypto"

export const TEST_WORKFLOW_TOKEN = "test-workflow-token-for-e2e-tests-only"

function isTokenMatch(token: string, expectedToken: string): boolean {
  return (
    token.length === expectedToken.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))
  )
}

export function isWorkflowTokenTestContext(): boolean {
  return (
    process.env.TEST_MODE === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.VITEST_INTEGRATION === "1"
  )
}

export function getAcceptedWorkflowTokens(): string[] {
  const tokens = new Set<string>()

  if (process.env.WORKFLOW_API_TOKEN) {
    tokens.add(process.env.WORKFLOW_API_TOKEN)
  }

  if (isWorkflowTokenTestContext()) {
    tokens.add(TEST_WORKFLOW_TOKEN)
  }

  return [...tokens]
}

export function isAcceptedWorkflowToken(
  token: string,
  expectedTokens: string[] = getAcceptedWorkflowTokens()
): boolean {
  return expectedTokens.some((expectedToken) => isTokenMatch(token, expectedToken))
}

export function getWorkflowToken(): string {
  return process.env.WORKFLOW_API_TOKEN || TEST_WORKFLOW_TOKEN
}
