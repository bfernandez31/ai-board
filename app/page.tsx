import { redirect } from 'next/navigation';

/**
 * Root Page
 * Redirects to the projects list page
 */
export default function Home() {
  redirect('/projects');
}