/**
 * Avatar component for comment authors
 * Displays user image or initials fallback
 */

import { Avatar as ShadcnAvatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface AvatarProps {
  name: string | null;
  image: string | null;
}

/**
 * Get initials from a name (first letters of first two words)
 */
function getInitials(name: string | null): string {
  if (!name) return '?';

  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    const firstWord = words[0];
    if (!firstWord) return '?';
    return firstWord.charAt(0).toUpperCase();
  }

  const firstWord = words[0];
  const secondWord = words[1];
  if (!firstWord || !secondWord) return '?';
  return (firstWord.charAt(0) + secondWord.charAt(0)).toUpperCase();
}

export function Avatar({ name, image }: AvatarProps) {
  return (
    <ShadcnAvatar className="h-8 w-8">
      {image && <AvatarImage src={image} alt={name || 'User'} />}
      <AvatarFallback className="bg-blue/20 text-blue text-xs">
        {getInitials(name)}
      </AvatarFallback>
    </ShadcnAvatar>
  );
}
