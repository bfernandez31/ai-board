# Research: Auto-Clarification Resolution System

**Feature**: 029-999-auto-clarification
**Date**: 2025-01-14
**Purpose**: Resolve technical unknowns and establish best practices for implementation

## Research Areas

### 1. Prisma Enum with Default Values

**Research Question**: What are best practices for Prisma enums with NOT NULL defaults and nullable overrides?

**Decision**: Use Prisma enum with `@default(AUTO)` for Project, nullable for Ticket

**Rationale**:
- Prisma enums are type-safe and generate TypeScript types automatically
- `@default(AUTO)` ensures every project has a policy without requiring manual setup
- NULLABLE on Ticket enables clear inheritance semantics (null = use project default)
- Enum values are validated at database level (PostgreSQL `CREATE TYPE` syntax)
- Migration is backward-compatible (existing records get AUTO default)

**Alternatives Considered**:
- String field with validation: Rejected - less type-safe, requires runtime validation everywhere
- Separate policy table: Rejected - over-engineering for 4 simple enum values
- JSON field: Rejected - loses database-level validation and indexing

**Best Practices**:
```prisma
enum ClarificationPolicy {
  AUTO
  CONSERVATIVE
  PRAGMATIC
  INTERACTIVE
}

model Project {
  clarificationPolicy ClarificationPolicy @default(AUTO) @map("clarification_policy")
}

model Ticket {
  clarificationPolicy ClarificationPolicy? @map("clarification_policy")
}
```

**Implementation Notes**:
- Use `@map()` for snake_case database column names (convention in PostgreSQL)
- Prisma generates TypeScript enum `ClarificationPolicy` for type safety
- Client code: `import { ClarificationPolicy } from '@prisma/client'`
- Zod schema: `z.nativeEnum(ClarificationPolicy)` for API validation

---

### 2. Next.js App Router PATCH with Zod Validation

**Research Question**: What's the pattern for PATCH endpoints in Next.js 15 App Router with partial updates and enum validation?

**Decision**: Use Zod schema with `.partial()` and `.refine()` for nullable enum validation

**Rationale**:
- Next.js App Router uses `export async function PATCH(request: NextRequest)` convention
- Zod `.partial()` allows partial updates (only send changed fields)
- Custom `.refine()` validator handles nullable enums (null valid for ticket, invalid for project)
- Type safety: `request.json()` validated with Zod, returns typed object
- Error handling: Zod throws `ZodError` with structured validation errors

**Alternatives Considered**:
- Manual validation: Rejected - error-prone, loses type safety
- Class-validator: Rejected - not idiomatic for Next.js, extra dependency
- Yup: Rejected - less TypeScript integration than Zod

**Best Practices**:
```typescript
// app/lib/schemas/clarification-policy.ts
import { z } from 'zod';
import { ClarificationPolicy } from '@prisma/client';

export const projectUpdateSchema = z.object({
  clarificationPolicy: z.nativeEnum(ClarificationPolicy),
  // ... other fields
}).partial();

export const ticketUpdateSchema = z.object({
  clarificationPolicy: z.nativeEnum(ClarificationPolicy).nullable(),
  // ... other fields
}).partial();

// app/api/projects/[id]/route.ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validated = projectUpdateSchema.parse(body);

    const updated = await prisma.project.update({
      where: { id: parseInt(params.id) },
      data: validated,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Implementation Notes**:
- Use `z.nativeEnum(ClarificationPolicy)` not `z.enum(['AUTO', ...])` for type safety
- `.nullable()` allows `null` but not `undefined` (explicit inheritance reset)
- `.optional()` allows field omission in partial updates
- Error responses include Zod validation details for debugging

---

### 3. Hierarchical Policy Resolution

**Research Question**: What's the cleanest pattern for ticket ?? project ?? 'AUTO' resolution in TypeScript?

**Decision**: Nullish coalescing operator (`??`) with utility function for testability

**Rationale**:
- `??` operator is idiomatic TypeScript for null/undefined fallback
- Utility function enables unit testing without database dependencies
- Type-safe: TypeScript infers non-nullable return type
- Single source of truth: resolution logic in one reusable function

**Alternatives Considered**:
- Ternary operators: Rejected - less readable for 3-level fallback
- Lodash `_.defaultTo()`: Rejected - unnecessary dependency for simple logic
- Database view: Rejected - adds complexity, harder to test

**Best Practices**:
```typescript
// app/lib/utils/policy-resolution.ts
import { ClarificationPolicy } from '@prisma/client';

export function resolveEffectivePolicy(
  ticketPolicy: ClarificationPolicy | null,
  projectPolicy: ClarificationPolicy,
  systemDefault: ClarificationPolicy = ClarificationPolicy.AUTO
): ClarificationPolicy {
  return ticketPolicy ?? projectPolicy ?? systemDefault;
}

