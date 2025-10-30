#!/bin/bash
# Setup test environment file for CI/CD workflows
# This script creates a .env file from .env.test template and injects GitHub Secrets

set -e

echo "🔧 Setting up test environment file..."

# Check if .env.test exists
if [ ! -f ".env.test" ]; then
  echo "❌ Error: .env.test template not found"
  exit 1
fi

# Copy template to .env
cp .env.test .env

# Replace placeholder variables with actual GitHub Secrets
# Using sed with | delimiter to avoid issues with / in URLs
sed -i.bak \
  -e "s|\${GITHUB_TOKEN}|${GITHUB_TOKEN}|g" \
  -e "s|\${WORKFLOW_API_TOKEN}|${WORKFLOW_API_TOKEN}|g" \
  -e "s|\${CLOUDINARY_CLOUD_NAME}|${CLOUDINARY_CLOUD_NAME}|g" \
  -e "s|\${CLOUDINARY_API_KEY}|${CLOUDINARY_API_KEY}|g" \
  -e "s|\${CLOUDINARY_API_SECRET}|${CLOUDINARY_API_SECRET}|g" \
  .env

# Remove backup file created by sed
rm -f .env.bak

echo "✅ Test environment file created successfully"
echo "📋 Environment variables configured:"
echo "  - DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ai_board_test"
echo "  - NEXTAUTH_URL: http://localhost:3000"
echo "  - APP_URL: http://localhost:3000"
echo "  - GITHUB_TOKEN: ${GITHUB_TOKEN:0:10}... (${#GITHUB_TOKEN} chars)"
echo "  - WORKFLOW_API_TOKEN: ${WORKFLOW_API_TOKEN:0:10}... (${#WORKFLOW_API_TOKEN} chars)"
echo "  - CLOUDINARY_CLOUD_NAME: ${CLOUDINARY_CLOUD_NAME}"
echo ""
