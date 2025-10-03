import { redirect } from 'next/navigation';

/**
 * Root Page
 * Redirects to the default project board (project ID 1)
 */
export default function Home() {
  redirect('/projects/1/board');
}