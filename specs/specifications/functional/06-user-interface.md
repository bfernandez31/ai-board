# User Interface - Functional Specification

## Purpose

The user interface provides an intuitive, modern experience for managing tickets and projects. Visual feedback, responsive design, and keyboard accessibility ensure efficient workflows across devices.

## Global Footer

A global footer is rendered on all pages (public and authenticated) via the root layout.

**Content**:
- Copyright notice: "© {current year} AI Board. All rights reserved."
- Navigation links: "Terms of Service" → `/legal/terms`, "Privacy Policy" → `/legal/privacy`

**Layout**:
- Mobile: Copyright and links stack vertically, centered
- Desktop (≥768px): Copyright on left, links on right (horizontal nav)
- Links use muted subtext color with purple hover transition (`hover:text-[#8B5CF6]`)
- Separated from content by a top border

**Component**: `components/layout/footer.tsx` — rendered after `{children}` in `app/layout.tsx`

---

## Legal Pages

Two public static pages accessible without authentication:

| Page | URL | Title |
|------|-----|-------|
| Terms of Service | `/legal/terms` | Terms of Service - AI Board |
| Privacy Policy | `/legal/privacy` | Privacy Policy - AI Board |

**Terms of Service sections**:
1. Conditions of Use — account responsibility, platform purpose
2. Limitation of Liability — "as is" warranty disclaimer
3. BYOK API Cost Responsibility — user bears third-party API costs
4. AI-Generated Code Responsibility — user responsible for reviewing generated code

**Privacy Policy sections**:
1. Data Collected — GitHub display name, email, avatar via OAuth
2. Cookies Used — NextAuth.js session cookies only (no tracking cookies)
3. No Data Resale — data used exclusively for service delivery
4. GDPR Rights — right to access, correct, delete data; 30-day processing commitment

**Design**: `max-w-3xl mx-auto` container, semantic headings, effective date displayed at top. Server Components with no client-side state.

## Sign-In Page Consent Notice

The sign-in page displays a consent notice below the OAuth buttons:

> "By signing in, you agree to our Terms of Service and Privacy Policy"

Links use purple accent color (`text-[#8B5CF6]`), surrounding text uses muted subtext styling. This is informational consent (no blocking checkbox) consistent with OAuth-based sign-in conventions.

---

## Landing Page

### Hero Section Background Animation

**Visual Effect**:
- Subtle animated ticket cards drift across the hero section background
- Reinforces the product's core concept (ticket management) visually
- Premium visual effect without interfering with text content
- 15-20 semi-transparent ticket cards move from left to right
- Each card completes one cycle in 40-60 seconds (randomized)

**Ticket Card Appearance**:
- Size: 64x40px mini ticket cards
- Colors: Cycles through Catppuccin color palette (purple, indigo, blue, emerald, amber)
- Opacity: 0.10-0.15 for subtle appearance
- Blur: 2px blur filter for enhanced depth perception
- Rotation: Random rotation between -10° to +10° for organic feel
- Content: Minimal decorative lines (abstract, not readable text)

**Responsive Behavior**:
- Desktop (≥1024px): 18 animated ticket cards
- Tablet (768-1023px): 12 animated ticket cards
- Mobile (<768px): 8 animated ticket cards
- Animation maintains 60fps performance across all devices

**Interaction Design**:
- Cards positioned behind hero text (z-index layering)
- No pointer event interference with text or buttons
- Users can click buttons and select text without animation blocking
- Animation does not capture or block any user interactions

**Accessibility**:
- Completely disabled when user has "prefers-reduced-motion" enabled
- Hidden from assistive technologies (aria-hidden)
- Text remains fully legible with contrast ratio ≥4.5:1
- No motion for users with motion sensitivity

**Performance**:
- CSS-only implementation (no JavaScript required)
- GPU-accelerated transforms for smooth animation
- Page load time increases by no more than 200ms
- Browser window resize adapts gracefully without page reload

### Hero Section Messaging and Layout

The landing page opens with a two-column hero that positions AI Board as an AI delivery system for teams that need visible, reviewable execution.

**Primary content**:
- Eyebrow label: "AI delivery system with board-native workflow context"
- Headline: "An AI delivery system for teams that ship"
- Supporting copy emphasizes ticket intent, implementation flow, and release confidence staying in one place

