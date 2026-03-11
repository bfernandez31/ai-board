# Feature Specification: Plan Quotas & Enforcement

**Feature Branch**: `AIB-246-plan-quotas-enforcement`
**Created**: 2026-03-10
**Status**: Draft
**Input**: User description: "Apply plan limits to control platform usage across Free, Pro, and Team tiers"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Usage display location — show quota consumption inline on dashboard and within creation forms rather than as a separate dedicated page
- **Policy Applied**: AUTO (resolved as CONSERVATIVE due to low confidence fallback)
- **Confidence**: Low (score 2) — billing/enforcement context triggers conservative approach
- **Fallback Triggered?**: Yes — AUTO promoted to CONSERVATIVE because absScore < 3
- **Trade-offs**:
  1. Inline display is less disruptive to user workflow but requires changes in multiple UI surfaces
  2. A dedicated usage page would be simpler to build but less visible to users when it matters most
- **Reviewer Notes**: Confirm that inline usage indicators on the dashboard and creation forms are sufficient, or whether a dedicated usage/billing summary page is also needed

---

- **Decision**: Ticket counter reset mechanism — use calendar month boundaries (1st of each month, midnight UTC) for the monthly ticket counter reset
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: Low (score 2) — financial/billing implication warrants conservative default
- **Fallback Triggered?**: Yes — CONSERVATIVE fallback applied
- **Trade-offs**:
  1. Calendar month is simple and predictable for users but may cause burst usage at month start
  2. Rolling 30-day window would be smoother but harder for users to understand their reset date
- **Reviewer Notes**: Verify that UTC midnight as the reset boundary is acceptable for all user timezones. Calendar month aligns with existing ticket counting logic in the codebase

---

- **Decision**: Upgrade prompt behavior — block the action and show an inline upgrade message rather than allowing the action to proceed with a warning
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: Low (score 2) — enforcement behavior must be predictable and secure
- **Fallback Triggered?**: Yes — CONSERVATIVE fallback applied
- **Trade-offs**:
  1. Hard blocking prevents any confusion about whether the action succeeded but may frustrate users
  2. Soft warnings would be less disruptive but could lead to user confusion if the action fails server-side anyway
- **Reviewer Notes**: Confirm that a hard block with clear upgrade CTA is the desired behavior. The server already returns 403 for limit violations, so the UI should match

---

- **Decision**: Analytics gating scope — "Basic" analytics means the existing analytics dashboard with standard metrics; "Advanced" analytics is a Team-only tier that will be defined in a future ticket
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: Low (score 2) — scope boundary decision
- **Fallback Triggered?**: Yes — CONSERVATIVE fallback applied
- **Trade-offs**:
  1. Deferring advanced analytics definition keeps this ticket focused on quota enforcement
  2. Not defining the advanced/basic boundary now could lead to rework later
- **Reviewer Notes**: The analytics gating flag (`advancedAnalytics`) already exists in plan limits. This ticket only needs to enforce the gate; the actual advanced analytics features should be specified separately

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Project Creation Quota Enforcement (Priority: P1)

A Free-plan user attempts to create a second project. The system prevents the creation and displays a clear message explaining the Free plan limit of 1 project, with a direct link to upgrade to Pro or Team.

**Why this priority**: Project creation is the most fundamental action on the platform. Enforcing this limit is the primary gate for the Free tier and directly drives upgrade conversions.

**Independent Test**: Can be fully tested by creating one project as a Free user, then attempting to create a second. The system should block the second creation and display the upgrade prompt.

**Acceptance Scenarios**:

1. **Given** a Free-plan user with 0 projects, **When** they create a project, **Then** the project is created successfully
2. **Given** a Free-plan user with 1 existing project, **When** they attempt to create another project, **Then** the system blocks the creation and shows an upgrade message with a link to the billing page
3. **Given** a Pro-plan user, **When** they create multiple projects, **Then** all projects are created without restriction
4. **Given** a Team-plan user, **When** they create multiple projects, **Then** all projects are created without restriction

---

### User Story 2 - Monthly Ticket Quota Enforcement (Priority: P1)

A Free-plan user can create up to 5 tickets per calendar month. After reaching the limit, the system blocks further ticket creation and displays a message showing their current usage and an upgrade option. The counter resets on the 1st of each month.

**Why this priority**: Ticket creation is the core workflow action. Monthly quotas are the primary usage-based limit that differentiates Free from paid plans.

