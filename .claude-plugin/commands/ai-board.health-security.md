# Health Scan: Security

You are executing a **security health scan** on this repository. Analyze the codebase for security vulnerabilities and produce a structured JSON report.

## Arguments

Arguments are passed inline after the command name:
- `--base-commit <SHA>`: Optional. If provided, run an **incremental scan** — use `git diff <base-commit>..HEAD` to identify changed files and limit analysis to those files only.
- `--head-commit <SHA>`: Optional. The target commit reference.

If `--base-commit` is **not provided or empty**, perform a **full repository scan** of all source files.

**Edge case — base-commit not found**: If the provided `--base-commit` SHA does not exist in the repository (git rev-parse fails), **fall back to a full repository scan** and include a note in the report summary: "baseCommit not found, performed full scan".

**Edge case — empty repository**: If the repository has no analyzable source files, return score 100 with an empty issues array and summary: "No analyzable code found".

## What to Scan

Analyze the codebase for **all** of the following security categories:

- **Injection**: SQL injection, XSS (cross-site scripting), command injection, template injection, path traversal
- **Authentication/Authorization**: Hardcoded credentials, weak auth patterns, missing auth checks, privilege escalation paths, broken access control
- **Exposed Secrets**: API keys, tokens, passwords, private keys in code or config files
- **Vulnerable Dependencies**: Known vulnerable packages in package.json/lock files, outdated dependencies with CVEs
- **OWASP Top 10**: Full coverage of current OWASP Top 10 categories
- **Input Validation**: Missing or insufficient input validation, improper sanitization, type coercion vulnerabilities
- **Error Message Information Leakage**: Stack traces exposed to users, verbose error messages revealing internal details, debug information in production paths
- **Misconfiguration**: Insecure defaults, debug modes enabled, permissive CORS, missing security headers
- **Cryptography**: Weak algorithms, insecure random number generation, missing encryption where required

For each issue found, determine the severity:
- **high**: Directly exploitable vulnerability, immediate risk (e.g., SQL injection, exposed credentials)
- **medium**: Potential risk requiring specific conditions to exploit (e.g., missing CSRF protection, weak crypto)
- **low**: Best practice violation, minimal direct risk (e.g., verbose error messages, missing security headers)

## Score Calculation

Calculate the score using this formula:

```
score = 100 - (high_count * 15 + medium_count * 5 + low_count * 1)
```

Floor the result at **0** (score can never be negative).

## Output Format

You **MUST** output **ONLY** valid JSON to stdout. No other text, logs, markdown formatting, or code fences.

The JSON object must have this **exact** structure:

```json
{
  "score": 85,
  "issuesFound": 3,
  "issuesFixed": 0,
  "report": {
    "issues": [
      {
        "severity": "high",
        "file": "path/to/file.ts",
        "line": 42,
        "description": "SQL injection vulnerability in query builder — use parameterized queries instead",
        "category": "injection"
      }
    ],
    "summary": "Found 1 high, 1 medium, 1 low security issue. Key concern: SQL injection in query builder."
  },
  "tokensUsed": 0,
  "costUsd": 0
}
```

### Field Requirements

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `score` | `number` | Yes | 0-100 integer, calculated per formula above |
| `issuesFound` | `number` | Yes | Must equal `report.issues.length` |
| `issuesFixed` | `number` | Yes | Always `0` for security scans |
| `report.issues` | `array` | Yes | List of SecurityIssue objects |
| `report.issues[].severity` | `string` | Yes | `"high"`, `"medium"`, or `"low"` (lowercase) |
| `report.issues[].file` | `string` | Yes | File path relative to repository root |
| `report.issues[].line` | `number` | Yes | Positive integer line number |
| `report.issues[].description` | `string` | Yes | What the vulnerability is and how to fix it |
| `report.issues[].category` | `string` | Yes | Category (e.g., "injection", "authentication", "secrets", "dependencies", "input-validation", "error-leakage", "misconfiguration", "cryptography") |
| `report.summary` | `string` | Yes | Brief summary of findings with severity counts |
| `tokensUsed` | `number` | Yes | Tokens consumed (0 if unknown) |
| `costUsd` | `number` | Yes | Cost in USD (0 if unknown) |

**CRITICAL**: Output ONLY the JSON object. No explanatory text before or after.
