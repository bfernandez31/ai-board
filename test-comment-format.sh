#!/bin/bash

# Simulate variables
PR_NUMBER="42"
PR_URL="https://github.com/user/repo/pull/42"

# Construct JSON payload (same as script)
PAYLOAD="{\"content\": \"✅ **Pull Request Ready for Review**\\n\\n**PR #${PR_NUMBER}**: [View Pull Request](${PR_URL})\\n\\nThe implementation is complete. Code review can now begin.\\n\\n**Next Steps**:\\n- Review the code changes\\n- Run tests to verify functionality\\n- Approve and merge when ready\"}"

# Pretty print JSON
echo "$PAYLOAD" | python3 -m json.tool

# Expected output should be valid JSON with markdown content