**Calls to action**:
- Primary CTA: "Start free" → `/auth/signin`
- Secondary CTA: "See workflow" → `#workflow`

**Proof points**:
- "Built for AI-first product delivery"
- "Every step stays reviewable"
- "Designed for teams that need visible progress"

**Supporting panel**:
- A card-style summary panel sits beside the main copy on large screens
- The panel presents delivery stats, a "Live delivery board" label, and a current-focus summary for the BUILD stage
- On smaller screens the panel stacks below the hero copy without changing content order

### Landing Page Structure

The landing page is a server-rendered page displayed to unauthenticated visitors only. It is composed of five sequential sections:

1. **HeroSection** — positioning statement, proof points, CTAs, and delivery summary panel
2. **FeaturesGrid** — value framing focused on ownership, quality gates, context, and workflow clarity
3. **WorkflowSection** — delivery-stage explanation paired with a board demo
4. **PricingSection** — pricing cards and FAQ (`#pricing`)
5. **CTASection** — closing conversion panel with sign-in and pricing links

All sections are server components except where client interactivity is required (e.g., PricingFAQ uses `'use client'` for the Collapsible accordion).

### Features Section

The features section reframes the landing page around operational clarity rather than a generic feature inventory.

**Section header**:
- Eyebrow label: "Why AI Board"
- Headline: "Designed for calm, auditable execution"
- Supporting copy explains that ticket intent, workflow state, and release confidence remain visible in one place

**Feature themes**:
- Clear ownership across every stage
- Built-in quality gates
- Shared context, not scattered prompts
- Repository-aware automation
- Readable by humans under pressure
- Workflow clarity without extra coordination layers

**Layout**:
- Introductory summary panel displayed above the card grid
- Feature cards use a single-column layout on mobile, two columns on medium screens, and three columns on extra-large screens
- Each feature card uses semantic color tokens for icon emphasis and a bordered card surface for contrast

### Workflow Section

The workflow section explains the operating model in present-tense delivery language instead of step names alone.

**Section header**:
- Eyebrow label: "Delivery Workflow"
- Headline: "One workflow from ticket intake to shipped code"
- Supporting copy explains that AI handles repetitive work while human review points remain visible

**Stage descriptions**:
- `INBOX` — capture the request where it starts
- `SPECIFY` — turn ambiguity into a shared spec
- `PLAN` — lock implementation intent
- `BUILD` — run the implementation with context attached
- `VERIFY` — review before the last irreversible step

**Layout**:
- The mini kanban demo is shown inside a bordered surface
- Stage explanation cards are displayed below the demo across all viewports
- Each stage uses a semantic badge color and a companion description card

### Pricing Section

The pricing section (`components/landing/pricing-section.tsx`) displays subscription plans and a FAQ to unauthenticated visitors. It is positioned after `WorkflowSection` and before `CTASection` with `id="pricing"` for anchor linking.

**Layout**:
- Section heading: "Simple, transparent pricing" (centered)
- Sub-heading: description text (centered, `max-w-2xl`)
- Plan cards: `grid-cols-1 md:grid-cols-3` — single column on mobile, 3 columns on `md+`
- FAQ: below the cards, `max-w-2xl mx-auto`

**Plan Cards** (`components/landing/pricing-card.tsx`):

Plan data is sourced from `lib/billing/plans.ts` (`PLANS` constant) — the same source of truth used by the billing settings page. This ensures pricing shown on the landing page always matches in-app billing.

| Plan | Price | CTA Label | Highlighted |
|------|-------|-----------|-------------|
| Free | $0 | "Get Started" | No |
| Pro | $15/mo | "Start 14-day trial" | Yes ("Most Popular" badge, `border-primary`) |
| Team | $30/mo | "Start 14-day trial" | No |

Each card shows: plan name, monthly price, feature list (checkmark icons), and a CTA button. All CTA buttons link to `/auth/signin`.

**FAQ** (`components/landing/pricing-faq.tsx`):

A `'use client'` component using `Collapsible` from shadcn/ui. Four accordion items:

1. "What does BYOK mean?" — explains Bring Your Own Key, required on Free plan
2. "Which AI agents are supported?" — Claude (Anthropic) and Codex (OpenAI)
3. "How does the 14-day trial work?" — Pro/Team trial, cancel anytime
4. "Can I switch plans?" — upgrade/downgrade via billing settings

