# GitHub Repository Secrets Configuration

This document lists all required GitHub Secrets and Variables for the AI Board workflows.

## Required GitHub Secrets

These secrets must be configured in **Settings → Secrets and variables → Actions → Repository secrets**:

### 1. `CLAUDE_CODE_OAUTH_TOKEN`
- **Description**: OAuth token for Claude Code CLI authentication
- **Used in**: All workflows (speckit, quick-impl, verify, ai-board-assist)
- **How to get**:
  1. Visit https://claude.com/settings/oauth
  2. Generate a new OAuth token
  3. Copy the token value
- **Format**: Long alphanumeric token

### 2. `WORKFLOW_API_TOKEN`
- **Description**: Authentication token for GitHub Actions workflows to call API endpoints
- **Used in**: All workflows for API authentication
- **How to generate**:
  ```bash
  openssl rand -hex 32
  ```
- **Format**: 64-character hexadecimal string
- **Note**: Must match the value in Vercel environment variables

### 3. `GITHUB_TOKEN`
- **Description**: GitHub Personal Access Token (Classic) with repo + workflow scopes
- **Used in**: Documentation API tests, workflow dispatch
- **How to create**:
  1. Go to https://github.com/settings/tokens
  2. Generate new token (classic)
  3. Select scopes: `repo` (full), `workflow`
  4. Copy token value
- **Format**: `ghp_...` (classic PAT format)

### 4. `GH_PAT`
- **Description**: GitHub Personal Access Token for PR creation
- **Used in**: verify.yml workflow for creating pull requests
- **How to create**: Same as GITHUB_TOKEN above
- **Format**: `ghp_...` (classic PAT format)
- **Note**: Can be the same token as GITHUB_TOKEN

### 5. `CLOUDINARY_CLOUD_NAME`
- **Description**: Cloudinary cloud name for image storage
- **Used in**: Tests that upload images
- **How to get**:
  1. Sign up at https://cloudinary.com
  2. Find in Dashboard → Account Details → Cloud name
- **Format**: Alphanumeric string (e.g., `dxxxxxx`)

### 6. `CLOUDINARY_API_KEY`
- **Description**: Cloudinary API key
- **Used in**: Image upload functionality
- **How to get**: Found in Cloudinary Dashboard → Account Details
- **Format**: Numeric string

### 7. `CLOUDINARY_API_SECRET`
- **Description**: Cloudinary API secret
- **Used in**: Image upload authentication
- **How to get**: Found in Cloudinary Dashboard → Account Details
- **Format**: Alphanumeric string
- **⚠️ Security**: Never commit this value to the repository

## Required GitHub Variables

These variables must be configured in **Settings → Secrets and variables → Actions → Variables**:

### 1. `APP_URL`
- **Description**: Application URL for API callbacks from workflows
- **Development**: `http://localhost:3000`
- **Production**: Your Vercel deployment URL (e.g., `https://ai-board.vercel.app`)
- **Used in**: All workflows for API endpoint construction

## Verification

To verify all secrets are configured correctly:

1. Go to repository **Settings → Secrets and variables → Actions**
2. Check **Repository secrets** tab - should have 7 secrets
3. Check **Variables** tab - should have 1 variable (APP_URL)

## Security Best Practices

- **Never commit secrets** to the repository
- **Rotate tokens periodically** (every 90 days recommended)
- **Use least privilege** - only grant required scopes
- **Monitor token usage** in GitHub audit logs
- **Revoke compromised tokens** immediately

## Troubleshooting

### Tests fail with "GITHUB_TOKEN not set"
- Verify `GITHUB_TOKEN` secret is configured
- Check token has `repo` and `workflow` scopes
- Ensure token hasn't expired

### Image upload tests fail
- Verify all 3 Cloudinary secrets are configured
- Test credentials in Cloudinary dashboard
- Check API quota hasn't been exceeded

### Workflow dispatch fails
- Verify `WORKFLOW_API_TOKEN` matches value in Vercel
- Check token length is exactly 64 characters
- Ensure token is hexadecimal (0-9, a-f)

## Local Development

For local development, create a `.env` file with the same variables:

```bash
# Copy example file
cp .env.example .env

# Edit .env with your local values
# DO NOT commit .env to git (it's in .gitignore)
```

## CI/CD Pipeline

The `.env.test` file serves as a template for CI/CD workflows:
- Checked into git with placeholder values
- GitHub Secrets are injected at runtime via `setup-test-env.sh`
- Final `.env` file is created before tests run
