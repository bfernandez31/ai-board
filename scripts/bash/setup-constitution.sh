#!/usr/bin/env bash
# setup-constitution.sh - Post-install hook for copying constitution template
# Only copies if target doesn't exist (preserves customizations)

set -euo pipefail

# Source common functions for get_plugin_root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Get plugin root (works in both plugin and standalone contexts)
PLUGIN_ROOT=$(get_plugin_root)

# Target location in managed project
TARGET_DIR=".specify/memory"
TARGET_FILE="$TARGET_DIR/constitution.md"

# Source template from plugin
SOURCE_FILE="$PLUGIN_ROOT/memory/constitution.md"

# Only copy if target doesn't exist (preserve existing customizations)
if [[ ! -f "$TARGET_FILE" ]]; then
    # Ensure target directory exists
    mkdir -p "$TARGET_DIR"

    # Copy constitution template
    if [[ -f "$SOURCE_FILE" ]]; then
        cp "$SOURCE_FILE" "$TARGET_FILE"
        echo "[ai-board] Created constitution template at $TARGET_FILE"
    else
        echo "[ai-board] Warning: Constitution template not found at $SOURCE_FILE" >&2
    fi
else
    echo "[ai-board] Constitution already exists at $TARGET_FILE (preserved)"
fi
