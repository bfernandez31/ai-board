'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileMenu } from '@/components/layout/mobile-menu';
import { UserMenu } from '@/components/auth/user-menu';
import { NotificationBell } from '@/app/components/notifications/notification-bell';
import { CommandPalette } from '@/components/search/command-palette';
import { CommandPaletteTrigger } from '@/components/search/command-palette-trigger';

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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const isLandingPage = pathname === '/';
  const isSignInPage = pathname === '/auth/signin';
  const isMarketingVariant = isLandingPage && status !== 'authenticated';
  const isProjectPage =
    pathname?.match(/^\/projects\/\d+\/(board|activity|analytics|settings)$/) !== null;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);

      if (isMarketingVariant) {
        const sections = ['pricing', 'workflow', 'features'];
        let current = '';
        for (const id of sections) {
          const element = document.getElementById(id);
          if (element && element.getBoundingClientRect().top <= 120) {
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

  useEffect(() => {
    if (!pathname) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjectInfo(null);
      return;
    }

    const projectMatch = pathname.match(/^\/projects\/(\d+)/);

    if (!projectMatch?.[1]) {
      setProjectInfo(null);
      return;
    }

    const projectId = parseInt(projectMatch[1], 10);

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
        setProjectInfo(null);
      });
  }, [pathname]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('project-command-palette:state-change', {
        detail: { open: commandPaletteOpen },
      })
    );
  }, [commandPaletteOpen]);

  if (pathname?.startsWith('/auth') && pathname !== '/auth/signin') {
    return null;
  }

  return (
    <header
      className={`sticky top-0 z-50 w-full bg-background text-foreground transition-all duration-200 ${
        isScrolled ? 'border-b shadow-[0_1px_12px_rgba(139,92,246,0.15)]' : ''
      }`}
    >
      <div className="flex h-16 items-center px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="AI-BOARD Logo"
            width={32}
            height={32}
            className="h-8 w-8"
          />
          <span className="hidden text-xl font-bold md:inline">AI-BOARD</span>
        </Link>

        {projectInfo && (
          <>
            <div className="ml-8 hidden items-center gap-3 lg:flex">
              <span className="text-muted-foreground">|</span>
              <span className="text-lg font-semibold text-foreground">
                {projectInfo.name}
              </span>
              <a
                href={`https://github.com/${projectInfo.githubOwner}/${projectInfo.githubRepo}/tree/main/specs/specifications`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View project specifications on GitHub"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <FileText className="h-5 w-5" />
              </a>
            </div>

            <div className="ml-2 flex flex-1 items-center gap-2 overflow-hidden lg:hidden">
              <span className="shrink-0 text-muted-foreground">|</span>
              <span className="flex-1 truncate text-sm font-semibold text-foreground">
                {projectInfo.name}
              </span>
            </div>
          </>
        )}

        {projectInfo && isProjectPage && (
          <div className="hidden flex-1 justify-center px-6 lg:flex">
            <CommandPaletteTrigger onClick={() => setCommandPaletteOpen(true)} />
          </div>
        )}

        <div className={!projectInfo || !isProjectPage ? 'flex-1' : 'hidden'} />

        <div className="flex items-center gap-3">
          {isMarketingVariant && (
            <div className="hidden items-center gap-3 md:flex">
              {(['features', 'workflow', 'pricing'] as const).map((section) => (
                <Link
                  key={section}
                  href={`#${section}`}
                  className={`rounded-sm px-2 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    activeSection === section
                      ? 'font-medium text-primary'
                      : 'text-foreground hover:text-primary'
                  }`}
                >
                  {section.charAt(0).toUpperCase() + section.slice(1)}
                </Link>
              ))}
              <Link href="/auth/signin">
                <Button variant="default">Sign In</Button>
              </Link>
            </div>
          )}

          {!isMarketingVariant && !isSignInPage && (
            <>
              <NotificationBell />
              <div className="hidden lg:flex">
                <UserMenu />
              </div>
            </>
          )}

          <MobileMenu
            projectId={projectInfo?.id}
            projectName={projectInfo?.name}
            githubOwner={projectInfo?.githubOwner}
            githubRepo={projectInfo?.githubRepo}
          />
        </div>
      </div>

      {projectInfo && (
        <CommandPalette
          projectId={projectInfo.id}
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
        />
      )}
    </header>
  );
}
