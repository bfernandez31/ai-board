# AI Board Admin Setup Guide

## Overview

This guide provides instructions for setting up and using the AI Board admin section with Claude Code Insights reports.

## Prerequisites

- Node.js v18+ or Bun runtime
- PostgreSQL database
- Claude API access
- Blob storage account (Azure, AWS S3, or Vercel Blob)

## Installation

### 1. Environment Setup

Copy the example environment file and configure the required variables:

```bash
cp .env.example .env
```

Edit `.env` and set the following admin-specific variables:

```env
# Claude API Configuration
CLAUDE_API_KEY=your_claude_api_key_here

# Blob Storage Configuration
BLOB_STORAGE_CONNECTION_STRING=your_blob_storage_connection_string

# Admin Access Control
ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

### 2. Run the Admin Setup Script

```bash
./scripts/setup-admin.sh
```

This script will:
- Verify all required environment variables are present
- Create necessary directory structure
- Provide next steps for configuration

### 3. Install Dependencies

```bash
bun install
```

### 4. Database Setup

Run Prisma migrations to set up the database schema:

```bash
bunx prisma migrate dev
bunx prisma generate
```

## Usage

### Starting the Development Server

```bash
bun dev
```

The admin section will be available at `http://localhost:3000/admin/insights`

### Accessing Admin Features

1. **View Latest Insights Report**: Navigate to `/admin/insights` to see the most recent Claude Code Insights report
2. **Run New Analysis**: Click "Run new analysis" to trigger a fresh analysis of recent tickets
3. **View Past Reports**: Select from historical reports in the report list
4. **Monitor Job Status**: Check the status of running analysis jobs

## Configuration

### Admin Access Control

Admin access is controlled through the `ADMIN_EMAILS` environment variable. Only users with email addresses listed in this variable (comma-separated) will have access to admin features.

### Claude API Configuration

The `CLAUDE_API_KEY` variable should contain your Claude API key with sufficient permissions to run code analysis.

### Blob Storage Configuration

The `BLOB_STORAGE_CONNECTION_STRING` should point to your blob storage account where analysis reports will be stored.

## API Endpoints

### GET `/api/admin/insights`

Returns the latest insights report.

**Authentication**: Required (admin only)
**Response**: `InsightsReport` object

### POST `/api/admin/insights/analyze`

Triggers a new code analysis.

**Authentication**: Required (admin only)
**Request Body**: `{ force?: boolean }`
**Response**: `{ jobId: string }`

### GET `/api/admin/insights/job-status`

Checks the status of an analysis job.

**Authentication**: Required (admin only)
**Query Parameters**: `jobId` (string)
**Response**: `{ status: string, progress?: number }`

### GET `/api/admin/insights/:reportId`

Returns a specific insights report by ID.

**Authentication**: Required (admin only)
**Response**: `InsightsReport` object

## Troubleshooting

### Authentication Issues

- Ensure your user email is listed in `ADMIN_EMAILS`
- Verify you are logged in with the correct account
- Check that the authentication middleware is properly configured

### Analysis Job Failures

- Verify your `CLAUDE_API_KEY` is valid and has sufficient quota
- Check blob storage connection and permissions
- Review job logs for specific error messages

### Database Connection Issues

- Ensure PostgreSQL is running and accessible
- Verify database connection string in `.env`
- Run `prisma generate` to regenerate the Prisma client

## Security Considerations

- Keep your `CLAUDE_API_KEY` and blob storage credentials secure
- Restrict admin access to trusted users only
- Rotate API keys regularly
- Use HTTPS in production environments

## Monitoring and Logging

Analysis jobs can be monitored through:
- The job status API endpoint
- Application logs (check your logging configuration)
- Database job records

For production environments, consider setting up:
- Alerting for failed jobs
- Performance monitoring
- Usage metrics tracking
