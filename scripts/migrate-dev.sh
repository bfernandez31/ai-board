#!/bin/bash

# Migration helper script
# Loads DATABASE_URL from .env.local and applies migrations

set -e

# Load DATABASE_URL from .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | grep DATABASE_URL | xargs)
else
  echo "Error: .env.local not found"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL not set in .env.local"
  exit 1
fi

echo "Applying Prisma migrations..."
npx prisma migrate dev "$@"