// Usage in API/UI
const effectivePolicy = resolveEffectivePolicy(
  ticket.clarificationPolicy,
  ticket.project.clarificationPolicy
);
```

**Implementation Notes**:
- Function parameters match database types (nullable ticket, NOT NULL project)
- System default parameter enables testing different fallback scenarios
- Pure function: no side effects, easy to test, composable
- Use in both client (UI badge display) and server (workflow resolution)

---

### 4. GitHub Actions JSON Payload Construction

**Research Question**: How to safely construct JSON payloads with variables in GitHub Actions?

**Decision**: Use heredoc syntax with proper escaping for shell safety

**Rationale**:
- Heredoc (`cat <<'EOF' ... EOF`) prevents variable expansion issues
- Single quotes in EOF delimiter prevent unintended interpolation
- `jq` for JSON parsing ensures type safety and handles special characters
- Environment variables passed via `${{ }}` syntax are GitHub Actions interpolation (happens before shell)

**Alternatives Considered**:
- Inline JSON string: Rejected - escaping nightmare, quote hell
- JSON file creation: Rejected - unnecessary file I/O, harder to read
- Node.js script: Rejected - extra dependency, slower execution

**Best Practices**:
```yaml
# .github/workflows/ticket-workflow.yml
- name: Get effective clarification policy
  id: get_policy
  run: |
    # Fetch ticket with nested project
    TICKET_DATA=$(curl -s "${{ secrets.API_URL }}/api/projects/${{ env.PROJECT_ID }}/tickets/${{ env.TICKET_ID }}")

    # Extract policies using jq
    TICKET_POLICY=$(echo "$TICKET_DATA" | jq -r '.clarificationPolicy // "null"')
    PROJECT_POLICY=$(echo "$TICKET_DATA" | jq -r '.project.clarificationPolicy // "AUTO"')

    # Resolve effective policy
    if [ "$TICKET_POLICY" != "null" ]; then
      EFFECTIVE_POLICY="$TICKET_POLICY"
    else
      EFFECTIVE_POLICY="$PROJECT_POLICY"
    fi

    echo "policy=$EFFECTIVE_POLICY" >> $GITHUB_OUTPUT

- name: Run /specify with effective policy
  run: |
    # Construct JSON payload using heredoc
    PAYLOAD=$(cat <<'EOF'
    {
      "featureDescription": "${{ env.FEATURE_DESCRIPTION }}",
      "clarificationPolicy": "${{ steps.get_policy.outputs.policy }}"
    }
    EOF
    )

    # Pass to Claude Code (spec-kit)
    claude --slash-command "/specify $PAYLOAD"
```

**Implementation Notes**:
- Use `jq -r` for raw string output (no quotes)
- Use `// "default"` for null fallback in jq
- Test JSON construction with `echo "$PAYLOAD" | jq .` for validation
- GitHub Actions `${{ }}` interpolation happens before shell execution

---

### 5. Slash Command JSON Parsing Pattern

**Research Question**: How to parse optional JSON payload in slash commands while maintaining backward compatibility?

**Decision**: Try JSON parse first, fallback to plain text mode

**Rationale**:
- Backward compatibility: existing plain text inputs continue to work
- JSON detection: check for leading `{` before parsing attempt
- Error handling: invalid JSON triggers fallback, not error
- Type safety: parsed JSON validated with interface/type guard

**Alternatives Considered**:
- Require JSON always: Rejected - breaks existing workflows
- Magic string prefix: Rejected - awkward UX, adds complexity
- YAML format: Rejected - less standard than JSON for API-like payloads

**Best Practices**:
```markdown
<!-- .claude/commands/specify.md -->

## STEP 1: PARSE COMMAND PAYLOAD

Extract feature description and policy from `$ARGUMENTS`:

```typescript
interface SpecifyPayload {
  featureDescription: string;
  clarificationPolicy?: 'AUTO' | 'CONSERVATIVE' | 'PRAGMATIC' | 'INTERACTIVE';
}

function parsePayload(args: string): SpecifyPayload {
  // Trim whitespace
  const trimmed = args.trim();

  // Detect JSON by leading brace
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);

      // Validate structure
      if (typeof parsed.featureDescription !== 'string') {
        throw new Error('Missing featureDescription');
      }

      return {
        featureDescription: parsed.featureDescription,
        clarificationPolicy: parsed.clarificationPolicy ?? 'AUTO',
      };
    } catch (error) {
      // JSON parse failed → fallback to plain text
      console.warn('JSON parse failed, using plain text mode:', error);
    }
  }

  // Plain text mode (backward compatibility)
  return {
    featureDescription: trimmed,
    clarificationPolicy: 'INTERACTIVE', // Preserve current behavior
  };
}

