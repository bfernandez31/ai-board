# Health Scan: Security

You are executing a **security health scan** on this repository. Analyze the codebase for security vulnerabilities and produce a structured JSON report.

## Inputs

Arguments may include:
- `--base-commit <SHA>`: If provided, only scan changes between this commit and head-commit (incremental scan)
- `--head-commit <SHA>`: The target commit to scan up to

If `--base-commit` is empty or not provided, perform a **full repository scan**.

## Incremental Scan (when --base-commit is provided)

When `--base-commit` is provided, only analyze files changed since that commit:

1. Get the list of changed files: `git diff --name-only <base-commit>..<head-commit>`
   - If `--head-commit` is not provided, use `HEAD` as the target
2. Only analyze files from this list (skip deleted files)
3. If `--base-commit` refers to a commit that doesn't exist, report an error issue and fall back to full scan

## What to Scan

Analyze the codebase for OWASP Top 10 and common security issues:

### Injection (A03:2021)
- **SQL injection**: Raw SQL queries with string concatenation or template literals, unsanitized user input in queries
- **Command injection**: `exec()`, `spawn()`, `execSync()` with unsanitized input, shell command construction from user data
- **XSS**: Unescaped user input in HTML output, `dangerouslySetInnerHTML` with user data, missing output encoding
- **Template injection**: User input in template strings sent to rendering engines

### Authentication & Session (A07:2021)
- **Hardcoded credentials**: Passwords, API keys, tokens, secrets directly in source code
- **Weak auth patterns**: Missing password hashing, plain-text password comparison, weak JWT secrets
- **Missing auth checks**: API routes without authentication middleware, unprotected endpoints

### Sensitive Data Exposure (A02:2021)
- **Exposed secrets**: API keys, tokens, private keys in code, config files, or `.env` files committed to git
- **Logging sensitive data**: Passwords, tokens, PII logged to console or files
- **Insecure storage**: Sensitive data in localStorage, cookies without Secure/HttpOnly flags

### Access Control (A01:2021)
- **Missing authorization**: Endpoints checking auth but not checking permissions/roles
- **IDOR**: Direct object references without ownership verification
- **Privilege escalation**: Ability to access admin functions without admin role

### Misconfiguration (A05:2021)
- **Debug mode**: Debug/development settings in production config
- **Permissive CORS**: `Access-Control-Allow-Origin: *` on sensitive endpoints
- **Insecure defaults**: Default passwords, open admin panels, verbose error messages

### Dependencies (A06:2021)
- **Known vulnerabilities**: Check `package.json` / lock files for packages with known CVEs
- **Outdated packages**: Significantly outdated dependencies with security patches available

### Cryptography (A02:2021)
- **Weak algorithms**: MD5, SHA1 for password hashing, DES/RC4 encryption
- **Insecure random**: `Math.random()` for security-sensitive operations
- **Missing encryption**: Sensitive data transmitted or stored without encryption

## Issue Categories

Each issue MUST include a `category` field with one of these values:
- `injection` — SQL, XSS, command, template injection
- `authentication` — Hardcoded credentials, weak auth, missing auth checks
- `sensitive-data` — Exposed secrets, logged PII, insecure storage
- `access-control` — Missing authorization, IDOR, privilege escalation
- `misconfiguration` — Debug mode, permissive CORS, insecure defaults
- `dependencies` — Known vulnerable packages, outdated dependencies
- `cryptography` — Weak algorithms, insecure random, missing encryption

## Score Calculation

Start at 100 and deduct based on severity:
- **high** severity: -15 points per issue
- **medium** severity: -8 points per issue
- **low** severity: -3 points per issue
- Floor at 0 (score cannot go negative)

Example: 2 high + 1 medium + 3 low = 100 - 30 - 8 - 9 = 53

## Output Format

You MUST output valid JSON to stdout with this exact structure. Output ONLY the JSON object, no other text.

```json
{
  "score": 53,
  "issuesFound": 6,
  "issuesFixed": 0,
  "report": {
    "type": "SECURITY",
    "issues": [
      {
        "id": "sec-001",
        "severity": "high",
        "description": "SQL injection vulnerability in raw query builder",
        "file": "lib/db/queries.ts",
        "line": 42,
        "category": "injection"
      },
      {
        "id": "sec-002",
        "severity": "medium",
        "description": "Missing CSRF token validation on form submission endpoint",
        "file": "app/api/submit/route.ts",
        "line": 10,
        "category": "authentication"
      },
      {
        "id": "sec-003",
        "severity": "low",
        "description": "Debug mode enabled in production config",
        "file": "next.config.js",
        "line": 3,
        "category": "misconfiguration"
      }
    ],
    "generatedTickets": []
  },
  "tokensUsed": 0,
  "costUsd": 0
}
```

**Field rules**:
- `id`: Unique identifier, format `sec-NNN` (e.g., `sec-001`, `sec-002`)
- `severity`: MUST be lowercase: `high`, `medium`, or `low`
- `description`: Actionable description of the vulnerability
- `file`: Relative path from repo root where issue was found
- `line`: Line number in the file (when determinable)
- `category`: One of the 7 categories listed above
- `generatedTickets`: Always `[]` (tickets are created by the workflow after the scan)
- `issuesFound`: Total count of issues in the `issues` array
- `issuesFixed`: Always `0` (security scan does not auto-fix)
