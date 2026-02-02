#!/usr/bin/env bash

set -e

JSON_MODE=false
MODE="specify"  # Default mode: full spec template
TICKET_KEY=""   # Optional: ticket key for branch naming (e.g., ABC-123)
ARGS=()
for arg in "$@"; do
    case "$arg" in
        --json) JSON_MODE=true ;;
        --mode=*) MODE="${arg#--mode=}" ;;
        --ticket-key=*) TICKET_KEY="${arg#--ticket-key=}" ;;
        --help|-h) echo "Usage: $0 [--json] [--mode=specify|quick-impl|cleanup] [--ticket-key=ABC-123] <feature_description>"; exit 0 ;;
        *) ARGS+=("$arg") ;;
    esac
done

# Validate mode parameter
if [ "$MODE" != "specify" ] && [ "$MODE" != "quick-impl" ] && [ "$MODE" != "cleanup" ]; then
    echo "Error: Invalid mode '$MODE'. Must be 'specify', 'quick-impl', or 'cleanup'" >&2
    exit 1
fi

FEATURE_DESCRIPTION="${ARGS[*]}"
if [ -z "$FEATURE_DESCRIPTION" ]; then
    echo "Usage: $0 [--json] [--mode=specify|quick-impl|cleanup] <feature_description>" >&2
    exit 1
fi

# Function to find the repository root by searching for existing project markers
find_repo_root() {
    local dir="$1"
    while [ "$dir" != "/" ]; do
        if [ -d "$dir/.git" ] || [ -d "$dir/.specify" ]; then
            echo "$dir"
            return 0
        fi
        dir="$(dirname "$dir")"
    done
    return 1
}

# Resolve repository root. Prefer git information when available, but fall back
# to searching for repository markers so the workflow still functions in repositories that
# were initialised with --no-git.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if git rev-parse --show-toplevel >/dev/null 2>&1; then
    REPO_ROOT=$(git rev-parse --show-toplevel)
    HAS_GIT=true
else
    REPO_ROOT="$(find_repo_root "$SCRIPT_DIR")"
    if [ -z "$REPO_ROOT" ]; then
        echo "Error: Could not determine repository root. Please run this script from within the repository." >&2
        exit 1
    fi
    HAS_GIT=false
fi

cd "$REPO_ROOT"

SPECS_DIR="$REPO_ROOT/specs"
mkdir -p "$SPECS_DIR"

