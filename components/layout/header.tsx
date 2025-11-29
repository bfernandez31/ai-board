'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { FileText, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileMenu } from '@/components/layout/mobile-menu';
import { UserMenu } from '@/components/auth/user-menu';
import { NotificationBell } from '@/app/components/notifications/notification-bell';

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
      className={`sticky top-0 z-50 w-full bg-[#1e1e2e] text-[hsl(var(--ctp-text))] transition-all duration-200 ${
        isScrolled ? 'border-b shadow-[0_1px_12px_rgba(139,92,246,0.15)]' : ''
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
              <span className="text-zinc-400">|</span>
              <span className="text-lg font-semibold text-zinc-50">{projectInfo.name}</span>
              <a
                href={`https://github.com/${projectInfo.githubOwner}/${projectInfo.githubRepo}/tree/main/specs/specifications`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View project specifications on GitHub"
                className="text-zinc-400 hover:text-zinc-50 transition-colors"
              >
                <FileText className="w-5 h-5" />
              </a>
              <Link
                href={`/projects/${projectInfo.id}/analytics`}
                aria-label="View project analytics"
                className="text-zinc-400 hover:text-zinc-50 transition-colors"
              >
                <BarChart3 className="w-5 h-5" />
              </Link>
            </div>

            {/* Mobile: Compact with ellipsis */}
            <div className="flex md:hidden items-center gap-2 ml-2 flex-1 overflow-hidden">
              <span className="text-zinc-400 shrink-0">|</span>
              <span className="text-sm font-semibold text-zinc-50 truncate flex-1">
                {projectInfo.name}
              </span>
            </div>
          </>
        )}

        {/* Spacer to push buttons to the right (hidden on mobile when project info exists) */}
        <div className={projectInfo ? "hidden md:flex flex-1" : "flex-1"} />

        {/* Right: User Menu + Mobile Menu */}
        <div className="flex items-center gap-3">
          {/* Marketing variant: Show navigation links + Sign In button */}
          {isMarketingVariant && (
            <div className="hidden md:flex items-center gap-3">
              <Link href="#features" className="text-[hsl(var(--ctp-text))] hover:text-[#8B5CF6] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2 rounded-sm px-1">
                Features
              </Link>
              <Link href="#workflow" className="text-[hsl(var(--ctp-text))] hover:text-[#8B5CF6] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2 rounded-sm px-1">
                Workflow
              </Link>
              <Link href="/auth/signin">
                <Button variant="default">
                  Sign In
                </Button>
              </Link>
            </div>
          )}

          {/* Sign-in page: Show nothing (just logo) */}
          {isSignInPage && (
            <div className="hidden md:flex items-center gap-3">
              {/* Empty - just show logo */}
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