// Usage
const payload = parsePayload($ARGUMENTS);
const policy = payload.clarificationPolicy;
```

**Implementation Notes**:
- Use try-catch for JSON parse errors (invalid JSON → fallback)
- Default policy: AUTO for JSON mode, INTERACTIVE for plain text (backward compat)
- Log fallback reason for debugging
- Type guard validates parsed JSON structure
- If JSON missing `clarificationPolicy`, default to AUTO (not INTERACTIVE)

---

### 6. AUTO Policy Context Detection

**Research Question**: What's the algorithm for keyword-based context detection with confidence scoring?

**Decision**: Weighted keyword buckets with conflict detection and confidence thresholds

**Rationale**:
- Keyword buckets: SENSITIVE (security, payment, PII), INTERNAL (admin, debug), SCALABILITY (high-traffic, SLA)
- Weighted scoring: SENSITIVE +3, INTERNAL -2, SCALABILITY +2 per keyword
- Conflict detection: count distinct buckets with signals
- Confidence formula: based on absolute score magnitude and bucket purity
- Fallback: confidence < 0.5 OR conflicting buckets >= 2 → CONSERVATIVE

**Alternatives Considered**:
- ML model: Rejected - overkill, requires training data, slower
- Simple majority voting: Rejected - doesn't handle conflicts well
- Regex patterns: Rejected - less maintainable than keyword list

**Best Practices**:
```typescript
// app/lib/utils/auto-context-detection.ts

interface ContextSignal {
  bucket: 'SENSITIVE' | 'INTERNAL' | 'SCALABILITY';
  weight: number;
  keywords: string[];
}

const SIGNAL_DEFINITIONS: ContextSignal[] = [
  {
    bucket: 'SENSITIVE',
    weight: 3,
    keywords: [
      'payment', 'financial', 'bank', 'transaction', 'credit card',
      'auth', 'login', 'password', 'security', 'encryption',
      'personal data', 'PII', 'GDPR', 'HIPAA', 'PCI-DSS',
      'compliance', 'audit', 'regulatory',
    ],
  },
  {
    bucket: 'INTERNAL',
    weight: -2,
    keywords: [
      'admin', 'internal', 'tool', 'debug', 'logging',
      'prototype', 'MVP', 'exploratory', 'temporary',
    ],
  },
  {
    bucket: 'SCALABILITY',
    weight: 2,
    keywords: [
      'millions of users', 'high traffic', 'mission critical',
      'SLA', 'uptime', 'availability',
    ],
  },
];

interface DetectionResult {
  selectedPolicy: 'CONSERVATIVE' | 'PRAGMATIC';
  confidence: number;
  detectedKeywords: { bucket: string; keyword: string }[];
  fallbackTriggered: boolean;
  reason?: string;
}

export function detectAutoPolicy(featureDescription: string): DetectionResult {
  const lowerDesc = featureDescription.toLowerCase();
  const detectedKeywords: { bucket: string; keyword: string }[] = [];
  let netScore = 0;
  const activeBuckets = new Set<string>();

  // Scan for keywords
  for (const signal of SIGNAL_DEFINITIONS) {
    for (const keyword of signal.keywords) {
      if (lowerDesc.includes(keyword.toLowerCase())) {
        detectedKeywords.push({ bucket: signal.bucket, keyword });
        netScore += signal.weight;
        activeBuckets.add(signal.bucket);
      }
    }
  }

  // Compute confidence
  const absScore = Math.abs(netScore);
  const bucketCount = activeBuckets.size;
  let confidence: number;

  if (absScore >= 5 && bucketCount <= 1) {
    confidence = 0.9; // High confidence, single clear signal
  } else if (absScore >= 3 && bucketCount <= 2) {
    confidence = 0.6; // Medium confidence
  } else {
    confidence = 0.3; // Low confidence
  }

  // Apply fallback logic
  let fallbackTriggered = false;
  let reason: string | undefined;

  if (confidence < 0.5) {
    fallbackTriggered = true;
    reason = 'Low confidence score';
    return {
      selectedPolicy: 'CONSERVATIVE',
      confidence,
      detectedKeywords,
      fallbackTriggered,
      reason,
    };
  }

  if (bucketCount >= 2 && activeBuckets.has('SENSITIVE') && activeBuckets.has('INTERNAL')) {
    fallbackTriggered = true;
    reason = 'Conflicting signals (SENSITIVE + INTERNAL)';
    return {
      selectedPolicy: 'CONSERVATIVE',
      confidence,
      detectedKeywords,
      fallbackTriggered,
      reason,
    };
  }

  // Select policy based on net score
  const selectedPolicy = netScore >= 0 ? 'CONSERVATIVE' : 'PRAGMATIC';

  return {
    selectedPolicy,
    confidence,
    detectedKeywords,
    fallbackTriggered,
  };
}
```

**Implementation Notes**:
- Case-insensitive keyword matching
- Keywords can be multi-word phrases (e.g., "credit card")
- Bucket purity: fewer active buckets = higher confidence
- Fallback always chooses CONSERVATIVE (safe default)
- Return full result object for transparency in spec documentation

---

### 7. Shadcn/UI Policy Badge Component

**Research Question**: What's the pattern for consistent badge styling with icons and tooltips?

**Decision**: Use shadcn/ui Badge + Tooltip with custom icon mapping utility

**Rationale**:
- Badge component provides consistent styling with variants (default, secondary, outline)
- Tooltip from Radix UI (shadcn/ui foundation) for hover information
- Icon mapping: centralized utility function for policy → emoji consistency
- Conditional rendering: show badge only for overrides (board view) or always (detail view)

**Alternatives Considered**:
- Custom badge from scratch: Rejected - reinventing shadcn/ui, loses accessibility
- CSS-only tooltips: Rejected - less accessible than Radix Tooltip
- lucide-react icons: Rejected - emojis are simpler, no dependency increase

**Best Practices**:
```typescript
// app/lib/utils/policy-icons.ts
import { ClarificationPolicy } from '@prisma/client';

