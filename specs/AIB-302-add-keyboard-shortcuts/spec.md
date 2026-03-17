# AIB-302: Add Keyboard Shortcuts on Board

## Description
Add keyboard shortcuts for common board actions on desktop/tablet with physical keyboard.

## Shortcuts
| Key | Action |
|-----|--------|
| `N` | Open new ticket creation modal |
| `S` or `/` | Focus search input |
| `1`-`6` | Scroll to column (INBOX=1, SPECIFY=2, PLAN=3, BUILD=4, VERIFY=5, SHIP=6) |
| `?` | Toggle shortcut help overlay |
| `Escape` | Close any open modal/overlay |

## Behavior
- Shortcuts disabled when text input/textarea/contenteditable is focused
- Shortcuts disabled on mobile/tablet without physical keyboard
- `?` opens centered modal with shortcut list
- Column scroll smoothly scrolls board to target column

## Scope
- Board page only (`/projects/{projectId}/board`)