**Responsive behavior**:
- Mobile (< 768px): cards stack in single column
- Tablet / Desktop (≥ 768px): 3-column card grid
- Minimum supported viewport: 375px (no horizontal scroll)

**Accessibility**:
- `aria-hidden` is not needed (content is informational, not decorative)
- Collapsible triggers are keyboard-accessible; `ChevronDown` rotates 180° when open
- Text contrast meets WCAG AA (semantic color tokens only — no hardcoded hex values)

### Final Call To Action

The landing page closes with a bordered conversion panel that reinforces reduced coordination overhead.

**Content**:
- Eyebrow label: "Start Shipping"
- Headline: "Replace status chasing with visible momentum"
- Supporting copy focuses on keeping the ticket, AI workflow, and verification path together

**Calls to action**:
- Primary CTA: "Launch your workspace" → `/auth/signin`
- Secondary CTA: "Review pricing" → `#pricing`

**Layout**:
- Content and CTA buttons stack on mobile
- On large screens the message and button group align in a two-column layout
- Both buttons remain visible without relying on hover-only affordances

---

## Visual Design

### Theme

**Dark Mode**:
- Dark theme applied by default throughout application
- Reduced eye strain for extended use
- High contrast for readability
- Consistent color palette across all screens

### Typography

**Hierarchy**:
- Large, prominent titles for primary content
- Clear differentiation between headings and body text
- Readable font sizes across all device types
- Proper line spacing for scanning content

### Color System

**Stage Colors**:
- INBOX: Gray (neutral, starting point)
- SPECIFY: Blue (planning and documentation)
- PLAN: Blue (planning and documentation)
- BUILD: Green (active development)
- VERIFY: Orange (testing and validation)
- SHIP: Purple (completed work)

**Semantic Colors**:
- Success actions: Green indicators
- Warnings: Orange highlights
- Errors: Red messaging
- Information: Blue accents
- In-progress operations: Blue indicators (pending/running states)

### Ticket Card Badges

**Workflow Type Badges**:
- QUICK: ⚡ Quick badge with amber background (amber-100/amber-900 dark)
- CLEAN: ✨ Clean badge with sparkles icon and purple background (purple-100/purple-900 dark)
- FULL: No workflow type badge displayed

**Agent Badge**:
- All tickets display the agent's favicon icon (without text) in the ticket card header row
- Hovering the favicon shows a tooltip with the agent name (e.g., "Claude" or "Codex")
- Inherited agent (ticket.agent is null, using project default): tooltip includes "(default)" suffix (e.g., "Claude (default)")
- CLAUDE agent: Claude favicon image (`/agents/claude.svg`)
- CODEX agent: Codex favicon image (`/agents/codex.svg`)

## Interactive Elements

### Buttons

**Primary Actions**:
- Create, Save, Submit actions use prominent styling
- Loading states during operation execution
- Disabled state when validation fails
- Clear visual feedback on hover

**Secondary Actions**:
- Cancel, Close actions use subtle styling
- Less prominent than primary actions
- Still easily accessible

**Icon Buttons**:
- Icons with descriptive text labels
- Tooltips provide additional context
- Appropriate sizing for touch targets

### Forms

**Input Fields**:
- Clear labels for all fields
- Placeholder text provides examples
- Required field indicators
- Character counters for length limits

**Validation**:
- Real-time validation as user types
- Error messages appear below fields
- Field borders indicate validation state
- Submit disabled when form invalid

**Keyboard Support**:
- Tab navigation between fields
- Enter/Return to submit (where appropriate)
- Cmd/Ctrl+Enter shortcuts for submission
- Escape to cancel/close modals

### Modals

**Display Behavior**:
- Modal overlays centered on screen (desktop)
- Full-screen presentation on mobile
- Backdrop darkens underlying content
- Focus trapped within modal
- Content scrolling managed at tab level (single scroll area per tab)
- No nested scrollbars within modal content
- Mobile spacing optimized: tab list has no bottom margin on mobile (0px) to maximize content area

