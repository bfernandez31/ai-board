'use client';

import { useState } from 'react';
import { Menu, LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  const handleSignOut = () => {
    setOpen(false);
    signOut({ callbackUrl: '/auth/signin' });
  };

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
        <div className="flex flex-col gap-4 mt-8">
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
