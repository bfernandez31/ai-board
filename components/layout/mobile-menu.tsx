'use client';

import { useState } from 'react';
import { Menu, LogOut, CreditCard, Key } from 'lucide-react';
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
import { NAVIGATION_ITEMS } from '@/components/navigation/nav-items';

interface MobileMenuProps {
  projectId?: number | undefined;
  projectName?: string | undefined;
}

export function MobileMenu({ projectId, projectName }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  function handleSignOut() {
    setOpen(false);
    signOut({ callbackUrl: '/auth/signin' });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="bg-[hsl(var(--ctp-mantle))] text-[hsl(var(--ctp-text))]"
      >
        <VisuallyHidden>
          <SheetTitle>Navigation Menu</SheetTitle>
        </VisuallyHidden>

        {/* Project Name & Navigation Links */}
        {projectName && (
          <>
            <div className="mt-6 px-2">
              <p className="text-lg font-semibold text-zinc-50">{projectName}</p>
            </div>
            <div className="border-t border-border my-2" />
            {projectId && (
              <div className="flex flex-col gap-1 px-2">
                {NAVIGATION_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.id}
                      href={`/projects/${projectId}${item.href}`}
                      className="flex items-center px-2 py-2 text-sm rounded-md hover:bg-accent"
                      onClick={() => setOpen(false)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
            <div className="border-t border-border my-2" />
          </>
        )}

        <div className="flex flex-col gap-4 mt-4">
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

              <Link
                href="/settings/billing"
                className="flex items-center px-2 py-2 text-sm rounded-md hover:bg-accent"
                onClick={() => setOpen(false)}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Billing
              </Link>

              <Link
                href="/settings/tokens"
                className="flex items-center px-2 py-2 text-sm rounded-md hover:bg-accent"
                onClick={() => setOpen(false)}
              >
                <Key className="mr-2 h-4 w-4" />
                API Tokens
              </Link>

              <div className="border-t border-border my-2" />

              <Button
                variant="outline"
                className="w-full justify-center text-red-600 hover:text-red-700"
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
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
