#!/bin/bash

# Complete Test Migration Script
# Fixes all common patterns for worker isolation in a single pass

set -e

echo "🔧 Complete Test Migration Script"
echo "=================================="
echo ""

# Function to migrate a single file
migrate_file() {
    local file=$1
    echo "📝 Migrating: $file"

    # 1. Fix hardcoded /projects/1/ URLs in page.goto
    sed -i.bak "s|'/projects/1/board'|\`/projects/\${projectId}/board\`|g" "$file"
    sed -i.bak 's|"/projects/1/board"|`/projects/${projectId}/board`|g' "$file"
    sed -i.bak "s|'/projects/1/tickets'|\`/projects/\${projectId}/tickets\`|g" "$file"

    # 2. Fix hardcoded /api/projects/1/ in API calls
    sed -i.bak "s|'/api/projects/1/|\`/api/projects/\${projectId}/|g" "$file"
    sed -i.bak 's|"/api/projects/1/|`/api/projects/${projectId}/|g' "$file"

    # 3. Fix BASE_URL concatenation with /projects/1/
    sed -i.bak 's|\${BASE_URL}/projects/1/|${BASE_URL}/projects/${projectId}/|g' "$file"

    # Clean up backup files
    rm -f "$file.bak"

    echo "  ✅ Fixed URLs"
}

# Get list of test files (excluding the one we already fixed)
files=$(find tests -name "*.spec.ts" ! -name "create.spec.ts" -type f)

count=0
for file in $files; do
    migrate_file "$file"
    count=$((count + 1))
done

echo ""
echo "✅ Migration complete!"
echo "   Files processed: $count"
echo ""
echo "Next: Manually fix helper functions in each file"
echo "Pattern: async function helper(request, projectId, data)"