**Constitution Viewer Modal**:
- Opened from project settings "Constitution" button
- Three tabs: View, Edit, History
- View tab displays rendered GitHub Flavored Markdown (GFM) content
- Edit tab provides raw markdown textarea with save/cancel
- History tab shows commit list with diff viewer
- Unsaved changes prompt when closing with edits
- Same GFM rendering as ticket documentation viewer (supports tables, task lists, strikethrough)

**Closing Methods**:
- Close button (X) in header
- Cancel button in footer
- Escape key press
- Click outside modal (configurable)

**Confirmation Modals**:
- Clear title explaining action
- Warning message for destructive operations
- Cancel and Proceed/Confirm buttons
- Mandatory for quick implementation workflow

**Quick-Impl Confirmation Modal**:
- Displays benefits/trade-offs of skipping specification and planning phases
- Agent is resolved automatically from the ticket's agent field (set in INBOX), falling back to project default, then CLAUDE
- No agent selection in the modal — agent is configured on the ticket before transitioning

**Cleanup Confirmation Dialog**:
- Triggered when "Clean Project" menu option selected
- Title: "Clean Project"
- Description explains cleanup will analyze changes since last cleanup
- Shows list of shipped tickets that will be analyzed
- Warning that stage transitions will be blocked during cleanup
- Cancel and "Start Cleanup" buttons
- Loading state while cleanup job is being created

## Drag-and-Drop

### Visual Feedback

**During Drag**:
- Dragged item shows ghost/preview
- Valid drop zones highlighted with colored borders
- Invalid zones reduced opacity (50%)
- Cursor indicates drop allowed/prohibited

**Drop Zones**:
- Green highlighting: Quick implementation path (INBOX → BUILD)
- Blue highlighting: Normal workflow path (INBOX → SPECIFY)
- Red highlighting: Trash zone (delete ticket)
  - Border, icon, and text all turn red when valid ticket is dragged over
  - Smooth color transitions (200ms duration)
  - Consistent red color across all visual elements
- Gray with prohibited icon: Invalid transitions
- Badge text explains special transitions

**Smooth Animations**:
- Ticket movement between columns animated
- Card returns to original position if dropped on invalid zone
- Visual confirmation when drop succeeds

### Touch Support

**Mobile Interaction**:
- Long-press to initiate drag
- Touch-friendly drag targets
- Visual feedback adapted for touch
- Smooth performance on mobile devices

**Mobile Drop Zone Positioning**:
- **Trash Zone**: Positioned at bottom-left on mobile (<768px) for easy thumb access
- **Close Zone**: Positioned at bottom-right on mobile (<768px) to complement trash zone
- Desktop (≥768px): Trash zone centered, close zone at right with more spacing
- Adaptive sizing ensures drop zones remain accessible on small screens
- Smaller icons (20px) and text (14px) on mobile prevent overlap with dragged tickets
- Reduced padding (12px) optimizes screen space usage on mobile devices

## Responsive Behavior

### Desktop (≥1024px)

**Layout**:
- All six columns visible side-by-side
- Adequate spacing between columns
- Multiple tickets visible per column
- Sidebar and navigation accessible

**Interaction**:
- Mouse hover states active
- Keyboard shortcuts available
- Drag-and-drop with mouse
- Context menus and tooltips

### Tablet (768px - 1023px)

**Layout**:
- Columns adapt to narrower viewport
- Horizontal scrolling if needed
- Touch-optimized spacing
- Simplified navigation

**Interaction**:
- Touch-first interaction model
- Long-press for drag operations
- Tap targets appropriately sized
- Reduced reliance on hover states

### Mobile (375px - 767px)

**Layout**:
- Horizontal scroll for all columns
- Full-width ticket cards
- Modals occupy full screen
- Simplified header and navigation
- Notification bell visible in header
- User menu hidden (replaced by hamburger menu)

**Interaction**:
- Touch-only interaction
- Swipe gestures where appropriate
- Tap targets minimum 44px
- No keyboard shortcuts expected
- Notification bell fully accessible via touch

### Small Screens (<375px)

**Layout**:
- Horizontal scrolling enabled
- Minimum usable layout maintained
- Critical features accessible
- Simplified presentation

## Header Elements

### Header Layout

The header maintains consistent layout across all pages within a project:

**Element Positioning**:
- Left: Logo and project information (project key, name)
- Center: Context-specific navigation (search on board page, empty on other pages)
- Right: Notification bell, user menu, and mobile hamburger menu
- Spacer element pushes right-side elements to correct position on all pages