**Independent Test**: Can be tested by creating 5 tickets as a Free user in a single month, then attempting a 6th. The system should block creation and show the usage count.

**Acceptance Scenarios**:

1. **Given** a Free-plan user with 0 tickets this month, **When** they create a ticket, **Then** the ticket is created and the usage indicator shows "1/5 tickets this month"
2. **Given** a Free-plan user with 4 tickets this month, **When** they create a ticket, **Then** the ticket is created and the usage indicator shows "5/5 tickets this month"
3. **Given** a Free-plan user with 5 tickets this month, **When** they attempt to create another ticket, **Then** the system blocks creation and shows an upgrade message with current usage "5/5 tickets this month"
4. **Given** a Free-plan user with 5 tickets last month, **When** a new calendar month begins, **Then** the counter resets and the user can create tickets again (usage shows "0/5 tickets this month")
5. **Given** a Pro or Team-plan user, **When** they create tickets, **Then** there is no monthly limit and no usage counter is displayed

---

### User Story 3 - Member Addition Enforcement (Priority: P2)

When a Free or Pro-plan user tries to add a member to a project, the system blocks the action and displays a message indicating that the Team plan is required for collaboration features. Team-plan users can add up to 10 members per project.

**Why this priority**: Member management is important for collaboration but is secondary to project and ticket creation for individual users.

**Independent Test**: Can be tested by attempting to add a member as a Pro user, confirming the block, then testing as a Team user to confirm it succeeds.

**Acceptance Scenarios**:

1. **Given** a Free-plan project owner, **When** they attempt to add a member, **Then** the system blocks the action and shows a message to upgrade to Team
2. **Given** a Pro-plan project owner, **When** they attempt to add a member, **Then** the system blocks the action and shows a message to upgrade to Team
3. **Given** a Team-plan project owner with fewer than 10 members, **When** they add a member, **Then** the member is added successfully
4. **Given** a Team-plan project owner with 10 members in a project, **When** they attempt to add another member, **Then** the system blocks the action and shows a message that the member limit has been reached

---

### User Story 4 - Usage Visibility (Priority: P2)

Users can see their current plan usage at relevant touchpoints: on the dashboard and within creation forms. Free-plan users see their consumption metrics (e.g., "1/1 projects", "3/5 tickets this month"). Paid-plan users see their plan name without quota counters since their limits are unlimited.

**Why this priority**: Usage visibility helps users understand their position relative to limits and encourages timely upgrades before hitting walls.

**Independent Test**: Can be tested by logging in as a Free user and verifying usage indicators appear on the dashboard and in ticket/project creation flows.

**Acceptance Scenarios**:

1. **Given** a Free-plan user on the dashboard, **When** the page loads, **Then** they see their project count relative to the limit (e.g., "1/1 projects") and their monthly ticket count (e.g., "3/5 tickets this month")
2. **Given** a Free-plan user opening the ticket creation form, **When** the form renders, **Then** it shows the remaining ticket quota for the month
3. **Given** a Pro-plan user on the dashboard, **When** the page loads, **Then** they see their plan name (Pro) without numerical quota indicators
4. **Given** a Team-plan user on the dashboard, **When** the page loads, **Then** they see their plan name (Team) and member count per project

---

### User Story 5 - Analytics Access Gating (Priority: P3)

Only Team-plan users have access to advanced analytics. Free and Pro-plan users see basic analytics. When a non-Team user tries to access advanced analytics features, they see an upgrade prompt.

**Why this priority**: Analytics differentiation is a value-add distinction between plans but is not a core workflow blocker.

**Independent Test**: Can be tested by navigating to the analytics section as a Pro user and verifying that advanced features show an upgrade gate.

**Acceptance Scenarios**:

1. **Given** a Free-plan user, **When** they access the analytics section, **Then** they see basic analytics only
2. **Given** a Pro-plan user, **When** they access the analytics section, **Then** they see basic analytics only
3. **Given** a Team-plan user, **When** they access the analytics section, **Then** they see both basic and advanced analytics
4. **Given** a Free or Pro-plan user, **When** they attempt to access an advanced analytics feature, **Then** they see an upgrade prompt for the Team plan

---

### User Story 6 - Grace Period Quota Behavior (Priority: P3)

When a paid user's payment fails, their plan enters a grace period (7 days). During the grace period, existing plan limits remain active. After the grace period expires without successful payment, the user is downgraded to Free-plan limits.

