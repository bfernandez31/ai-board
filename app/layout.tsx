import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Header } from '@/components/layout/header';
import { SessionProvider } from '@/components/auth/session-provider';
import { QueryProvider } from '@/app/providers/query-provider';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata: Metadata = {
  title: 'AI Board',
  description: 'Visual kanban board for AI-driven development',
  icons: {
    icon: '/icon',
    apple: '/apple-icon',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#1e1e2e] text-foreground antialiased">
        <QueryProvider>
          <SessionProvider>
            <Header />
            {children}
            <Toaster />
          </SessionProvider>
        </QueryProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}