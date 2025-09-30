import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en" className="light">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}