export function getPolicyIcon(policy: ClarificationPolicy): string {
  const icons: Record<ClarificationPolicy, string> = {
    [ClarificationPolicy.AUTO]: '🤖',
    [ClarificationPolicy.CONSERVATIVE]: '🛡️',
    [ClarificationPolicy.PRAGMATIC]: '⚡',
    [ClarificationPolicy.INTERACTIVE]: '💬',
  };
  return icons[policy];
}

export function getPolicyLabel(policy: ClarificationPolicy): string {
  const labels: Record<ClarificationPolicy, string> = {
    [ClarificationPolicy.AUTO]: 'AUTO',
    [ClarificationPolicy.CONSERVATIVE]: 'CONSERVATIVE',
    [ClarificationPolicy.PRAGMATIC]: 'PRAGMATIC',
    [ClarificationPolicy.INTERACTIVE]: 'INTERACTIVE',
  };
  return labels[policy];
}

// components/tickets/policy-badge.tsx
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ClarificationPolicy } from '@prisma/client';
import { getPolicyIcon, getPolicyLabel } from '@/app/lib/utils/policy-icons';

interface PolicyBadgeProps {
  policy: ClarificationPolicy;
  isOverride?: boolean; // Show "(override)" suffix
  variant?: 'default' | 'secondary' | 'outline';
}

export function PolicyBadge({ policy, isOverride, variant = 'secondary' }: PolicyBadgeProps) {
  const icon = getPolicyIcon(policy);
  const label = getPolicyLabel(policy);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={variant} className="gap-1">
          <span>{icon}</span>
          <span className="text-xs">{label}</span>
          {isOverride && <span className="text-xs text-muted-foreground">(override)</span>}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label} clarification policy</p>
        {isOverride && <p className="text-xs text-muted-foreground">Overrides project default</p>}
      </TooltipContent>
    </Tooltip>
  );
}
```

**Implementation Notes**:
- Use TypeScript `Record<ClarificationPolicy, string>` for exhaustive enum mapping
- Conditional styling: `variant="secondary"` for active, `variant="outline"` for default inheritance
- Tooltip provides full context without cluttering UI
- `asChild` prop on TooltipTrigger prevents extra wrapper div
- Board view: conditional rendering `{ticket.clarificationPolicy && <PolicyBadge />}`

---

## Summary of Key Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| Database | Prisma enum with default (AUTO) and nullable override | Type-safe, database-validated, clear inheritance |
| API | Zod `.partial()` with `z.nativeEnum()` for validation | Type-safe partial updates, structured errors |
| Resolution | Nullish coalescing (`??`) in utility function | Idiomatic TypeScript, testable, single source |
| Workflow | Heredoc JSON + jq for safe payload construction | Shell-safe, readable, GitHub Actions best practice |
| Command | JSON detection with plain text fallback | Backward compatible, graceful degradation |
| AUTO | Weighted keywords + confidence + fallback | Transparent, tunable, safe default (CONSERVATIVE) |
| UI | Shadcn/ui Badge + Tooltip with utility icons | Consistent, accessible, reusable |

## Open Questions

None. All technical unknowns resolved. Ready for Phase 1 (data model + contracts).
