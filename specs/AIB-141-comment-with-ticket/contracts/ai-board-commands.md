# Contract: AI-BOARD Commands (Static Data)

**Source**: `app/lib/data/ai-board-commands.ts`

**Type**: Client-side static data (no API endpoint).

## TypeScript Interface

```typescript
export interface AIBoardCommand {
  /** Command name with leading slash (e.g., "/compare") */
  name: string;

  /** Short description for autocomplete dropdown (max 60 chars) */
  description: string;
}
```

## Command Registry

| name | description |
|------|-------------|
| `/compare` | Compare ticket implementations for best code quality |

## Usage

```typescript
import { AI_BOARD_COMMANDS, AIBoardCommand } from '@/app/lib/data/ai-board-commands';

// Filter commands by query
function filterCommands(query: string): AIBoardCommand[] {
  const q = query.toLowerCase();
  return AI_BOARD_COMMANDS.filter(cmd =>
    cmd.name.toLowerCase().includes(q) ||
    cmd.description.toLowerCase().includes(q)
  );
}
```

## Future Commands

Commands are added by modifying `ai-board-commands.ts`. Each command must:
1. Start with `/`
2. Have a concise description (max 60 chars)
3. Be user-invocable (not internal AI commands)

**Not Exposed**:
- Internal commands from `.claude/commands/` (e.g., `/speckit.plan`)
- System commands (e.g., `/cleanup`)

Only commands intended for user invocation in comments appear in autocomplete.
