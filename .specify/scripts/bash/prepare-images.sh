#!/bin/bash
# Prepare Images for Claude Context
#
# This script downloads images from ticket attachments (Cloudinary or external URLs)
# and prepares them for Claude Code processing. Images are stored temporarily and
# should be cleaned up after use.
#
# Usage: prepare-images.sh <ticket_id> <attachments_json>
#
# Returns: Space-separated list of image file paths (via stdout)
# Environment: Sets IMAGE_COUNT and IMAGE_PATHS environment variables

set -e

# Parse arguments
TICKET_ID=$1
ATTACHMENTS_JSON=$2

# Validate required arguments
if [ -z "$TICKET_ID" ] || [ -z "$ATTACHMENTS_JSON" ]; then
  echo "❌ Error: Missing required arguments" >&2
  echo "Usage: $0 <ticket_id> <attachments_json>" >&2
  exit 1
fi

echo "📸 Preparing images for Claude context..." >&2
echo "ℹ️  Images are stored in Cloudinary, not in the Git repository" >&2

# Create ticket assets directory (temporary, for Claude context only)
TICKET_ASSETS_DIR="ticket-assets/${TICKET_ID}"
mkdir -p "$TICKET_ASSETS_DIR"

# Write attachments JSON to temp file
echo "$ATTACHMENTS_JSON" > /tmp/attachments.json

# Download external images and collect all image paths
IMAGE_COUNT=0
IMAGE_PATHS=""

# Process each attachment
for row in $(jq -r '.[] | @base64' /tmp/attachments.json); do
  _jq() {
    echo "${row}" | base64 --decode | jq -r "${1}"
  }

  ATTACHMENT_TYPE=$(_jq '.type')
  ATTACHMENT_URL=$(_jq '.url')
  ATTACHMENT_FILENAME=$(_jq '.filename')

  if [ "$ATTACHMENT_TYPE" = "external" ]; then
    echo "  📥 Downloading external image: $ATTACHMENT_URL" >&2

    # Extract file extension from URL or use .png as default
    EXT="${ATTACHMENT_URL##*.}"
    if [ "${#EXT}" -gt 5 ]; then
      EXT="png"
    fi

    # Download image
    SAFE_FILENAME=$(echo "$ATTACHMENT_FILENAME" | tr -cd 'a-zA-Z0-9._-')
    IMAGE_FILE="$TICKET_ASSETS_DIR/${SAFE_FILENAME}.${EXT}"

    if curl -sSL --max-time 30 --retry 3 "$ATTACHMENT_URL" -o "$IMAGE_FILE"; then
      echo "    ✅ Downloaded: $IMAGE_FILE" >&2
      IMAGE_COUNT=$((IMAGE_COUNT + 1))
      IMAGE_PATHS="$IMAGE_PATHS $IMAGE_FILE"
    else
      echo "    ⚠️ Failed to download: $ATTACHMENT_URL (continuing...)" >&2
    fi
  elif [ "$ATTACHMENT_TYPE" = "uploaded" ]; then
    # For uploaded images stored in Cloudinary, download from URL
    echo "  ☁️ Downloading Cloudinary image: $ATTACHMENT_URL" >&2

    # Extract file extension from filename or URL
    EXT="${ATTACHMENT_FILENAME##*.}"
    if [ "${#EXT}" -gt 5 ] || [ -z "$EXT" ]; then
      EXT="${ATTACHMENT_URL##*.}"
      if [ "${#EXT}" -gt 5 ]; then
        EXT="png"
      fi
    fi

    # Download image from Cloudinary
    SAFE_FILENAME=$(echo "$ATTACHMENT_FILENAME" | tr -cd 'a-zA-Z0-9._-')
    IMAGE_FILE="$TICKET_ASSETS_DIR/${SAFE_FILENAME}"

    if curl -sSL --max-time 30 --retry 3 "$ATTACHMENT_URL" -o "$IMAGE_FILE"; then
      echo "    ✅ Downloaded from Cloudinary: $IMAGE_FILE" >&2
      IMAGE_COUNT=$((IMAGE_COUNT + 1))
      IMAGE_PATHS="$IMAGE_PATHS $IMAGE_FILE"
    else
      echo "    ⚠️ Failed to download from Cloudinary: $ATTACHMENT_URL (continuing...)" >&2
    fi
  fi
done

# Export results as environment variables for GitHub Actions
if [ -n "$GITHUB_ENV" ]; then
  echo "IMAGE_PATHS=$IMAGE_PATHS" >> "$GITHUB_ENV"
  echo "IMAGE_COUNT=$IMAGE_COUNT" >> "$GITHUB_ENV"
fi

echo "✅ Prepared $IMAGE_COUNT images for Claude context" >&2

# Output image paths to stdout (for script usage)
echo "$IMAGE_PATHS"
