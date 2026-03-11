import type { JSX } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserOrNull } from '@/lib/db/users';
import LandingPage from '@/app/(marketing)/landing/page';

/**
 * Root Page
 * - Authenticated users: redirected to /projects
 * - Unauthenticated users: shown marketing landing page
 */
export default async function Home(): Promise<JSX.Element> {
  const user = await getCurrentUserOrNull();

  if (user) {
    // User is authenticated → redirect to projects
    redirect('/projects');
  }

  // User is not authenticated → show landing page
  return <LandingPage />;
}
