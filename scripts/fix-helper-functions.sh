#!/bin/bash

# Fix Helper Function Signatures and Calls
# Adds projectId parameter to common helper functions

set -e

echo "🔧 Fixing Helper Functions"
echo "=========================="
echo ""

# Fix createTicket helper function signature
echo "1️⃣ Fixing createTicket helper signatures..."
find tests -name "*.spec.ts" -type f -exec sed -i.bak \
    's/async function createTicket(request: APIRequestContext, data:/async function createTicket(request: APIRequestContext, projectId: number, data:/g' {} \;

# Fix createTicket helper calls
echo "2️⃣ Fixing createTicket helper calls..."
find tests -name "*.spec.ts" -type f -exec sed -i.bak \
    's/await createTicket(request,/await createTicket(request, projectId,/g' {} \;

# Fix createTestTicket helper calls (from db-setup.ts which takes projectId as first param)
echo "3️⃣ Fixing createTestTicket helper calls..."
find tests -name "*.spec.ts" -type f -exec sed -i.bak \
    's/createTestTicket({/createTestTicket(projectId, {/g' {} \;

# Clean up backup files
find tests -name "*.bak" -delete

echo ""
echo "✅ Helper functions fixed!"
echo ""
echo "Verification: Run tests to check for errors"
