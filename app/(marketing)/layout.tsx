import type { JSX, ReactNode } from 'react';
import { Footer } from '@/components/layout/footer';

interface MarketingLayoutProps {
  children: ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps): JSX.Element {
  return (
    <div className="bg-[#1e1e2e] text-foreground min-h-screen">
      <div className="flex min-h-screen flex-col">
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
