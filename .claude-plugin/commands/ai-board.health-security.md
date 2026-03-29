# Health Scan: Security

You are executing a **security health scan** on this repository. Analyze the codebase for security vulnerabilities and produce a structured JSON report.

## Inputs

Arguments may include:
- `--base-commit <SHA>`: If provided, only scan changes between this commit and head-commit (incremental scan)
- `--head-commit <SHA>`: The target commit to scan up to

If `--base-commit` is empty or not provided, perform a **full repository scan**.

## What to Scan

Analyze the codebase for OWASP Top 10 and common security issues:
- **Injection**: SQL injection, command injection, XSS, template injection
- **Authentication**: Hardcoded credentials, weak auth patterns, missing auth checks
- **Sensitive Data**: Exposed secrets, API keys, tokens in code or config
- **Access Control**: Missing authorization checks, privilege escalation paths
- **Misconfiguration**: Insecure defaults, debug modes, permissive CORS
- **Dependencies**: Known vulnerable packages (check package.json/lock files)
- **Cryptography**: Weak algorithms, insecure random, missing encryption

## Output Format

You MUST output valid JSON to stdout with this exact structure:

```json
{
  "score": 85,
  "issuesFound": 3,
  "issuesFixed": 0,
  "report": {
    "issues": [
      {
        "severity": "HIGH",
        "file": "path/to/file.ts",
        "line": 42,
        "description": "SQL injection vulnerability in query builder",
        "category": "injection"
      }
    ],
    "summary": "Brief summary of findings"
  },
  "tokensUsed": 0,
  "costUsd": 0
}
```

- `score`: 0-100 (100 = no issues found)
- `severity`: HIGH, MEDIUM, or LOW
- Output ONLY the JSON object, no other text
