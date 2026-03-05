# User Interface - Functional Specification

## Purpose

The user interface provides an intuitive, modern experience for managing tickets and projects. Visual feedback, responsive design, and keyboard accessibility ensure efficient workflows across devices.

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
- All tickets display an agent badge in the ticket card header row
- Explicitly set agent: standard badge styling showing agent label ("Claude" or "Codex")
- Inherited agent (ticket.agent is null, using project default): muted badge styling with "(default)" suffix (e.g., "Claude (default)")
- Badge uses the agent's favicon image alongside a text label for immediate recognition
- CLAUDE agent: Claude favicon image (`/agents/claude.svg`) with "Claude" label
- CODEX agent: Codex favicon image (`/agents/codex.svg`) with "Codex" label

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
- Includes an agent dropdown selector (in addition to existing benefits/trade-offs text)
- Agent dropdown defaults to the project's default agent
- Agent selection determines which AI executes the quick implementation
- Dropdown positioned between the explanation text and the warning box

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
