'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MobileMenu } from '@/components/layout/mobile-menu';
import { UserMenu } from '@/components/auth/user-menu';
import { NotificationBell } from '@/app/components/notifications/notification-bell';
import { SearchTrigger } from '@/components/navigation/search-trigger';

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
  const [activeSection, setActiveSection] = useState('');
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);

  // Determine if we should show marketing variant
  // Show marketing variant on landing page (/) when user is NOT authenticated
  // Include loading state to avoid layout shift - better to show marketing variant
  // during loading than empty header
  const isLandingPage = pathname === '/';
  const isSignInPage = pathname === '/auth/signin';
  const isMarketingVariant = isLandingPage && status !== 'authenticated';
  const isProjectPage = pathname?.match(/^\/projects\/\d+/) !== null;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);

      // Track active section for marketing nav highlight
      if (isMarketingVariant) {
        const sections = ['pricing', 'workflow', 'features'];
        let current = '';
        for (const id of sections) {
          const el = document.getElementById(id);
          if (el && el.getBoundingClientRect().top <= 120) {
            current = id;
            break;
          }
        }
        setActiveSection(current);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMarketingVariant]);

  // Fetch project info if we're on a project page
  useEffect(() => {
    if (!pathname) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears project context on route change
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
      className={`sticky top-0 z-50 w-full bg-background text-foreground transition-all duration-200 border-b ${
        isScrolled ? 'shadow-[0_1px_12px_rgba(139,92,246,0.15)]' : 'border-border/50'
      }`}
    >
      <div className={`flex h-16 items-center px-6 ${isProjectPage ? 'lg:px-0' : ''}`}>
        {/* Left: Logo + Title */}
        {/* On project pages (lg+), logo sits in a 48px column aligned with sidebar */}
        {isProjectPage && (
          <div className="hidden lg:flex items-center justify-center w-12 shrink-0 self-stretch border-r">
            <Link href="/" aria-label="Home" className="hover:opacity-80 transition-opacity">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.svg"
                alt="AI-BOARD Logo"
                width={28}
                height={28}
                className="w-7 h-7"
              />
            </Link>
          </div>
        )}
        {/* Non-project pages or mobile: standard logo + text */}
        <Link href="/" className={`flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0 ${isProjectPage ? 'lg:hidden' : ''}`}>
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
        {/* Project pages (lg+): AI-BOARD text outside the 48px column */}
        {isProjectPage && (
          <Link href="/" className="hidden lg:flex items-center text-xl font-bold hover:opacity-80 transition-opacity ml-5">
            AI-BOARD
          </Link>
        )}

        {/* Center: Project Info (if available) */}
        {projectInfo && (
          <>
            {/* Desktop: Full layout with separator */}
            <div className="hidden md:flex items-center gap-3 ml-8">
              <span className="text-muted-foreground">|</span>
              <span className="text-lg font-semibold text-zinc-50">{projectInfo.name}</span>
            </div>

            {/* Mobile: Compact with ellipsis */}
            <div className="flex md:hidden items-center gap-2 ml-2 flex-1 overflow-hidden">
              <span className="text-muted-foreground shrink-0">|</span>
              <span className="text-sm font-semibold text-zinc-50 truncate flex-1">
                {projectInfo.name}
              </span>
            </div>
          </>
        )}

        {/* Center: Search trigger - opens command palette */}
        {projectInfo && isProjectPage && (
          <div className="hidden md:flex flex-1 justify-center">
            <SearchTrigger onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))} />
          </div>
        )}

        {/* Spacer to push buttons to the right */}
        <div className={!projectInfo || !isProjectPage ? "flex-1" : "hidden"} />

        {/* Right: User Menu + Mobile Menu */}
        <div className="flex items-center gap-3">
          {/* Marketing variant: Show navigation links + Sign In button */}
          {isMarketingVariant && (
            <div className="hidden md:flex items-center gap-3">
              {(['features', 'workflow', 'pricing'] as const).map((section) => (
                <Link
                  key={section}
                  href={`#${section}`}
                  className={`transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm px-2 py-1 text-sm ${
                    activeSection === section
                      ? 'text-primary font-medium'
                      : 'text-foreground hover:text-primary'
                  }`}
                >
                  {section.charAt(0).toUpperCase() + section.slice(1)}
                </Link>
              ))}
              <Link href="/auth/signin">
                <Button variant="default">
                  Sign In
                </Button>
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
          />
        </div>
      </div>
    </header>
  );
}
