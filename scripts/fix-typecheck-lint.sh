#!/bin/bash

# TypeCheck Lint Fix Script for AI Board
# This script attempts to fix common TypeScript linting issues

echo "Running TypeCheck Lint Fix..."

# Run typecheck to see current issues
echo "Running initial typecheck..."
bun run type-check > /tmp/typecheck-issues.txt 2>&1

ISSUE_COUNT=$(grep -c "error TS" /tmp/typecheck-issues.txt || echo "0")

echo "Found $ISSUE_COUNT TypeScript errors"

if [ "$ISSUE_COUNT" -eq "0" ]; then
    echo "No TypeScript errors found. TypeCheck lint is clean!"
    exit 0
fi

# Common fixes for TypeScript issues

echo "Applying common TypeScript fixes..."

# Fix 1: Add missing @types/node to compilerOptions if not present
if ! grep -q "@types/node" tsconfig.json; then
    echo "Adding @types/node to types array in tsconfig.json"
    # This is a simple approach - in a real scenario, we'd use jq or similar
    sed -i '/"types": \[\]/c\    "types": ["@types/node"]' tsconfig.json
fi

# Fix 2: Add strict: false temporarily to allow build (commented out by default)
# This would be uncommented only if absolutely necessary
if grep -q '"strict": true' tsconfig.json; then
    echo "Consider relaxing strict mode temporarily for critical builds"
    echo "# sed -i 's/\"strict\": true/\"strict\": false/' tsconfig.json"
fi

# Fix 3: Add common type declarations for global variables
if [ ! -f "global.d.ts" ]; then
    echo "Creating global.d.ts for common type declarations"
    cat > global.d.ts << 'EOF'
// Global type declarations for AI Board

declare namespace NodeJS {
  interface ProcessEnv {
    CLAUDE_API_KEY?: string
    BLOB_STORAGE_CONNECTION_STRING?: string
    ADMIN_EMAILS?: string
  }
}

// Common global types
declare const process: {
  env: {
    [key: string]: string | undefined
  }
}

declare const Buffer: {
  from: (data: any, encoding?: string) => any
  // Add other Buffer methods as needed
}

// Add other global types as needed for the project
EOF
fi

# Fix 4: Check for missing imports and suggest fixes
MISSING_IMPORTS=$(grep "Cannot find module" /tmp/typecheck-issues.txt | sed 's/.*Cannot find module //' | sed 's/'\''//g' | sort | uniq)

if [ -n "$MISSING_IMPORTS" ]; then
    echo "Missing modules detected:"
    echo "$MISSING_IMPORTS"
    echo "Consider installing these with: bun add <module-name>"
fi

echo "TypeCheck lint fix script completed."
echo "Re-run 'bun run type-check' to verify fixes."
echo "For remaining issues, manual intervention may be required."
