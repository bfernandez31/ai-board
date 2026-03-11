import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Header } from '@/components/layout/header';
import { SessionProvider } from '@/components/auth/session-provider';
import { QueryProvider } from '@/app/providers/query-provider';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Footer } from '@/components/layout/footer';
import { PushOptInPrompt } from '@/app/components/push-notifications/push-opt-in-prompt';
import { NotificationListener } from '@/app/components/push-notifications/notification-listener';

export const metadata: Metadata = {
  title: 'AI Board',
  description: 'Visual kanban board for AI-driven development',
  icons: {
    icon: '/icon',
    apple: '/apple-icon',
  },
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#1e1e2e] text-foreground antialiased">
        <QueryProvider>
          <SessionProvider>
            <TooltipProvider>
              <Header />
              <div className="min-h-[calc(100vh-7rem)]">
                {children}
              </div>
              <Footer />
              <Toaster />
              <PushOptInPrompt />
              <NotificationListener />
            </TooltipProvider>
          </SessionProvider>
        </QueryProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
