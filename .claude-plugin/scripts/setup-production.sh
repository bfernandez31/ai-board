#!/bin/bash

# Production setup script for Neon database
# Run with: ./scripts/setup-production.sh

echo "🚀 Setting up production database..."
echo ""
echo "This will:"
echo "1. Reset the Neon database (delete all data)"
echo "2. Apply the 0_init migration (String-based User IDs)"
echo "3. Create your user and project 3"
echo ""
read -p "Enter your Neon DATABASE_URL: " DATABASE_URL
echo ""
read -p "Enter your UUID from session (e.g., 1acacaad-8e8b-4537-b2af-4ab2f80aa6d2): " UUID
echo ""
read -p "Enter your email: " EMAIL
echo ""
echo "⚠️  WARNING: This will DELETE ALL DATA in the production database!"
read -p "Are you sure? (type 'yes' to continue): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Aborted."
  exit 1
fi

echo ""
echo "📦 Step 1/3: Resetting database..."
DATABASE_URL="$DATABASE_URL" npx prisma migrate reset --skip-seed --force

if [ $? -ne 0 ]; then
  echo "❌ Failed to reset database"
  exit 1
fi

echo ""
echo "✅ Database reset complete"
echo ""
echo "👤 Step 2/3: Creating user and project..."
DATABASE_URL="$DATABASE_URL" npx tsx scripts/create-project-uuid.ts "$UUID" "$EMAIL"

if [ $? -ne 0 ]; then
  echo "❌ Failed to create user/project"
  exit 1
fi

echo ""
echo "🎉 Production setup complete!"
echo ""
echo "You can now access your project at:"
echo "https://ai-board-beta.vercel.app/projects/3/board"
