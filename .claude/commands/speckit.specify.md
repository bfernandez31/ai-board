---
description: Create or update the feature specification from a natural language feature description.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Image Context

When invoked by the GitHub Actions workflow, this command may receive image file paths as additional command-line arguments after `$ARGUMENTS`. These images provide visual context from the ticket's attachments field.

**Image Sources**:
- **External URLs**: Downloaded from HTTPS URLs found in ticket attachments
- **Uploaded Files**: Copied from `ticket-assets/temp/` directory

**Image Location**: All images are prepared in `ticket-assets/[TICKET_ID]/` before being passed to this command.

**Usage**: When images are present:
1. Use them to understand visual requirements (mockups, screenshots, diagrams)
2. Reference them in the specification to clarify UI requirements
3. Images will be moved to `specs/[BRANCH]/assets/` after spec generation
4. Include image references in the spec using relative paths: `![Description](./assets/image-name.png)`

**Example invocation with images**:
```bash
claude "/speckit.specify {...}" ticket-assets/123/mockup.png ticket-assets/123/diagram.png
```

## Outline

The text the user typed after `/speckit.specify` in the triggering message **is** the feature description. Assume you always have it available in this conversation even if `$ARGUMENTS` appears literally below. Do not ask the user to repeat it unless they provided an empty command.

Given that feature description, do this:

1. Parse the command payload to extract the feature description and the effective clarification policy:
   - If `$ARGUMENTS` is empty ➜ ERROR "No feature description provided".
   - Trim leading whitespace; if the first non-blank character is `{`, treat `$ARGUMENTS` as JSON with shape:
     ```json
     {
       "featureDescription": "...",        // required string
       "clarificationPolicy": "..."        // optional enum: AUTO|CONSERVATIVE|PRAGMATIC|INTERACTIVE
     }
     ```
   - Use `jq` (or `python - json`) to parse the payload safely. Enforce string output for `featureDescription`; ERROR if missing/empty.
   - Set `PAYLOAD_KIND = 'JSON'` when parsing succeeds (else leave as `'TEXT'`).
   - Capture `clarificationPolicy` (normalize to uppercase enum; strip surrounding quotes/spaces). If absent or null, leave unset.
   - If payload is not JSON, treat `$ARGUMENTS` as the raw feature description, set `PAYLOAD_KIND = 'TEXT'`, and leave `clarificationPolicy` unset.
   - Store the cleaned description in `FEATURE_DESCRIPTION` and the parsed policy in `POLICY_INPUT` for later steps.

2. Run the script `.specify/scripts/bash/create-new-feature.sh --json "$FEATURE_DESCRIPTION"` from repo root and parse its JSON output for BRANCH_NAME and SPEC_FILE. When the description comes from JSON, use a helper (e.g., `python - <<'PY'`) to emit a safely escaped string before invoking the script. All file paths must be absolute.
  **IMPORTANT** You must only ever run this script once. The JSON is provided in the terminal as output - always refer to it to get the actual content you're looking for. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").
3. Load `.specify/templates/spec-template.md` to understand required sections.

