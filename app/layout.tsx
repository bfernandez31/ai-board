import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Header } from '@/components/layout/header';
import { SessionProvider } from '@/components/auth/session-provider';

export const metadata: Metadata = {
  title: 'AI Board',
  description: 'Visual kanban board for AI-driven development',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark overflow-hidden">
      <body className="bg-[#1e1e2e] text-foreground antialiased overflow-hidden">
        <SessionProvider>
          <Header />
          {children}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}