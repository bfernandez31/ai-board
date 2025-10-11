'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MobileMenu } from '@/components/layout/mobile-menu';

export function Header() {
  const { toast } = useToast();

  const handleButtonClick = () => {
    toast({
      title: 'This feature is not yet implemented',
    });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-[hsl(var(--ctp-mantle))] text-[hsl(var(--ctp-text))]">
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
