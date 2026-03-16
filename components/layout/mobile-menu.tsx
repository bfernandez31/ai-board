'use client';

import { useState } from 'react';
import { Menu, LogOut, FileText, BarChart3, Activity } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

const MARKETING_LINKS = [
  { href: '#proof', label: 'Proof' },
  { href: '#workflow', label: 'Workflow' },
  { href: '#capabilities', label: 'Capabilities' },
  { href: '#pricing', label: 'Pricing' },
];

interface MobileMenuProps {
  projectId?: number | undefined;
  projectName?: string | undefined;
  githubOwner?: string | undefined;
  githubRepo?: string | undefined;
}

export function MobileMenu({ projectId, projectName, githubOwner, githubRepo }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  const handleSignOut = () => {
    setOpen(false);
    signOut({ callbackUrl: '/auth/signin' });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation menu">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="bg-background text-foreground">
        <VisuallyHidden>
          <SheetTitle>Navigation Menu</SheetTitle>
        </VisuallyHidden>

        {/* Project Name & Links */}
        {projectName && (
          <>
            <div className="mt-6 px-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-foreground">{projectName}</p>
                <div className="flex items-center gap-2">
                  {githubOwner && githubRepo && (
                    <a
                      href={`https://github.com/${githubOwner}/${githubRepo}/tree/main/specs/specifications`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="View project specifications on GitHub"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setOpen(false)}
                    >
                      <FileText className="w-5 h-5" />
                    </a>
                  )}
                  {projectId && (
                    <Link
                      href={`/projects/${projectId}/analytics`}
                      aria-label="View project analytics"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setOpen(false)}
                    >
                      <BarChart3 className="w-5 h-5" />
                    </Link>
                  )}
                  {projectId && (
                    <Link
                      href={`/projects/${projectId}/activity`}
                      aria-label="View project activity"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setOpen(false)}
                    >
                      <Activity className="w-5 h-5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <div className="border-t border-border my-2" />
          </>
        )}

        {!session?.user && (
          <nav aria-label="Mobile marketing navigation" className="mt-6 flex flex-col gap-2">
            {MARKETING_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-2 text-base font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="mt-4 flex flex-col gap-4">
          {session?.user ? (
            // Authenticated user menu
            <>
              <div className="flex items-center gap-3 px-2">
                <Avatar>
                  <AvatarImage src={session.user.image || undefined} alt={session.user.name || ''} />
                  <AvatarFallback>
                    {session.user.name
                      ?.split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase() || '??'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-medium">{session.user.name}</p>
                  <p className="text-xs text-muted-foreground">{session.user.email}</p>
                </div>
              </div>

              <div className="border-t border-border my-2" />

              <Button
                variant="outline"
                className="w-full justify-center text-destructive hover:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </>
          ) : (
            // Unauthenticated menu
            <Link href="/auth/signin" onClick={() => setOpen(false)}>
              <Button variant="default" className="w-full justify-center">
                Get Started Free
              </Button>
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
