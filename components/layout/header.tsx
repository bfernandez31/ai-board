'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { FileText, BarChart3, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileMenu } from '@/components/layout/mobile-menu';
import { UserMenu } from '@/components/auth/user-menu';
import { NotificationBell } from '@/app/components/notifications/notification-bell';
import { TicketSearch } from '@/components/search/ticket-search';

const MARKETING_NAV_ITEMS = [
  { href: '#proof', label: 'Proof' },
  { href: '#workflow', label: 'Workflow' },
  { href: '#capabilities', label: 'Capabilities' },
  { href: '#pricing', label: 'Pricing' },
];

interface ProjectInfo {
  id: number;
  name: string;
  githubOwner: string;
  githubRepo: string;
}

export function Header() {
  const pathname = usePathname();
  const { status } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);

  // Determine if we should show marketing variant
  // Show marketing variant on landing page (/) when user is NOT authenticated
  // Include loading state to avoid layout shift - better to show marketing variant
  // during loading than empty header
  const isLandingPage = pathname === '/';
  const isSignInPage = pathname === '/auth/signin';
  const isMarketingVariant = isLandingPage && status !== 'authenticated';
  // Search should only be visible on the board page
  const isBoardPage = pathname?.match(/^\/projects\/\d+\/board$/) !== null;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch project info if we're on a project page
  useEffect(() => {
    if (!pathname) {
      setProjectInfo(null);
      return;
    }

    const projectMatch = pathname.match(/^\/projects\/(\d+)/);

    if (projectMatch && projectMatch[1]) {
      const projectId = parseInt(projectMatch[1], 10);

      // Fetch project info
      fetch(`/api/projects/${projectId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.id && data.name && data.githubOwner && data.githubRepo) {
            setProjectInfo({
              id: data.id,
              name: data.name,
              githubOwner: data.githubOwner,
              githubRepo: data.githubRepo,
            });
          }
        })
        .catch(() => {
          // Silently fail - project info is optional
          setProjectInfo(null);
        });
    } else {
      setProjectInfo(null);
    }
  }, [pathname]);

  // Don't render header on auth pages except /auth/signin
  if (pathname?.startsWith('/auth') && pathname !== '/auth/signin') {
    return null;
  }

  return (
    <header
      className={`sticky top-0 z-50 w-full bg-background text-foreground transition-all duration-200 ${
        isScrolled ? 'border-b shadow-sm backdrop-blur' : ''
      }`}
    >
      <div className="flex h-16 items-center px-6">
        {/* Left: Logo + Title */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="AI-BOARD Logo"
            width={32}
            height={32}
            className="w-8 h-8"
          />
          <span className="hidden md:inline text-xl font-bold">AI-BOARD</span>
        </Link>

        {/* Center: Project Info (if available) */}
        {projectInfo && (
          <>
            {/* Desktop: Full layout with separator and icon */}
            <div className="hidden md:flex items-center gap-3 ml-8">
              <span className="text-muted-foreground">|</span>
              <span className="text-lg font-semibold text-foreground">{projectInfo.name}</span>
              <a
                href={`https://github.com/${projectInfo.githubOwner}/${projectInfo.githubRepo}/tree/main/specs/specifications`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View project specifications on GitHub"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <FileText className="w-5 h-5" />
              </a>
              <Link
                href={`/projects/${projectInfo.id}/analytics`}
                aria-label="View project analytics"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <BarChart3 className="w-5 h-5" />
              </Link>
              <Link
                href={`/projects/${projectInfo.id}/activity`}
                aria-label="View project activity"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Activity className="w-5 h-5" />
              </Link>
            </div>

            {/* Mobile: Compact with ellipsis */}
            <div className="flex md:hidden items-center gap-2 ml-2 flex-1 overflow-hidden">
              <span className="text-muted-foreground shrink-0">|</span>
              <span className="text-sm font-semibold text-foreground truncate flex-1">
                {projectInfo.name}
              </span>
            </div>
          </>
        )}

        {/* Center: Search (only on board page) - hidden on mobile */}
        {projectInfo && isBoardPage && (
          <div className="hidden md:flex flex-1 justify-center">
            <TicketSearch projectId={projectInfo.id} />
          </div>
        )}

        {/* Spacer to push buttons to the right */}
        {/* Show spacer when: no project info, OR on non-board pages (analytics, settings, etc.) */}
        <div className={!projectInfo || !isBoardPage ? "flex-1" : "hidden"} />

        {/* Right: User Menu + Mobile Menu */}
        <div className="flex items-center gap-3">
          {/* Marketing variant: Show navigation links + Sign In button */}
          {isMarketingVariant && (
            <div className="hidden md:flex items-center gap-3">
              {MARKETING_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-sm px-1 text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {item.label}
                </Link>
              ))}
              <Link href="/auth/signin">
                <Button variant="default">Get Started Free</Button>
              </Link>
            </div>
          )}

          {/* Application variant: Show Notification Bell + User Menu */}
          {!isMarketingVariant && !isSignInPage && (
            <>
              {/* Notification Bell - visible on all screen sizes */}
              <NotificationBell />
              {/* User Menu - desktop only, mobile uses hamburger menu */}
              <div className="hidden md:flex">
                <UserMenu />
              </div>
            </>
          )}

          {/* Mobile menu (visible below md breakpoint) */}
          <MobileMenu
            projectId={projectInfo?.id}
            projectName={projectInfo?.name}
            githubOwner={projectInfo?.githubOwner}
            githubRepo={projectInfo?.githubRepo}
          />
        </div>
      </div>
    </header>
  );
}
