/**
 * Header Component Contracts
 * TypeScript interfaces for AI-BOARD application header
 * Feature: 025-header-ajoute-un
 */

/**
 * Header component props interface
 * Stateless component - no runtime configuration needed for v1
 *
 * Future enhancements may include:
 * - Dynamic user state (authenticated, username, avatar)
 * - Active page indicator for navigation highlighting
 * - Custom button configurations
 */
export interface HeaderProps {
  // V1: No props needed (static content with hardcoded buttons)
  // Component is fully self-contained for initial implementation
}

/**
 * Header button configuration
 * Used internally by Header component for button rendering
 *
 * @property label - Button text label (one of three predefined values)
 * @property onClick - Click handler function for button interaction
 * @property variant - shadcn/ui Button variant (optional, defaults to "ghost")
 */
export interface HeaderButton {
  label: 'Log In' | 'Contact' | 'Sign Up';
  onClick: () => void;
  variant?: 'default' | 'ghost' | 'outline';
}

/**
 * Mobile menu component props
 * Controls hamburger menu behavior on mobile viewports
 *
 * @property buttons - Array of button configurations to display in menu
 * @property isOpen - Current open/closed state of the mobile menu
 * @property onToggle - Callback to toggle menu open/closed state
 */
export interface MobileMenuProps {
  buttons: HeaderButton[];
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * Toast notification payload
 * Standard shadcn/ui toast options for placeholder button feedback
 *
 * @property title - Toast message title
 * @property description - Optional additional description text
 * @property variant - Toast styling variant (default, destructive, success)
 */
export interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

/**
 * Logo component props
 * Handles logo display with fallback behavior
 *
 * @property src - Path to logo SVG file (public/logo.svg)
 * @property alt - Accessible alt text for logo image
 * @property fallbackText - Text to display if logo fails to load
 * @property size - Logo dimensions in pixels (width and height)
 */
export interface LogoProps {
  src: string;
  alt: string;
  fallbackText: string;
  size: number;
}
