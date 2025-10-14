#!/usr/bin/env python3
"""
Script to add workflow authentication headers to all test files that need them.
"""

import re
import sys
from pathlib import Path

def add_import_if_missing(content: str) -> str:
    """Add workflow-auth import if not present."""
    import_line = "import { getWorkflowHeaders } from"

    if import_line in content:
        return content

    # Find the last import statement
    import_pattern = r"(import .+ from .+;)\n"
    imports = list(re.finditer(import_pattern, content))

    if not imports:
        return content

    last_import = imports[-1]

    # Determine the correct relative path based on file location
    if 'tests/e2e/' in content or 'tests/integration/' in content:
        # For files in tests/e2e/ or tests/integration/, we need to count depth
        # This is a simplified version - adjust path based on actual file location
        new_import = "\nimport { getWorkflowHeaders } from '../../helpers/workflow-auth';"
    else:
        new_import = "\nimport { getWorkflowHeaders } from '../helpers/workflow-auth';"

    insert_pos = last_import.end()
    return content[:insert_pos] + new_import + content[insert_pos:]

def add_workflow_headers(content: str) -> str:
    """Add workflow headers to PATCH requests that don't have them."""

    # Pattern 1: request.patch with data object but no headers
    # Match: request.patch(`...`, {\n      data: { ... }\n    });
    pattern1 = r"(request\.patch\([^,]+,\s*\{\s*\n\s*data:\s*\{[^}]+\}\s*\n\s*)\}"
    replacement1 = r"\1,\n      headers: getWorkflowHeaders(),\n    }"

    content = re.sub(pattern1, replacement1, content)

    return content

def fix_file(filepath: Path) -> bool:
    """Fix a single test file. Returns True if changes were made."""
    print(f"Processing {filepath}...")

    try:
        content = filepath.read_text()
        original_content = content

        # Add import if missing
        content = add_import_if_missing(content)

        # Add workflow headers where needed
        content = add_workflow_headers(content)

        if content != original_content:
            filepath.write_text(content)
            print(f"  ✓ Updated {filepath}")
            return True
        else:
            print(f"  - No changes needed for {filepath}")
            return False

    except Exception as e:
        print(f"  ✗ Error processing {filepath}: {e}", file=sys.stderr)
        return False

def main():
    """Main function to fix all test files."""
    test_dir = Path("tests")

    # Find all spec files that might need fixing
    spec_files = list(test_dir.rglob("*.spec.ts"))

    print(f"Found {len(spec_files)} test files")
    print("="*60)

    fixed_count = 0
    for spec_file in spec_files:
        # Skip files that definitely don't need workflow auth
        if "db-cleanup" in str(spec_file) or "global-setup" in str(spec_file):
            continue

        if fix_file(spec_file):
            fixed_count += 1

    print("="*60)
    print(f"Fixed {fixed_count} files")

if __name__ == "__main__":
    main()
