# Authentication Setup Guide

## Environment Variables Configuration

### Development Environment

Copy `.env.example` to `.env.local` and configure the following variables:

```bash
# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<your-generated-secret>"

# GitHub OAuth (Development)
GITHUB_ID="<your-github-oauth-client-id>"
GITHUB_SECRET="<your-github-oauth-client-secret>"
```

### Generate NEXTAUTH_SECRET

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

### GitHub OAuth App Setup

#### Development OAuth App

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Configure:
   - **Application name**: `AI Board (Development)`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Copy the Client ID and generate a new Client Secret
5. Add them to your `.env.local` file

#### Production OAuth App

Repeat the same process with production URLs:
- **Application name**: `AI Board (Production)`
- **Homepage URL**: Your production domain (e.g., `https://your-app.vercel.app`)
- **Authorization callback URL**: `https://your-app.vercel.app/api/auth/callback/github`

### Generated Secrets

**Development Secret** (for `.env.local`):
```
ARsM7huXGvann8kzR27XPybdQ8UnNuJsxBp0MVQrabI=
```

**Production Secret** (for Vercel environment variables):
```
MrCrUTgyr11YPm423asR1tY6JHHthk/W1EfczvPLVMo=
```

⚠️ **Security Note**: These secrets are for documentation purposes. In production, always use secrets generated on secure machines and never commit them to version control.

## Verification

After configuration, verify your setup:

1. Check that all required variables are set:
   ```bash
   cat .env.local
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. The authentication system should be ready for testing once the database migrations are complete.