**Layout Logic**:
- Board page: Search input provides flex spacing, spacer hidden
- Analytics/Settings pages: Spacer element provides flex spacing to position right-side elements
- Landing page (no project): Spacer element ensures right-side alignment

### Analytics Navigation

The header provides quick access to project analytics:

**Visual Presentation**:
- Bar chart icon (BarChart3) positioned in application header
- Visible on desktop (≥768px) alongside specifications link
- Visible on mobile (<768px) via hamburger menu
- Consistent gray color scheme with hover state transition

**Desktop Behavior** (≥768px):
- Analytics icon appears next to specifications icon in header
- Clicking navigates to `/projects/{projectId}/analytics`
- Tooltip provides context on hover
- Visible only when viewing project board

**Mobile Behavior** (<768px):
- Analytics icon appears in hamburger menu next to specifications icon
- Positioned below project name in mobile menu drawer
- Clicking navigates to analytics page and closes menu
- Part of project-specific navigation group

**Accessibility**:
- `aria-label="View project analytics"` for screen readers
- Keyboard accessible via tab navigation
- Touch-friendly target size on mobile devices

### Notification Bell

The notification bell provides access to mention notifications:

**Visual Presentation**:
- Bell icon positioned in application header
- Visible on all pages and all screen sizes when authenticated (mobile, tablet, desktop)
- Badge displays unread count (1-9 or "9+" for overflow)
- Badge styled with purple background (purple-500) and white text with hover state (purple-600)
- Badge border matches background color for cohesive appearance
- Badge hidden when no unread notifications

**Responsive Behavior**:
- Mobile (< 768px): Bell visible alongside hamburger menu; user menu hidden
- Tablet/Desktop (≥ 768px): Bell visible alongside user menu
- Maintains consistent positioning across all viewport sizes

**Dropdown Menu**:
- Opens on bell icon click
- Shows 5 most recent notifications
- Displays actor avatar, name, and action text
- Shows comment preview (80 character limit)
- Provides relative timestamps
- Includes "Mark all as read" and "View all" actions

**Mobile Responsiveness**:
- Dropdown width adapts to viewport: `calc(100vw - 16px)` with 380px maximum
- Prevents horizontal overflow on narrow screens (375px minimum supported)
- Content area height: `calc(100vh - 200px)` minimum 200px on mobile, fixed 400px maximum on desktop (≥640px)
- Scrollable content area prevents dropdown from extending beyond screen bounds
- 8px horizontal margin ensures dropdown doesn't touch screen edges

**Visual States**:
- Unread: Blue dot or background highlight
- Read: No highlight indicator
- Empty: "No notifications" message
- Loading: Skeleton or spinner during fetch

**Polling Behavior**:
- Updates every 15 seconds automatically
- Continues while user is authenticated
- Stops when user logs out
- Syncs across open tabs/windows

## Navigation

### Tab Navigation

**Ticket Detail Tabs**:
- Details, Comments, Files, Stats tabs available
- Active tab visually highlighted
- Click tab headers to switch
- Smooth transition between tabs
- Initial tab can be specified via URL parameter
- Defaults to Details tab when no parameter provided
- Each tab content area has unified scrolling behavior
- Tab containers manage overflow with single scroll area (no nested scrollbars)

**Keyboard Navigation**:
- Arrow keys (left/right) navigate between tabs
- Cmd/Ctrl+1, +2, +3, +4 for direct tab access
- Tab order follows visual sequence
- Ignored on mobile devices

**Tab Indicators**:
- Comment count badge on Comments tab
- Shows number of comments: "Comments (5)"
- Updates in real-time as comments added/deleted
- Provides activity overview

**Stats Tab Visibility**:
- Stats tab only appears when ticket has at least one associated job
- Automatically shown/hidden based on job data
- Tab list dynamically adjusts from 3 to 4 columns when Stats tab is present
- Grid layout: `grid-cols-3` (without Stats) or `grid-cols-4` (with Stats)

**URL-Based Tab Selection**:
- URL parameter `tab=comments` opens conversation tab directly
- Used by notification navigation to link to specific comments
- Modal automatically selects specified tab on open
- Comment anchors (`#comment-{id}`) trigger automatic scrolling
- Supports deep linking to specific conversations