**Why this priority**: Grace period handling ensures a fair and predictable experience during payment issues, reducing churn and support requests.

**Independent Test**: Can be tested by simulating a payment failure scenario and verifying limits remain during grace period, then verifying downgrade after expiry.

**Acceptance Scenarios**:

1. **Given** a Pro-plan user with a failed payment within the 7-day grace period, **When** they use the platform, **Then** they retain Pro-plan limits
2. **Given** a Pro-plan user whose grace period has expired, **When** they attempt to create a second project, **Then** the system enforces Free-plan limits and blocks the creation
3. **Given** a user whose grace period just expired, **When** they view the dashboard, **Then** they see a notification about the downgrade and a prompt to update their payment method

---

### Edge Cases

- What happens when a user downgrades from Pro/Team to Free while having more projects than the Free limit allows? Existing projects remain accessible but no new projects can be created until under the limit.
- What happens when a user downgrades mid-month with more than 5 tickets already created? Existing tickets remain; new ticket creation is blocked until the next month resets the counter.
- What happens when a Team-plan project owner downgrades and has existing members? Existing members retain access, but no new members can be added.
- What happens when a member's access changes due to the project owner's plan change? Members continue to have read/write access; only the addition of new members is restricted.
- What happens when multiple projects exist and the user downgrades to Free? All existing projects remain accessible; the user cannot create new projects until they are under the 1-project limit (by deleting projects or upgrading).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST enforce a maximum of 1 project for Free-plan users, preventing creation of additional projects
- **FR-002**: System MUST enforce a maximum of 5 tickets per calendar month for Free-plan users, counting from the 1st of the month (UTC)
- **FR-003**: System MUST allow unlimited project creation for Pro and Team-plan users
- **FR-004**: System MUST allow unlimited ticket creation for Pro and Team-plan users
- **FR-005**: System MUST restrict member addition to Team-plan users only, with a maximum of 10 members per project
- **FR-006**: System MUST display an upgrade prompt with a link to the billing page when a user hits a plan limit
- **FR-007**: System MUST reset the monthly ticket counter on the 1st of each calendar month at midnight UTC
- **FR-008**: System MUST display current usage metrics (project count, monthly ticket count) to Free-plan users on the dashboard and in creation forms
- **FR-009**: System MUST restrict advanced analytics access to Team-plan users only
- **FR-010**: System MUST maintain existing plan limits during the 7-day grace period after a payment failure
- **FR-011**: System MUST enforce Free-plan limits after the grace period expires without successful payment
- **FR-012**: System MUST preserve existing resources (projects, tickets, members) when a user downgrades, while preventing creation of new resources beyond the new plan limits
- **FR-013**: System MUST show the user's current plan name on the dashboard for all plan tiers

### Key Entities

- **Plan Quota**: The set of limits associated with each plan tier (Free, Pro, Team), including maximum projects, monthly tickets, member capacity, and analytics access level
- **Usage Counter**: A per-user, per-resource metric tracking current consumption against plan limits, with monthly ticket counters resetting on calendar month boundaries
- **Upgrade Prompt**: A contextual message shown when a user reaches a plan limit, containing the specific limit hit, current usage, and a call-to-action to upgrade

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of Free-plan users are prevented from exceeding their project limit (1 project)
- **SC-002**: 100% of Free-plan users are prevented from exceeding their monthly ticket limit (5 tickets)
- **SC-003**: Users see their current usage metrics within 2 seconds of page load
- **SC-004**: Upgrade prompts are displayed within 1 second when a user attempts an action beyond their plan limits
- **SC-005**: Monthly ticket counters reset correctly on the 1st of each month with zero manual intervention
- **SC-006**: Downgraded users retain access to all existing resources while being prevented from creating new ones beyond limits
- **SC-007**: Grace period users retain full plan access for exactly 7 days after payment failure before downgrade enforcement

### Assumptions

- The Stripe integration (AIB-245) is fully implemented and provides the subscription data, plan limits, and billing page infrastructure
- The existing `getUserSubscription()` function correctly returns the effective plan considering grace periods and cancellation status
- Calendar month boundaries in UTC are acceptable for all users regardless of timezone
- "Basic analytics" refers to the current analytics dashboard; "Advanced analytics" features will be defined in a separate ticket
- The existing upgrade prompt component can be reused across all quota enforcement touchpoints
