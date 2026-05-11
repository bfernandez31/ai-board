#!/bin/bash

# Admin Setup Script for AI Board
# This script sets up the necessary environment variables and configuration for the admin section

echo "Setting up AI Board Admin Configuration..."

# Check if .env file exists, if not create it from .env.example
if [ ! -f ".env" ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
fi

# Check if required admin environment variables are set
REQUIRED_VARS=(
    "CLAUDE_API_KEY"
    "BLOB_STORAGE_CONNECTION_STRING"
    "ADMIN_EMAILS"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^$var=" .env; then
        MISSING_VARS+=("$var")
        echo "$var=" >> .env
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "The following required admin variables were missing and have been added to .env:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  $var"
    done
    echo "Please edit .env and set appropriate values for these variables."
else
    echo "All required admin variables are already present in .env"
fi

# Check if admin directories exist
mkdir -p components/admin
mkdir -p lib/admin
mkdir -p lib/insights

echo "Admin setup script completed."
echo "Next steps:"
echo "1. Edit .env and set the required admin variables"
echo "2. Run 'bun install' to install dependencies"
echo "3. Run 'prisma generate' to update Prisma client"
echo "4. Run 'bun dev' to start the development server"