### Board Navigation

**Column Scrolling**:
- Vertical scroll within columns
- Independent scrolling per column
- Smooth scrolling behavior
- Scroll position maintained when switching

**Page Navigation**:
- Project list to board
- Board back to project list
- Breadcrumb or back button (implementation-specific)

### Project Cards

**Information Display**:
- Shipped ticket key (bold, e.g., "ABC-123") followed by title with checkmark icon
- Full text (key + title) truncated with ellipsis if too long
- Metadata line displayed below ticket title:
  - Relative timestamp ("Shipped 2h ago")
  - Total ticket count ("· 5 total")
- Optional deployment URL (clickable link with copy button)
- Optional GitHub repository link (opens in new tab)

**Interactive Elements**:
- Copy-to-clipboard button for deployment URL
- Non-blocking interactions (clicking URL/GitHub/copy doesn't trigger card navigation)
- Visual feedback for copy action (icon change or tooltip)
- Hover tooltips for truncated ticket titles
- Project menu (three-dot icon) with project-level actions

**Project Menu**:
- Dropdown menu triggered by three-dot icon (⋮) in card header
- Available actions:
  - **Clean Project**: Opens cleanup confirmation dialog (Sparkles icon)
  - **Settings**: Navigates to project settings page (Settings icon)
- Menu positioned to right of project name
- Click on menu does not trigger card navigation

**Text Truncation**:
- Long ticket key + title text truncated with ellipsis
- Full text (key + title) visible on hover via tooltip
- Maintains consistent card layout
- Prevents breaking fixed-width containers

**Relative Time Display**:
- Recent activity shown as "2h ago", "5m ago", etc.
- Updates on page refresh
- Tooltip with absolute timestamp on hover (recommended)
- Industry-standard pattern for activity indicators

**Responsive Grid Layout**:
- **Desktop** (≥1024px): 3-column grid for optimal space usage
- **Tablet** (640px - 1023px): 2-column grid for balanced presentation
- **Mobile** (<640px): 1-column layout (full-width cards)
- Grid adapts automatically based on viewport width
- Consistent card sizing and spacing across all breakpoints
- No horizontal scroll on any device size

**Mobile Overflow Prevention**:
- Ticket titles truncate with ellipsis on mobile viewports
- `min-w-0` utility ensures flex/grid children can shrink below content size
- `truncate` utility applies text-overflow: ellipsis
- Cards maintain maximum width matching viewport constraints
- Long text content (ticket titles, repository names) truncates gracefully
- No elements extend beyond card boundaries
- Prevents horizontal scrolling on narrow screens (375px minimum supported)

## Loading States

### Initial Load

**Board Loading**:
- Loading indicator while fetching tickets
- Skeleton screens for anticipated content
- Smooth transition when content loads

**Ticket Loading**:
- Loading state in modal when opening ticket
- Spinner or skeleton for ticket details
- Progressive content loading
- Fetches ticket from backend when not present in kanban state (closed tickets, direct URL access)
- Loading indicator displayed during backend fetch operation

### Operation Feedback

**Creating Tickets**:
- Form shows loading state
- Submit button disabled during creation
- Success confirmation when complete

**Moving Tickets**:
- Optimistic update (immediate visual change)
- Loading indicator during API call
- Rollback if operation fails

**Job Status**:
- Status indicator shows current state
- Updates every 2 seconds via polling
- Clear visual distinction between states:
  - PENDING: Waiting indicator
  - RUNNING: Progress animation
  - COMPLETED: Success checkmark
  - FAILED: Error icon

**Cleanup In Progress Banner**:
- Warning banner displayed at top of project board during cleanup
- Yellow/amber alert styling with warning icon
- Message: "Cleanup in progress - Stage transitions are temporarily disabled"
- Lists allowed operations: descriptions, documents, preview deployments
- Indicates lock will release when cleanup completes
- Auto-hides via polling when cleanup job reaches terminal state (2-second intervals)
- Only visible when project has active cleanup job (activeCleanupJobId set)

**Cleanup Transition Lock Visual Feedback**:
- During cleanup, all stage columns display blocked overlay when drag operations begin
- Same visual treatment as job-in-progress lock (dark overlay with Ban icon)
- Overlay shows "Cleanup in progress" message with "Wait for cleanup completion" subtitle
- Prevents user confusion by clearly indicating why transitions are disabled
- Drag cursor shows "not-allowed" state for all drop zones during cleanup
- Columns appear with reduced opacity (50%) to indicate disabled state

**Cleanup Job Status**:
- Cleanup ticket shows "CLEANING" status label during execution
- Status indicator updates via job polling (2-second intervals)
- Visual feedback matches other job types (pending, running, completed, failed)

**Deploy Preview Indicators**:

*Preview Icon (External Link)*:
- Appears ONLY on tickets with active preview deployment (non-null previewUrl)
- Visible on tickets in any stage (VERIFY, SHIP, etc.) as long as previewUrl exists
- Only one ticket shows preview icon at a time (single-preview enforcement)
- Clicking opens preview URL in new browser tab
- Remains visible until replaced by new deployment on different ticket
- Positioned in ticket status bar with other indicators

*Deploy Job Status (Rocket Icon)*:
- Shows ONLY during PENDING/RUNNING deployment states
- Blue color with bounce animation indicates deployment in progress
- Disappears automatically when deployment reaches terminal state
- Replaced by deploy icon (for retry) or preview icon (on success)

*Deploy Icon (Rocket, Static)*:
- Appears ONLY on tickets in VERIFY stage that are eligible for deployment
- Remains visible after deployments complete (allows re-deployment in VERIFY stage)
- Disabled only while deployment job is PENDING/RUNNING
- Clicking opens deployment confirmation modal
- Available for triggering new deployments while ticket remains in VERIFY stage
- **Stage Restriction**: Hidden on all tickets outside VERIFY stage (including SHIP)

## Empty States

### Board Columns

When column has no tickets:
- Empty state message displayed
- Consistent messaging across columns
- Encouragement to add tickets
- Clear visual indication of emptiness

### Comments

When ticket has no comments:
- "No comments yet. Be the first to comment!"
- Comment form immediately visible
- Encourages engagement

### Project List

When user has no projects:
- Clear message explaining empty state
- Call-to-action to create first project
- Helpful guidance for getting started

## Accessibility

### Keyboard Support

**Navigation**:
- Tab key navigates interactive elements
- Arrow keys for tab switching
- Shortcuts for common actions
- Escape to close modals/cancel actions

**Focus Management**:
- Visible focus indicators
- Logical focus order
- Focus trapped in modals
- Auto-focus on form inputs when appropriate
- Action buttons in modals do not auto-focus to prevent unintended activation
- Users navigate to interactive elements via keyboard (Tab key)

### Visual Accessibility

**Contrast**:
- Sufficient contrast ratios for text (WCAG AA compliance)
- Analytics dashboard card titles displayed in white (`text-white`) for optimal contrast
- Analytics chart titles displayed in white for improved readability against dark backgrounds
- Color not sole indicator of state
- Icons supplement color coding

**Text**:
- Readable font sizes (minimum 14px)
- Clear hierarchy and spacing
- Support for browser zoom
- No fixed-width containers preventing reflow

## Performance

### Perceived Performance

**Optimistic Updates**:
- UI updates immediately on user action
- Background API calls confirm changes
- Rollback if confirmation fails
- Creates illusion of instant response

**Smooth Animations**:
- 60fps target for all animations
- Hardware acceleration where appropriate
- Reduce motion support for accessibility
- Disable animations on low-end devices

### Actual Performance

**Loading Times**:
- Board loads in <2 seconds
- Modal opens in <100ms
- Drag operations respond in <100ms
- Page transitions in <500ms
- Notification dropdown loads in <500ms

**Polling Efficiency**:
- 2-second interval for job status
- 10-second interval for comments
- 15-second interval for notifications
- Automatic stop when updates complete
- Minimal network overhead

## Error Presentation

### Error Messages

**User-Friendly Language**:
- Plain language, no technical jargon
- Explain what went wrong
- Suggest how to fix the problem
- Provide recovery options

**Error Placement**:
- Inline errors below relevant fields
- Toast notifications for global errors
- Modal errors within modal context
- Persistent errors until resolved

### Recovery Actions

**Retry Options**:
- "Try Again" button for network failures
- "Refresh" for stale data
- "Cancel" to abort operation
- Link to support/documentation if available
