'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleButtonClick = () => {
    toast({
      title: 'This feature is not yet implemented',
    });
    setOpen(false); // Close menu after clicking
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
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={handleButtonClick}
          >
            Log In
          </Button>
          <Button
            variant="outline"
            className="w-full justify-center"
            onClick={handleButtonClick}
          >
            Contact
          </Button>
          <Button
            variant="default"
            className="w-full justify-center"
            onClick={handleButtonClick}
          >
            Sign Up
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