4. Follow this execution flow:

    1. Work from `FEATURE_DESCRIPTION` captured in Step 1. If it is empty after trimming: ERROR "No feature description provided".
    2. Extract key concepts from `FEATURE_DESCRIPTION`: actors, actions, data, constraints.
    3. Determine the effective clarification policy:
       - If `POLICY_INPUT` is set, use that value.
       - Else if `PAYLOAD_KIND = 'TEXT'`, treat the run as `INTERACTIVE` (legacy behavior).
       - Else default to `AUTO` (JSON payload without explicit policy).
       - Record the effective policy for later logging (`EFFECTIVE_POLICY`).
    4. Apply clarification guardrails based on the effective policy:
       - For explicit `CONSERVATIVE` or `PRAGMATIC` policies, resolve ambiguities according to that stance while honoring all non-negotiable rules from the constitution (security, testing, data integrity).
       - For `AUTO`, score context signals using the weighting model from `specs/vision/auto-resolution-clarifications.md`:
         - Sensitive/compliance keywords (+3), scalability/reliability (+2), neutral feature context (+1), internal/speed keywords (-2), explicit speed directives (-3).
         - Compute `netScore` (sum of weights), `absScore = |netScore|`, and derive confidence:
           - `absScore >= 5` & ≤1 conflicting buckets → confidence 0.9 (High)
           - `absScore >= 3` → confidence 0.6 (Medium)
           - else confidence 0.3 (Low)
         - Suggested policy: CONSERVATIVE when `netScore >= 0`, PRAGMATIC when `netScore < 0`.
         - If confidence < 0.5 or there are ≥2 conflicting signal buckets, fall back to CONSERVATIVE.
       - Ticket-level overrides always win even if AUTO recommends otherwise.
    5. Auto-resolve ambiguities whenever the effective policy (or AUTO recommendation with sufficient confidence) gives a clear answer. Document each resolution in the `Auto-Resolved Decisions` section with:
       - Decision summary, policy applied, confidence (High/Medium/Low plus score), whether fallback triggered, trade-offs, reviewer notes.
    6. Only leave `[NEEDS CLARIFICATION: ...]` markers when, after applying the guardrails above, a decision still lacks a defensible default or would create major scope/UX/security risk. Respect the **maximum of 3 markers** and prioritize by impact (scope > security/privacy > user experience > technical details). If more than 3 uncertainties remain, resolve the lowest-impact ones automatically and capture assumptions.
    7. Populate the spec sections:
       - Fill **Auto-Resolved Decisions** first (even if the list is "None" when no automated decisions were needed).
       - Complete **User Scenarios & Testing**; if no clear user flow exists: ERROR "Cannot determine user scenarios".
       - Generate **Functional Requirements** that are testable and align with chosen policies; document assumptions separately.
       - Define **Success Criteria** that are measurable, technology-agnostic, and balanced across quantitative/qualitative outcomes.
       - Identify **Key Entities** when the feature manipulates data.
    8. Return: SUCCESS (spec ready for planning).

5. Write the specification to SPEC_FILE using the template structure, replacing placeholders with concrete details derived from `FEATURE_DESCRIPTION` while preserving section order and headings. The `Auto-Resolved Decisions` section MUST be populated (or explicitly set to `- None`) before saving.

6. **Specification Quality Validation**: After writing the initial spec, validate it against quality criteria:

   a. **Create Spec Quality Checklist**: Generate a checklist file at `FEATURE_DIR/checklists/requirements.md` using the checklist template structure with these validation items:
   
      ```markdown
      # Specification Quality Checklist: [FEATURE NAME]
      
      **Purpose**: Validate specification completeness and quality before proceeding to planning
      **Created**: [DATE]
      **Feature**: [Link to spec.md]
      
      ## Content Quality
      
      - [ ] No implementation details (languages, frameworks, APIs)
      - [ ] Focused on user value and business needs
      - [ ] Written for non-technical stakeholders
      - [ ] All mandatory sections completed
      - [ ] Auto-Resolved Decisions section captures policy, confidence, trade-offs, and reviewer notes (or explicitly states none)
      
      ## Requirement Completeness
      
      - [ ] No [NEEDS CLARIFICATION] markers remain
      - [ ] Requirements are testable and unambiguous
      - [ ] Success criteria are measurable
      - [ ] Success criteria are technology-agnostic (no implementation details)
      - [ ] All acceptance scenarios are defined
      - [ ] Edge cases are identified
      - [ ] Scope is clearly bounded
      - [ ] Dependencies and assumptions identified
      - [ ] Any forced CONSERVATIVE fallbacks are documented with rationale
      
      ## Feature Readiness
      
      - [ ] All functional requirements have clear acceptance criteria
      - [ ] User scenarios cover primary flows
      - [ ] Feature meets measurable outcomes defined in Success Criteria
      - [ ] No implementation details leak into specification
      
      ## Notes
      
      - Items marked incomplete require spec updates before `/speckit.clarify` or `/speckit.plan`
      ```
   
   b. **Run Validation Check**: Review the spec against each checklist item:
      - For each item, determine if it passes or fails
      - Document specific issues found (quote relevant spec sections)
   
   c. **Handle Validation Results**:
      
      - **If all items pass**: Mark checklist complete and proceed to step 7
      
      - **If items fail (excluding [NEEDS CLARIFICATION])**:
        1. List the failing items and specific issues
        2. Update the spec to address each issue
        3. Re-run validation until all items pass (max 3 iterations)
        4. If still failing after 3 iterations, document remaining issues in checklist notes and warn user
      
      - **If [NEEDS CLARIFICATION] markers remain**:
        1. Extract all [NEEDS CLARIFICATION: ...] markers from the spec
        2. **LIMIT CHECK**: If more than 3 markers exist, keep only the 3 most critical (by scope/security/UX impact) and make informed guesses for the rest
        3. For each clarification needed (max 3), present options to user in this format:
        
           ```markdown
           ## Question [N]: [Topic]
           
           **Context**: [Quote relevant spec section]
           
           **What we need to know**: [Specific question from NEEDS CLARIFICATION marker]
           
           **Suggested Answers**:
           
           | Option | Answer | Implications |
           |--------|--------|--------------|
           | A      | [First suggested answer] | [What this means for the feature] |
           | B      | [Second suggested answer] | [What this means for the feature] |
           | C      | [Third suggested answer] | [What this means for the feature] |
           | Custom | Provide your own answer | [Explain how to provide custom input] |
           
           **Your choice**: _[Wait for user response]_
           ```
        
        4. **CRITICAL - Table Formatting**: Ensure markdown tables are properly formatted:
           - Use consistent spacing with pipes aligned
           - Each cell should have spaces around content: `| Content |` not `|Content|`
           - Header separator must have at least 3 dashes: `|--------|`
           - Test that the table renders correctly in markdown preview
        5. Number questions sequentially (Q1, Q2, Q3 - max 3 total)
        6. Present all questions together before waiting for responses
        7. Wait for user to respond with their choices for all questions (e.g., "Q1: A, Q2: Custom - [details], Q3: B")
        8. Update the spec by replacing each [NEEDS CLARIFICATION] marker with the user's selected or provided answer and append an entry to `Auto-Resolved Decisions` noting the policy used to incorporate the response
        9. Re-run validation after all clarifications are resolved
   
   d. **Update Checklist**: After each validation iteration, update the checklist file with current pass/fail status

