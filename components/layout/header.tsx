'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MobileMenu } from '@/components/layout/mobile-menu';

interface ProjectInfo {
  id: number;
  name: string;
  githubOwner: string;
  githubRepo: string;
}

export function Header() {
  const { toast } = useToast();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);

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

    if (projectMatch) {
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

  const handleButtonClick = () => {
    toast({
      title: 'This feature is not yet implemented',
    });
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full bg-[#1e1e2e] text-[hsl(var(--ctp-text))] transition-all duration-200 ${
        isScrolled ? 'border-b shadow-[0_1px_12px_rgba(139,92,246,0.15)]' : ''
      }`}
    >
      <div className="flex h-16 items-center px-6">
        {/* Left: Logo + Title */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Image
            src="/logo.svg"
            alt="AI-BOARD Logo"
            width={32}
            height={32}
            priority
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

        {/* Right: Desktop Buttons + Mobile Menu */}
        <div className="flex items-center gap-3">
          {/* Desktop buttons (visible on md and above) */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="outline" onClick={handleButtonClick}>
              Log In
            </Button>
            <Button variant="outline" onClick={handleButtonClick}>
              Contact
            </Button>
            <Button variant="default" onClick={handleButtonClick}>
              Sign Up
            </Button>
          </div>

          {/* Mobile menu (visible below md breakpoint) */}
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
