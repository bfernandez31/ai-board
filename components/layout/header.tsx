'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileMenu } from '@/components/layout/mobile-menu';
import { UserMenu } from '@/components/auth/user-menu';

interface ProjectInfo {
  id: number;
  name: string;
  githubOwner: string;
  githubRepo: string;
}

export function Header() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);

  // Determine if we should show marketing variant
  // Show marketing variant on landing page (/) when user is NOT authenticated
  // Include loading state to avoid layout shift - better to show marketing variant
  // during loading than empty header
  const isLandingPage = pathname === '/';
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

  // Don't render header on auth pages
  if (pathname?.startsWith('/auth')) {
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
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="AI-BOARD Logo"
            width={32}
            height={32}
            className="w-8 h-8"
          />
          <span className="text-xl font-bold">AI-BOARD</span>
        </Link>

        {/* Center: Project Info (if available) */}
        {projectInfo && (
          <div className="flex items-center gap-3 ml-8">
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
          </div>
        )}

        {/* Spacer to push buttons to the right */}
        <div className="flex-1" />

        {/* Right: User Menu + Mobile Menu */}
        <div className="flex items-center gap-3">
          {/* Marketing variant: Show navigation links + Sign In button */}
          {isMarketingVariant && (
            <div className="hidden md:flex items-center gap-3">
              <Link href="#features" className="text-[hsl(var(--ctp-text))] hover:text-[#8B5CF6] transition-colors">
                Features
              </Link>
              <Link href="#workflow" className="text-[hsl(var(--ctp-text))] hover:text-[#8B5CF6] transition-colors">
                Workflow
              </Link>
              <Link href="/auth/signin">
                <Button variant="default">
                  Sign In
                </Button>
              </Link>
            </div>
          )}

          {/* Application variant: Show User Menu */}
          {!isMarketingVariant && (
            <div className="hidden md:flex items-center gap-3">
              <UserMenu />
            </div>
          )}

          {/* Mobile menu (visible below md breakpoint) */}
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