HIGHEST=0
if [ -d "$SPECS_DIR" ]; then
    for dir in "$SPECS_DIR"/*; do
        [ -d "$dir" ] || continue
        dirname=$(basename "$dir")
        number=$(echo "$dirname" | grep -o '^[0-9]\+' || echo "0")
        number=$((10#$number))
        if [ "$number" -gt "$HIGHEST" ]; then HIGHEST=$number; fi
    done
fi

NEXT=$((HIGHEST + 1))
FEATURE_NUM=$(printf "%03d" "$NEXT")

# Branch naming logic
# - JSON mode with ticket-key: {ticketKey}-{words} or {ticketKey}-cleanup
# - CLI mode (no ticket-key): {FEATURE_NUM}-{words} or cleanup-{date}

# First, compute WORDS from description (used by both modes)
SLUG=$(echo "$FEATURE_DESCRIPTION" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-//' | sed 's/-$//')
WORDS=$(echo "$SLUG" | tr '-' '\n' | grep -v '^$' | head -3 | tr '\n' '-' | sed 's/-$//')

if [ "$JSON_MODE" = true ] && [ -n "$TICKET_KEY" ]; then
    # AI-Board mode: use ticketKey prefix
    if [ "$MODE" = "cleanup" ]; then
        BRANCH_NAME="${TICKET_KEY}-cleanup"
    else
        BRANCH_NAME="${TICKET_KEY}-${WORDS}"
    fi
else
    # CLI mode: use FEATURE_NUM prefix (original behavior)
    if [ "$MODE" = "cleanup" ]; then
        BRANCH_NAME="cleanup-$(date +%Y%m%d)"
    else
        BRANCH_NAME="${FEATURE_NUM}-${WORDS}"
    fi
fi

if [ "$HAS_GIT" = true ]; then
    git checkout -b "$BRANCH_NAME"
else
    >&2 echo "[specify] Warning: Git repository not detected; skipped branch creation for $BRANCH_NAME"
fi

FEATURE_DIR="$SPECS_DIR/$BRANCH_NAME"
mkdir -p "$FEATURE_DIR"

SPEC_FILE="$FEATURE_DIR/spec.md"

# Choose template based on mode
if [ "$MODE" = "cleanup" ]; then
    # Cleanup mode: Create cleanup-focused spec
    cat > "$SPEC_FILE" <<EOF
# Cleanup: ${FEATURE_DESCRIPTION}

**Branch**: \`${BRANCH_NAME}\`
**Created**: $(date +%Y-%m-%d)
**Mode**: Cleanup (automated technical debt reduction)

## Scope

This cleanup will analyze all changes since the last cleanup merge and:
- Detect dead/obsolete code
- Assess project-wide impact
- Synchronize specifications with implementation

## Analysis

_(To be filled by /cleanup command)_

## Tasks

See \`cleanup-tasks.md\` for detailed task tracking.
EOF

    # Also create cleanup-tasks.md template
    TASKS_FILE="$FEATURE_DIR/cleanup-tasks.md"
    cat > "$TASKS_FILE" <<EOF
# Cleanup Tasks

**Branch**: \`${BRANCH_NAME}\`
**Created**: $(date +%Y-%m-%d)

## Discovery
- [ ] T001: Find last cleanup merge point
- [ ] T002: Analyze diff since last cleanup

## Analysis
- [ ] T003: Dead code detection
- [ ] T004: Project impact assessment
- [ ] T005: Spec synchronization check

## Fixes
_(Tasks will be added as issues are discovered)_

## Validation
- [ ] T099: Run tests
- [ ] T100: Type check
- [ ] T101: Final review
EOF

elif [ "$MODE" = "quick-impl" ]; then
    # Quick-impl mode: Create minimal spec.md with only title and description
    cat > "$SPEC_FILE" <<EOF
# Quick Implementation: ${FEATURE_DESCRIPTION}

**Feature Branch**: \`${BRANCH_NAME}\`
**Created**: $(date +%Y-%m-%d)
**Mode**: Quick Implementation (bypassing formal specification)

## Description

${FEATURE_DESCRIPTION}

## Implementation Notes

This feature is being implemented via quick-impl workflow, bypassing formal specification and planning phases.

**Quick-impl is suitable for**:
- Bug fixes (typos, minor logic corrections)
- UI tweaks (colors, spacing, text changes)
- Simple refactoring (renaming, file organization)
- Documentation updates

**For complex features**, use the full workflow: INBOX → SPECIFY → PLAN → BUILD

## Implementation

Implementation will be done directly by Claude Code based on the description above.
EOF
else
    # Specify mode: Use full spec template (existing behavior)
    TEMPLATE="$REPO_ROOT/.specify/templates/spec-template.md"
    if [ -f "$TEMPLATE" ]; then
        cp "$TEMPLATE" "$SPEC_FILE"
    else
        touch "$SPEC_FILE"
    fi
fi

# Set the SPECIFY_FEATURE environment variable for the current session
export SPECIFY_FEATURE="$BRANCH_NAME"

if $JSON_MODE; then
    printf '{"BRANCH_NAME":"%s","SPEC_FILE":"%s","FEATURE_NUM":"%s"}\n' "$BRANCH_NAME" "$SPEC_FILE" "$FEATURE_NUM"
else
    echo "BRANCH_NAME: $BRANCH_NAME"
    echo "SPEC_FILE: $SPEC_FILE"
    echo "FEATURE_NUM: $FEATURE_NUM"
    echo "SPECIFY_FEATURE environment variable set to: $BRANCH_NAME"
fi