7. Report completion with branch name, spec file path, provided policy input (if any), effective clarification policy, Auto-Resolved Decisions summary, checklist results, and readiness for the next phase (`/speckit.clarify` or `/speckit.plan`).

**NOTE:** The script creates and checks out the new branch and initializes the spec file before writing.

## General Guidelines

## Quick Guidelines

- Focus on **WHAT** users need and **WHY**.
- Avoid HOW to implement (no tech stack, APIs, code structure).
- Written for business stakeholders, not developers.
- DO NOT create any checklists that are embedded in the spec. That will be a separate command.
- Respect clarification guardrails: honor the provided policy (default to AUTO when none supplied) and fall back to CONSERVATIVE when confidence is low or risk signals conflict.
- PRAGMATIC policy never removes security, data integrity, or testing obligations—only polish.
- Log every automated decision in the Auto-Resolved Decisions section with policy, confidence, fallback status, trade-offs, and reviewer guidance.

### Section Requirements

- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation

When creating this spec from a user prompt:

1. **Make informed guesses**: Use context, industry standards, and common patterns to fill gaps
2. **Document assumptions**: Record reasonable defaults in the Assumptions section
3. **Limit clarifications**: Maximum 3 [NEEDS CLARIFICATION] markers - use only for critical decisions that:
   - Significantly impact feature scope or user experience
   - Have multiple reasonable interpretations with different implications
   - Lack any reasonable default
4. **Prioritize clarifications**: scope > security/privacy > user experience > technical details
5. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
6. **Common areas needing clarification** (only if no reasonable default exists):
   - Feature scope and boundaries (include/exclude specific use cases)
   - User types and permissions (if multiple conflicting interpretations possible)
   - Security/compliance requirements (when legally/financially significant)
   
**Examples of reasonable defaults** (don't ask about these):

- Data retention: Industry-standard practices for the domain
- Performance targets: Standard web/mobile app expectations unless specified
- Error handling: User-friendly messages with appropriate fallbacks
- Authentication method: Standard session-based or OAuth2 for web apps
- Integration patterns: RESTful APIs unless specified otherwise

### Success Criteria Guidelines

Success criteria must be:

1. **Measurable**: Include specific metrics (time, percentage, count, rate)
2. **Technology-agnostic**: No mention of frameworks, languages, databases, or tools
3. **User-focused**: Describe outcomes from user/business perspective, not system internals
4. **Verifiable**: Can be tested/validated without knowing implementation details

**Good examples**:

- "Users can complete checkout in under 3 minutes"
- "System supports 10,000 concurrent users"
- "95% of searches return results in under 1 second"
- "Task completion rate improves by 40%"

**Bad examples** (implementation-focused):

- "API response time is under 200ms" (too technical, use "Users see results instantly")
- "Database can handle 1000 TPS" (implementation detail, use user-facing metric)
- "React components render efficiently" (framework-specific)
- "Redis cache hit rate above 80%" (technology-specific)
